import { Calc, Bounds, EvaluateSingleExpression } from "desmodder";
import { boundsEqual } from "./utils";
import Controller from "../Controller";

export type CaptureMethod = "once" | "simulation" | "slider";

export interface CaptureSize {
  width: number;
  height: number;
}

export function captureSizesEqual(a: CaptureSize, b: CaptureSize) {
  return a.width === b.width && a.height === b.height;
}

export let captureCancelled = false;

export function cancelCapture() {
  captureCancelled = true;
}

async function captureAndApplyFrame(controller: Controller, isFirst: boolean) {
  const frame = await captureFrame(
    controller.expectedBounds ?? undefined,
    controller.expectedSize ?? undefined
  );
  controller.checkCaptureSize();
  // handle correct math bounds (which gets updated asynchronously) here;
  // probably is the same as the bounds used for the screenshot
  const bounds = Calc.graphpaperBounds.mathCoordinates;
  if (isFirst) {
    controller.expectedBounds = bounds;
  }
  if (
    controller.expectedBounds === null ||
    boundsEqual(bounds, controller.expectedBounds)
  ) {
    controller.frames.push(frame);
  } else {
    controller.mathBoundsMismatch();
    throw "Bounds changed during capture";
  }

  controller.updateView();
}

export async function captureFrame(
  expectedBounds: Bounds | undefined,
  expectedSize: CaptureSize | undefined
) {
  // resolves the screenshot as a data URI
  return new Promise<string>((resolve, reject) => {
    const tryCancel = () => {
      if (captureCancelled) {
        captureCancelled = false;
        reject("cancelled");
      }
    };
    tryCancel();
    // poll for mid-screenshot cancellation (only affects UI)
    const interval = window.setInterval(tryCancel, 50);
    Calc.asyncScreenshot(
      {
        showLabels: true,
        mode: "contain",
        preserveAxisLabels: true,
        // YOOO.... control `width` and `height` to be the same as start.
        // Still need to check & revert mathBounds bc people could have unintended
        // squish. But you just need to check graphpaper WIDTH and HEIGHT
        // in pixel coordinates
        mathBounds: expectedBounds,
        width: expectedSize ? expectedSize.width : undefined,
        height: expectedSize ? expectedSize.height : undefined,
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
      await captureAndApplyFrame(controller, i === 0);
    } catch {
      // should be paused due to mathBoundsMismatch or cancellation
      break;
    }
  }
}

async function captureSimulation(controller: Controller) {
  const whileLatex = controller.simulationWhileLatex;
  if (/^(\\?\s)*$/.test(whileLatex)) {
    // would give an infinite loop, probably unintended
    // use 1 > 0 for an intentional infinite loop
    return;
  }

  const helper = controller.getWhileLatexHelper();

  helper.observe("numericValue", async () => {
    helper.unobserve("numericValue");
    // WARNING: helper.numericValue is evaluated asynchronously,
    // so the stop condition may be missed in rare situations.
    // But it should be evaluated faster than the captureFrame in practice

    // syntax errors and false gives helper.numericValue === NaN
    // true gives helper.numericValue === 1
    let first = true;
    while (helper.numericValue === 1) {
      Calc.controller.dispatch({
        type: "simulation-single-step",
        id: controller.currentSimulationID,
      });
      try {
        await captureAndApplyFrame(controller, first);
        first = false;
      } catch {
        // should be paused due to mathBoundsMismatch or cancellation
        break;
      }
    }
  });
}

export async function capture(controller: Controller) {
  controller.isCapturing = true;
  controller.updateView();
  if (controller.captureMethod !== "once") {
    Calc.controller.stopPlayingSimulation();
    Calc.controller.stopAllSliders();
  }
  if (controller.captureMethod === "simulation") {
    if (controller.currentSimulationID) {
      await captureSimulation(controller);
    }
    // captureSimulation handles settings isCapturing to false
  } else {
    if (controller.captureMethod === "once") {
      try {
        await captureAndApplyFrame(controller, true);
      } catch {
        // math bounds mismatch, irrelevant
      }
    } else if (controller.captureMethod === "slider") {
      await captureSlider(controller);
    }
    controller.isCapturing = false;
    controller.updateView();
  }
  // no need to retain the pending cancellation; capture is already finished
  captureCancelled = false;
}
