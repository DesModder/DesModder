import { updateView } from "./View";
import {
  Calc,
  SimulationModel,
  jquery,
  keys,
  Bounds,
  EvaluateSingleExpression,
} from "desmodder";
import { boundsEqual, isValidNumber, escapeRegex } from "./backend/utils";
import { OutFileType, exportFrames } from "./backend/export";
import {
  CaptureMethod,
  SliderSettings,
  capture,
  captureSizesEqual,
  CaptureSize,
} from "./backend/capture";

type FocusedMQ =
  | "none"
  | "capture-slider-var"
  | "capture-slider-min"
  | "capture-slider-max"
  | "capture-slider-step"
  | "capture-simulation-while"
  | "export-fps";

export default class Controller {
  frames: string[] = [];
  isCapturing = false;
  fpsLatex = "30";
  fileType: OutFileType = "gif";

  focusedMQ: FocusedMQ = "none";

  // ** export status
  isExporting = false;
  // -1 while pending/waiting
  // 0 to 1 during encoding
  exportProgress = 0;

  // ** capture methods
  captureMethod: CaptureMethod = "once";
  sliderSettings: SliderSettings = {
    variable: "a",
    minLatex: "0",
    maxLatex: "10",
    stepLatex: "1",
  };
  currentSimulationID: string | null = null;
  simulationWhileLatex = "";
  _isWhileLatexValid = false;
  whileLatexHelper: ReturnType<typeof Calc.HelperExpression> | null = null;

  // ** play preview
  previewIndex = 0;
  isPlayingPreview = false;
  playPreviewTimeout: number | null = null;
  isPlayPreviewExpanded = false;

  // ** bounds
  expectedBounds: Bounds | null = null;
  areMathBoundsDifferent = false;
  expectedSize: CaptureSize | null = null;
  isCaptureSizeDifferent = false;

  constructor() {
    Calc.observe("graphpaperBounds", () => this.graphpaperBoundsChanged());
  }

  updateView() {
    updateView();
  }

  checkCaptureSize() {
    const size = Calc.graphpaperBounds.pixelCoordinates;
    if (this.expectedSize !== null) {
      const diff = !captureSizesEqual(this.expectedSize, size);
      if (diff !== this.isCaptureSizeDifferent) {
        this.isCaptureSizeDifferent = diff;
        this.updateView();
      }
    } else {
      this.expectedSize = size;
    }
  }

  graphpaperBoundsChanged() {
    // if expectedBounds has not been initialized yet, then
    // there are no constraints on the bounds, so we
    // do not have to worry about fixing or mismatch
    if (this.expectedBounds !== null) {
      if (
        boundsEqual(Calc.graphpaperBounds.mathCoordinates, this.expectedBounds)
      ) {
        if (this.areMathBoundsDifferent) {
          this.mathBoundsFixed();
        }
      } else {
        this.mathBoundsMismatch();
      }
    }
  }

  mathBoundsMismatch() {
    this.areMathBoundsDifferent = true;
    this.updateView();
  }

  mathBoundsFixed() {
    this.areMathBoundsDifferent = false;
    this.updateView();
  }

  resetMathBounds() {
    if (this.expectedBounds !== null) {
      // setMathBounds calls graphpaperBoundsChanged via the observed
      // graphpaperBounds property
      Calc.setMathBounds(this.expectedBounds);
    }
  }

  deleteAll() {
    this.frames = [];
    this.updateView();
  }

  exportFrames() {
    exportFrames(this);
  }

  setExportProgress(ratio: number) {
    this.exportProgress = ratio;
    this.updateView();
  }

  isFPSValid() {
    return isValidNumber(this.fpsLatex);
  }

  setFPSLatex(latex: string) {
    this.fpsLatex = latex;
    // advancing here resets the timeout
    // in case someone uses a low fps like 0.0001
    this.advancePlayPreviewFrame(false);
    this.updateView();
  }

  getFPSNumber() {
    return EvaluateSingleExpression(this.fpsLatex);
  }

  setOutputFiletype(type: OutFileType) {
    this.fileType = type;
    this.updateView();
  }

  setCaptureMethod(method: CaptureMethod) {
    this.captureMethod = method;
    this.updateView();
  }

  setSliderSetting<T extends keyof SliderSettings>(
    key: T,
    value: SliderSettings[T]
  ) {
    this.sliderSettings[key] = value;
    this.updateView();
  }

  getMatchingSlider() {
    const regex = new RegExp(
      `^(\\?\s)*${escapeRegex(this.sliderSettings.variable)}(\\?\s)*=`
    );
    return Calc.getState().expressions.list.find(
      (e) =>
        e.type === "expression" &&
        typeof e.latex === "string" &&
        regex.test(e.latex)
    );
  }

  isSliderSettingValid<T extends keyof SliderSettings>(key: T) {
    if (key === "variable") {
      return this.getMatchingSlider() !== undefined;
    } else {
      return isValidNumber(this.sliderSettings[key]);
    }
  }

