import VideoCreator from "..";
import { scaleBoundsAboutCenter } from "./utils";
import { ManagedNumberInputModel } from "../components/ManagedNumberInput";
import { noSpeed } from "../orientation";

export type CaptureMethod = "once" | "ntimes" | "action" | "slider" | "ticks";

export const CANCELLED = Symbol("cancelled");

async function captureAndApplyFrame(vc: VideoCreator) {
  const frame = await captureFrame(vc);
  if (frame === CANCELLED) return CANCELLED;
  vc.pushFrame(frame);
}

async function captureFrame(
  vc: VideoCreator
): Promise<string | typeof CANCELLED> {
  const width = vc.getCaptureWidthNumber();
  const height = vc.getCaptureHeightNumber();
  const targetPixelRatio = vc.getTargetPixelRatio();
  // resolves the screenshot as a data URI
  const size = {
    width: width / targetPixelRatio,
    targetPixelRatio,
    height: height / targetPixelRatio,
    preserveAxisNumbers: true,
  };
  const screenshot = vc.cc.is3dProduct() ? screenshot3d : screenshot2d;
  return await Promise.race([screenshot(vc, size), vc.awaitCancel()]);
}

interface ScreenshotOpts {
  width: number;
  height: number;
  targetPixelRatio: number;
  preserveAxisNumbers: boolean;
}

async function screenshot3d(vc: VideoCreator, size: ScreenshotOpts) {
  return await new Promise<string>((resolve) => {
    vc.cc.evaluator.notifyWhenSynced(() => resolve(vc.calc.screenshot(size)));
  });
}

async function screenshot2d(vc: VideoCreator, size: ScreenshotOpts) {
  if (vc.fastScreenshots) {
    return await new Promise<string>((resolve) => {
      vc.cc.evaluator.notifyWhenSynced(() => resolve(vc.calc.screenshot(size)));
    });
  }
  // make the captured region entirely visible
  const { width, height } = size;
  const pixelBounds = vc.calc.graphpaperBounds.pixelCoordinates;
  const ratio = height / width / (pixelBounds.height / pixelBounds.width);
  const mathBounds = vc.calc.graphpaperBounds.mathCoordinates;
  const clampedMathBounds = scaleBoundsAboutCenter(
    mathBounds,
    Math.min(ratio, 1 / ratio)
  );
  const opts = {
    ...size,
    showLabels: true,
    mathBounds: clampedMathBounds,
  };
  return await new Promise<string>((resolve) => {
    vc.calc.asyncScreenshot(opts, resolve);
  });
}

export interface SliderSettings {
  readonly min: ManagedNumberInputModel;
  readonly max: ManagedNumberInputModel;
  readonly step: ManagedNumberInputModel;
}

export async function captureSlider(vc: VideoCreator) {
  const sliderSettings = vc.sliderSettings;
  const variable = vc.sliderVariable;
  const min = sliderSettings.min.getValue();
  const max = sliderSettings.max.getValue();
  const step = sliderSettings.step.getValue();
  const slider = vc.getMatchingSlider();
  if (slider === undefined) {
    return;
  }
  const maybeNegativeNumSteps = (max - min) / step;
  const m = maybeNegativeNumSteps > 0 ? 1 : -1;
  const numSteps = m * maybeNegativeNumSteps;
  const correctDirectionStep = m * step;
  // `<= numSteps` to include the endpoints for stuff like 0 to 10, step 1
  // rarely hurts to have an extra frame
  for (let i = 0; i <= numSteps; i++) {
    const value = min + correctDirectionStep * i;
    vc.calc.setExpression({
      id: slider.id,
      latex: `${variable}=${value}`,
    });

    const ret = await captureAndApplyFrame(vc);
    if (ret === CANCELLED) break;

    if (i < numSteps) {
      updateOrientationAfterCapture(vc, numSteps - i);
    }
  }
}

function slidersLatexJoined(vc: VideoCreator) {
  return vc.cc
    .getPlayingSliders()
    .map((x) => x.latex)
    .join(";");
}

async function captureActionOrSliderTicks(vc: VideoCreator, step: () => void) {
  vc.registerUpdateListener();

  let tickCountRemaining;
  while ((tickCountRemaining = vc.getTickCountNumber()) > 0) {
    const ret = await captureAndApplyFrame(vc);
    if (ret === CANCELLED) break;
    const nextTickCount = tickCountRemaining - 1;
    vc.tickCount.setLatexWithCallbacks(nextTickCount.toFixed(0));
    if (nextTickCount <= 0) break;

    vc.updateSeen = false;
    const slidersBefore = slidersLatexJoined(vc);
    step();
    updateOrientationAfterCapture(vc, nextTickCount);

    if (
      vc.captureMethod === "ticks" &&
      slidersLatexJoined(vc) === slidersBefore
    ) {
      // Due to rounding, this slider tick does not actually change the state,
      // so don't expect an event update. Just move to the next frame now.
      continue;
    } else {
      // Wait for an on-evaluator-changes update
      const ret = await Promise.race([vc.awaitCancel(), vc.awaitUpdate()]);
      if (ret === CANCELLED) break;
    }
  }

  vc.unregisterUpdateListener();
}

