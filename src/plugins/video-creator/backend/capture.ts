import VideoCreator from "..";
import { scaleBoundsAboutCenter } from "./utils";
import DSM from "#DSM";
import { ManagedNumberInputModel } from "../components/ManagedNumberInput";

let dispatchListenerID: string | null = null;
let callbackIfCancel: (() => void) | null = null;

export type CaptureMethod = "once" | "action" | "slider" | "ticks";

export function cancelCapture(vc: VideoCreator) {
  vc.captureCancelled = true;
  callbackIfCancel?.();
}

async function captureAndApplyFrame(vc: VideoCreator) {
  const frame = await captureFrame(vc);
  vc.pushFrame(frame);
}

export async function captureFrame(vc: VideoCreator) {
  const width = vc.getCaptureWidthNumber();
  const height = vc.getCaptureHeightNumber();
  const targetPixelRatio = vc.getTargetPixelRatio();
  // resolves the screenshot as a data URI
  const tryCancel = () => {
    if (vc.captureCancelled) {
      vc.captureCancelled = false;
      throw new Error("cancelled");
    }
  };
  tryCancel();
  // poll for mid-screenshot cancellation (only affects UI)
  const interval = window.setInterval(tryCancel, 50);
  const size = {
    width: width / targetPixelRatio,
    targetPixelRatio,
    height: height / targetPixelRatio,
    preserveAxisNumbers: true,
  };
  const screenshot = vc.cc.is3dProduct() ? screenshot3d : screenshot2d;
  const data = await screenshot(vc, size);
  clearInterval(interval);
  return data;
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

    try {
      await captureAndApplyFrame(vc);
    } catch {
      // should be paused due to cancellation
      break;
    }

    if (i < numSteps) {
      const numStepsRemaining = numSteps - i;
      const s = 1 / numStepsRemaining;
      const lerpXY = vc.xyRotTo.getValue() * s + vc.xyRot.getValue() * (1 - s);
      vc.xyRot.setLatexWithoutCallbacks(vc.angleToString(lerpXY));
      const lerpZ = vc.zTipTo.getValue() * s + vc.zTip.getValue() * (1 - s);
      vc.zTip.setLatexWithoutCallbacks(vc.angleToString(lerpZ));
      vc.updateOrientationFromLatex();
    }
  }
}

function slidersLatexJoined(vc: VideoCreator) {
  return vc.cc
    .getPlayingSliders()
    .map((x) => x.latex)
    .join(";");
}

async function captureActionFrame(vc: VideoCreator, step: () => void) {
  let stepped = false;
  try {
    const tickCountRemaining = vc.getTickCountNumber();
    if (tickCountRemaining > 0) {
      vc.actionCaptureState = "waiting-for-screenshot";
      await captureAndApplyFrame(vc);
      vc.tickCount.setLatexWithCallbacks((tickCountRemaining - 1).toFixed(0));
      vc.actionCaptureState = "waiting-for-update";
      if (tickCountRemaining - 1 > 0) {
        const slidersBefore = slidersLatexJoined(vc);
        step();
        stepped = true;
        if (
          vc.captureMethod === "ticks" &&
          slidersLatexJoined(vc) === slidersBefore
        ) {
          // Due to rounding, this slider tick does not actually change the state,
          // so don't expect an event update. Just move to the next frame now.
          setTimeout(() => {
            void captureActionFrame(vc, step);
          }, 0);
        }
      }
    }
  } catch {
  } finally {
    if (!stepped) {
      // should be paused due to cancellation or tickCountRemaining ≤ 0
      // this is effectively a break
      callbackIfCancel?.();
    }
  }
}

async function captureActionOrSliderTicks(vc: VideoCreator, step: () => void) {
  await new Promise<void>((resolve) => {
    callbackIfCancel = resolve;
    dispatchListenerID = vc.cc.dispatcher.register((e) => {
      if (
        // near-equivalent to vc.calc.observeEvent("change", ...)
        // but event "change" is not triggered for slider playing movement
        e.type === "on-evaluator-changes" &&
        // check waiting-for-update in case there is more than one update before the screenshot finishes
        vc.actionCaptureState === "waiting-for-update"
      ) {
        void captureActionFrame(vc, step);
      }
    });

    void captureActionFrame(vc, step);
  });
}

/** SegmentedControl does not plan for the list of names to change, so
 * force-reload the list of options by closing and re-opening the menu.
 * This is needed when action-capture stops sliders, so the slider-ticks
 * capture method option gets disabled. */
function forceReloadMenu(dsm: DSM) {
  // XXX: it would be better if SegmentedControl actually re-loaded options
  // A proper implementation is needed if we ever allow pinning the vc menu.
  const pm = dsm.pillboxMenus;
  if (!pm) return;
  if (pm.pillboxMenuOpen === "dsm-vc-menu") {
    pm.pillboxMenuOpen = null;
    pm.cc.updateViews();
    pm.pillboxMenuOpen = "dsm-vc-menu";
    pm.cc.updateViews();
  }
}

// const grapher3d = vc.cc.grapher3d;
// if (!grapher3d) throw new Error("Programming error: 3d but no grapher3d");
// setOrientation(grapher3d, orientationFromEuler(grapher3d, 1, ++a / 10));

export async function capture(vc: VideoCreator) {
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
      forceReloadMenu(vc.dsm);
    }
  }
  function stepOrientation() {
    const xyRot = vc.xyRot.getValue() + vc.xyRotStep.getValue();
    vc.xyRot.setLatexWithoutCallbacks(vc.angleToString(xyRot));
    const zTip = vc.zTip.getValue() + vc.zTipStep.getValue();
    vc.zTip.setLatexWithoutCallbacks(vc.angleToString(zTip));
    vc.updateOrientationFromLatex();
  }
  switch (vc.captureMethod) {
    case "action": {
      const step = () => {
        if (vc.currentActionID === null) return;
        stepOrientation();
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
        currTime += vc.getTickTimeStepNumber();
        stepOrientation();
        tickSliders(currTime);
      };
      await captureActionOrSliderTicks(vc, step);
      // restore the typical handling of slider ticking
      vc.cc._tickSliders = tickSliders;
      break;
    }
    case "once":
      try {
        await captureAndApplyFrame(vc);
      } catch {
        // math bounds mismatch, irrelevant
      }
      break;
    case "slider":
      await captureSlider(vc);
      break;
    default: {
      const exhaustiveCheck: never = vc.captureMethod;
      return exhaustiveCheck;
    }
  }
  vc.isCapturing = false;
  vc.actionCaptureState = "none";
  vc.updateView();
  if (dispatchListenerID !== null) {
    vc.cc.dispatcher.unregister(dispatchListenerID);
    dispatchListenerID = null;
  }
  // no need to retain a pending cancellation, if any; capture is already finished
  vc.captureCancelled = false;
}
