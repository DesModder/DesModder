import { Calc, EvaluateSingleExpression } from "desmodder";
import { scaleBoundsAboutCenter } from "./utils";
import Controller from "../Controller";

export type CaptureMethod = "once" | "simulation" | "slider";

export let captureCancelled = false;

export function cancelCapture() {
  captureCancelled = true;
}

async function captureAndApplyFrame(controller: Controller) {
  const frame = await captureFrame(
    controller.getCaptureWidthNumber(),
    controller.getCaptureHeightNumber()
  );
  controller.frames.push(frame);

  controller.updateView();
}

export async function captureFrame(width: number, height: number) {
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
    const mathBounds = Calc.graphpaperBounds.mathCoordinates;
    const ratio = height / width / (mathBounds.height / mathBounds.width);
    // make the captured region entirely visible
    const clampedMathBounds = scaleBoundsAboutCenter(
      mathBounds,
      Math.min(ratio, 1 / ratio)
    );
    Calc.asyncScreenshot(
      {
        width: width,
        height: height,
        showLabels: true,
        preserveAxisLabels: true,
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
    while (helper.numericValue === 1) {
      Calc.controller.dispatch({
        type: "simulation-single-step",
        id: controller.currentSimulationID,
      });
      try {
        await captureAndApplyFrame(controller);
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
        await captureAndApplyFrame(controller);
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
