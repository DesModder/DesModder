import { Calc } from "globals/window";
import { EvaluateSingleExpression } from "utils/depUtils";
import { scaleBoundsAboutCenter } from "./utils";
import Controller from "../Controller";

export type CaptureMethod = "once" | "action" | "slider";

export function cancelCapture(controller: Controller) {
  controller.captureCancelled = true;

  if (controller.actionCaptureState !== "none") {
    cancelActionCapture(controller);
  }
}

async function captureAndApplyFrame(controller: Controller) {
  const frame = await captureFrame(controller);
  controller.frames.push(frame);
  controller.updateView();
}

export async function captureFrame(controller: Controller) {
  const width = controller.getCaptureWidthNumber();
  const height = controller.getCaptureHeightNumber();
  const targetPixelRatio = controller.getTargetPixelRatio();
  // resolves the screenshot as a data URI
  return new Promise<string>((resolve, reject) => {
    const tryCancel = () => {
      if (controller.captureCancelled) {
        controller.captureCancelled = false;
        reject("cancelled");
      }
    };
    tryCancel();
    // poll for mid-screenshot cancellation (only affects UI)
    const interval = window.setInterval(tryCancel, 50);
    const pixelBounds = Calc.graphpaperBounds.pixelCoordinates;
    const ratio = height / width / (pixelBounds.height / pixelBounds.width);
    const mathBounds = Calc.graphpaperBounds.mathCoordinates;
    // make the captured region entirely visible
    const clampedMathBounds = scaleBoundsAboutCenter(
      mathBounds,
      Math.min(ratio, 1 / ratio)
    );
    Calc.asyncScreenshot(
      {
        width: width / targetPixelRatio,
        targetPixelRatio: targetPixelRatio,
        height: height / targetPixelRatio,
        showLabels: true,
        preserveAxisNumbers: true,
        mathBounds: clampedMathBounds,
      },
      (data) => {
        clearInterval(interval);
        resolve(data);
      }
    );
  });
}

export interface SliderSettings {
  variable: string;
  minLatex: string;
  maxLatex: string;
  stepLatex: string;
}

export async function captureSlider(controller: Controller) {
  const sliderSettings = controller.sliderSettings;
  const variable = sliderSettings.variable;
  const min = EvaluateSingleExpression(sliderSettings.minLatex);
  const max = EvaluateSingleExpression(sliderSettings.maxLatex);
  const step = EvaluateSingleExpression(sliderSettings.stepLatex);
  const slider = controller.getMatchingSlider();
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
    Calc.setExpression({
      id: slider.id,
      latex: `${variable}=${value}`,
    });
    try {
      await captureAndApplyFrame(controller);
    } catch {
      // should be paused due to cancellation
      break;
    }
  }
}

function cancelActionCapture(controller: Controller) {
  controller.isCapturing = false;
  controller.actionCaptureState = "none";
  controller.updateView();
  Calc.unobserveEvent("change.dsm-action-change");
}

async function captureActionFrame(
  controller: Controller,
  callbackIfCancel: () => void
) {
  let stepped = false;
  try {
    const tickCountRemaining = EvaluateSingleExpression(
      controller.tickCountLatex
    );
    if (tickCountRemaining > 0) {
      controller.actionCaptureState = "waiting-for-screenshot";
      await captureAndApplyFrame(controller);
      controller.setTickCountLatex(String(tickCountRemaining - 1));
      controller.actionCaptureState = "waiting-for-update";
      if (tickCountRemaining - 1 > 0 && controller.currentActionID !== null) {
        Calc.controller.dispatch({
          type: "action-single-step",
          id: controller.currentActionID,
        });
        stepped = true;
      }
    }
  } catch {
  } finally {
    if (!stepped) {
      // should be paused due to cancellation or tickCountRemaining ≤ 0
      // this is effectively a break
      cancelActionCapture(controller);
      callbackIfCancel();
    }
  }
}

async function captureAction(controller: Controller) {
  return new Promise<void>((resolve) => {
    Calc.observeEvent("change.dsm-action-change", () => {
      // check in case there is more than one update before the screenshot finishes
      if (controller.actionCaptureState === "waiting-for-update") {
        captureActionFrame(controller, resolve);
      }
    });

    captureActionFrame(controller, resolve);
  });
}

export async function capture(controller: Controller) {
  controller.isCapturing = true;
  controller.updateView();
  if (controller.captureMethod !== "once") {
    if (Calc.controller.getTickerPlaying?.()) {
      Calc.controller.dispatch({ type: "toggle-ticker" });
    }
    Calc.controller.stopAllSliders();
  }
  if (controller.captureMethod === "action") {
    await captureAction(controller);
  } else {
    if (controller.captureMethod === "once") {
      try {
        await captureAndApplyFrame(controller);
      } catch {
        // math bounds mismatch, irrelevant
      }
    } else if (controller.captureMethod === "slider") {
      await captureSlider(controller);
    }
  }
  controller.isCapturing = false;
  controller.updateView();
  // no need to retain a pending cancellation, if any; capture is already finished
  controller.captureCancelled = false;
}