async function captureNTimes(vc: VideoCreator) {
  const tickCountRemaining = vc.getTickCountNumber();
  if (vc.captureCancelled || tickCountRemaining <= 0) return;
  const ret = await captureAndApplyFrame(vc);
  if (ret === CANCELLED) return;
  vc.tickCount.setLatexWithCallbacks((tickCountRemaining - 1).toFixed(0));
  if (tickCountRemaining - 1 > 0) {
    updateOrientationAfterCapture(vc, tickCountRemaining - 1);
    await captureNTimes(vc);
  }
}

function updateOrientationAfterCapture(
  vc: VideoCreator,
  numStepsRemaining: number
) {
  const or = vc.or;
  switch (or.orientationMode) {
    case "none":
      return;
    case "current-delta": {
      let { xyRot, zTip } = or.getEulerOrientation();
      xyRot += or.xyRotStep.getValue();
      zTip += or.zTipStep.getValue();
      or.setOrientationFromCapture(xyRot, zTip);
      return;
    }
    case "from-to": {
      if (numStepsRemaining <= 0) return;
      const s = 1 / numStepsRemaining;
      // Need to go from LaTeX since we need to tell the difference between
      // 0 radians and tau radians when animating from 0 to 2*tau radians.
      let { xyRot, zTip } = or.getOrientationFromLatex();
      xyRot = or.xyRotTo.getValue() * s + xyRot * (1 - s);
      zTip = or.zTipTo.getValue() * s + zTip * (1 - s);
      or.setOrientationFromCapture(xyRot, zTip);
      return;
    }
    case "current-speed": {
      if (vc.captureMethod !== "ticks") return;
      const dt = vc.getTickTimeStepNumber() / 1000;
      const sd = or.sdBeforeCapture;
      let { xyRot, zTip } = or.getEulerOrientation();
      if (sd.dir === "xyRot") xyRot += sd.speed * dt;
      else zTip += sd.speed * dt;
      or.setOrientationFromCapture(xyRot, zTip);
      return;
    }
    default:
      or.orientationMode satisfies never;
      throw new Error("Programming Error: Invalid orientation mode");
  }
}

export async function capture(vc: VideoCreator) {
  const or = vc.or;
  vc.captureCancelled = false;
  vc.isCapturing = true;
  vc.updateView();
  const tickSliders = vc.cc._tickSliders.bind(vc.cc);
  if (vc.captureMethod !== "once") {
    if (vc.cc.getTickerPlaying?.()) {
      vc.cc.dispatch({ type: "toggle-ticker" });
    }
    if (vc.captureMethod === "ticks") {
      // prevent the current slider ticking since we will manually tick the sliders.
      vc.cc._tickSliders = () => {};
    } else if (vc.cc.getPlayingSliders().length > 0) {
      vc.cc.stopAllSliders();
      vc.updateView();
    }
    if (vc.captureMethod !== "ticks") {
      or.setSpeed(0);
    }
    or.sdBeforeCapture = or.getSpinningSpeedAndDirection() ?? noSpeed;
    or.setSpinningSpeedAndDirection(noSpeed);
    if (or.orientationMode === "from-to") {
      or.xyRotFrom.setLatexWithoutCallbacks(
        or.xyRotFrom.getLatexPopulatingDefault()
      );
      or.zTipFrom.setLatexWithoutCallbacks(
        or.zTipFrom.getLatexPopulatingDefault()
      );
      or.setOrientationFromCapture(
        or.xyRotFrom.getValue(),
        or.zTipFrom.getValue()
      );
    }
  }
  switch (vc.captureMethod) {
    case "action": {
      const step = () => {
        if (vc.currentActionID === null) return;
        vc.cc.dispatch({
          type: "action-single-step",
          id: vc.currentActionID,
        });
      };
      await captureActionOrSliderTicks(vc, step);
      break;
    }
    case "ticks": {
      let currTime = performance.now();
      const step = () => {
        const dt = vc.getTickTimeStepNumber();
        currTime += dt;
        tickSliders(currTime);
      };
      await captureActionOrSliderTicks(vc, step);
      break;
    }
    case "ntimes": {
      await captureNTimes(vc);
      break;
    }
    case "once": {
      const ret = await captureAndApplyFrame(vc);
      if (ret === CANCELLED) break;
      updateOrientationAfterCapture(vc, 0);
      break;
    }
    case "slider":
      await captureSlider(vc);
      break;
    default:
      vc.captureMethod satisfies never;
      throw new Error("Programming Error: Invalid capture method");
  }
  if (vc.captureMethod !== "once") {
    // restore the typical handling of slider ticking
    or.cc._tickSliders = tickSliders;
    // restore previous speed
    or.setSpinningSpeedAndDirection(or.sdBeforeCapture);
  }
  vc.captureCancelled = false;
  vc.isCapturing = false;
  vc.actionCaptureState = "none";
  vc.updateView();
  // no need to retain a pending cancellation, if any; capture is already finished
  vc.captureCancelled = false;
}