  isWhileLatexValid() {
    return this._isWhileLatexValid;
  }

  async capture() {
    await capture(this);
  }

  areCaptureSettingsValid() {
    if (this.captureMethod === "once") {
      return true;
    } else if (this.captureMethod === "slider") {
      return (
        this.isSliderSettingValid("variable") &&
        this.isSliderSettingValid("minLatex") &&
        this.isSliderSettingValid("maxLatex") &&
        this.isSliderSettingValid("stepLatex")
      );
    } else if (this.captureMethod === "simulation") {
      return this.isWhileLatexValid();
    }
  }

  getWhileLatexHelper() {
    return Calc.HelperExpression({
      latex: `\\left\\{${this.simulationWhileLatex}:1, 0\\right\\}`,
    });
  }

  setSimulationWhileLatex(s: string) {
    this.simulationWhileLatex = s;
    if (this.whileLatexHelper !== null) {
      this.whileLatexHelper.unobserve("numericValue");
    }
    const helper = this.getWhileLatexHelper();
    // stored for the purpose of unobserving
    this.whileLatexHelper = helper;
    helper.observe("numericValue", () => {
      // must start with 'true'
      const newIsWhileLatexValid = helper.numericValue === 1;
      if (newIsWhileLatexValid !== this._isWhileLatexValid) {
        this._isWhileLatexValid = newIsWhileLatexValid;
        this.updateView();
      }
    });
    this.updateView();
  }

  getSimulations() {
    return Calc.getState().expressions.list.filter(
      (e) => e.type === "simulation"
    ) as SimulationModel[];
  }

  getCurrentSimulation() {
    const model = Calc.controller.getItemModel(this.currentSimulationID);
    if (model === undefined) {
      // default simulation
      const sim = this.getSimulations()[0];
      if (sim !== undefined) {
        this.currentSimulationID = sim.id;
      }
      return sim;
    } else {
      return model as SimulationModel;
    }
  }

  currentSimulationIndex() {
    return this.getSimulations().findIndex(
      (e) => e.id === this.currentSimulationID
    );
  }

  hasSimulation() {
    return this.getSimulations().length > 0;
  }

  addToSimulationIndex(dx: number) {
    const sims = this.getSimulations();
    // add sims.length to handle (-1) % n = -1
    const sim =
      sims[(this.currentSimulationIndex() + sims.length + dx) % sims.length];
    if (sim !== undefined) {
      this.currentSimulationID = sim.id;
    }
    this.updateView();
  }

  addToPreviewIndex(dx: number) {
    this.previewIndex += dx;
    this.previewIndex %= this.frames.length;
    this.updateView();
  }

  advancePlayPreviewFrame(advance = true) {
    this.addToPreviewIndex(advance ? 1 : 0);
    const fps = this.getFPSNumber();
    if (this.isPlayingPreview) {
      if (this.playPreviewTimeout !== null) {
        window.clearTimeout(this.playPreviewTimeout);
      }
      this.playPreviewTimeout = window.setTimeout(() => {
        this.advancePlayPreviewFrame();
      }, 1000 / fps);
    }
  }

  togglePlayingPreview() {
    this.isPlayingPreview = !this.isPlayingPreview;
    if (this.frames.length <= 1) {
      this.isPlayingPreview = false;
    }
    this.updateView();

    if (this.isPlayingPreview) {
      this.advancePlayPreviewFrame();
    } else {
      if (this.playPreviewTimeout !== null) {
        clearInterval(this.playPreviewTimeout);
      }
    }
  }

  togglePreviewExpanded() {
    this.isPlayPreviewExpanded = !this.isPlayPreviewExpanded;
    if (this.isPlayPreviewExpanded) {
      jquery(document).on(
        "keydown.video-creator-preview-expanded",
        (e: KeyboardEvent) => {
          if (keys.lookup(e) === "Esc") {
            this.togglePreviewExpanded();
          }
        }
      );
    } else {
      jquery(document).off("keydown.video-creator-preview-expanded");
    }
    this.updateView();
  }

  removeSelectedFrame() {
    this.frames.splice(this.previewIndex, 1);
    if (this.previewIndex >= this.frames.length) {
      this.previewIndex = this.frames.length - 1;
    }
    if (this.frames.length === 0) {
      this.expectedSize = null;
      this.expectedBounds = null;
      this.isCaptureSizeDifferent = false;
      if (this.areMathBoundsDifferent) {
        this.mathBoundsFixed();
      }
      if (this.isPlayPreviewExpanded) {
        this.togglePreviewExpanded();
      }
    }
    if (this.frames.length <= 1 && this.isPlayingPreview) {
      this.togglePlayingPreview();
    }
    this.updateView();
  }

  updateFocus(location: FocusedMQ, isFocused: boolean) {
    if (isFocused) {
      this.focusedMQ = location;
    } else if (location === this.focusedMQ) {
      this.focusedMQ = "none";
    }
    this.updateView();
  }

  isFocused(location: FocusedMQ) {
    return this.focusedMQ === location;
  }
}
