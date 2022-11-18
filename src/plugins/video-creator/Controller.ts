import { updateView } from "./View";
import { CaptureMethod, SliderSettings, capture } from "./backend/capture";
import { OutFileType, exportFrames, initFFmpeg } from "./backend/export";
import { isValidNumber, isValidLength, escapeRegex } from "./backend/utils";
import { ExpressionModel } from "globals/models";
import { Calc } from "globals/window";
import { desModderController } from "script";
import { jquery, keys, EvaluateSingleExpression } from "utils/depUtils";

type FocusedMQ =
  | "none"
  | "capture-slider-var"
  | "capture-slider-min"
  | "capture-slider-max"
  | "capture-slider-step"
  | "capture-tick-count"
  | "capture-width"
  | "capture-height"
  | "export-fps";

const DEFAULT_FILENAME = "DesModder_Video_Creator";

export default class Controller {
  ffmpegLoaded = false;
  frames: string[] = [];
  isCapturing = false;
  captureCancelled = false;
  fpsLatex = "30";
  fileType: OutFileType = "mp4";
  outfileName: string | null = null;

  focusedMQ: FocusedMQ = "none";

  // ** export status
  isExporting = false;
  // -1 while pending/waiting
  // 0 to 1 during encoding
  exportProgress = -1;

  // ** capture methods
  captureMethod: CaptureMethod = "once";
  sliderSettings: SliderSettings = {
    variable: "a",
    minLatex: "0",
    maxLatex: "10",
    stepLatex: "1",
  };
  actionCaptureState: "none" | "waiting-for-update" | "waiting-for-screenshot" =
    "none";
  currentActionID: string | null = null;
  tickCountLatex: string = "10";

  // ** capture sizing
  captureHeightLatex = "";
  captureWidthLatex = "";
  samePixelRatio = false;

  // ** play preview
  previewIndex = 0;
  isPlayingPreview = false;
  playPreviewTimeout: number | null = null;
  isPlayPreviewExpanded = false;

  constructor() {
    Calc.observe("graphpaperBounds", () => this.graphpaperBoundsChanged());
    this._applyDefaultCaptureSize();
  }

  graphpaperBoundsChanged() {
    this.updateView();
  }

  updateView() {
    updateView();
  }

  tryInitFFmpeg() {
    initFFmpeg(this).then(() => {
      this.ffmpegLoaded = true;
      this.updateView();
    });
  }

  deleteAll() {
    this.frames = [];
    this.updateView();
  }

  async exportFrames() {
    if (!this.isExporting) {
      await exportFrames(this);
    }
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

  setOutfileName(name: string) {
    this.outfileName = name;
  }

  getOutfileName() {
    return (
      this.outfileName ??
      desModderController.topLevelComponents.graphsController.getCurrentGraphTitle() ??
      DEFAULT_FILENAME
    );
  }

  setCaptureMethod(method: CaptureMethod) {
    this.captureMethod = method;
    this.updateView();
  }

  isCaptureWidthValid() {
    return isValidLength(this.captureWidthLatex);
  }

  setCaptureWidthLatex(latex: string) {
    this.captureWidthLatex = latex;
    this.updateView();
  }

  isCaptureHeightValid() {
    return isValidLength(this.captureHeightLatex);
  }

  _applyDefaultCaptureSize() {
    const size = Calc.graphpaperBounds.pixelCoordinates;
    this.captureWidthLatex = size.width.toFixed(0);
    this.captureHeightLatex = size.height.toFixed(0);
  }

  applyDefaultCaptureSize() {
    this._applyDefaultCaptureSize();
    this.updateView();
  }

  isDefaultCaptureSizeDifferent() {
    const size = Calc.graphpaperBounds.pixelCoordinates;
    return (
      this.captureWidthLatex !== size.width.toFixed(0) ||
      this.captureHeightLatex !== size.height.toFixed(0)
    );
  }

  setCaptureHeightLatex(latex: string) {
    this.captureHeightLatex = latex;
    this.updateView();
  }

  getCaptureWidthNumber() {
    return EvaluateSingleExpression(this.captureWidthLatex);
  }

  getCaptureHeightNumber() {
    return EvaluateSingleExpression(this.captureHeightLatex);
  }

  setSamePixelRatio(samePixelRatio: boolean) {
    this.samePixelRatio = samePixelRatio;
    this.updateView();
  }

  _getTargetPixelRatio() {
    return (
      this.getCaptureWidthNumber() /
      Calc.graphpaperBounds.pixelCoordinates.width
    );
  }

  getTargetPixelRatio() {
    return this.samePixelRatio ? 1 : this._getTargetPixelRatio();
  }

  setSliderSetting<T extends keyof SliderSettings>(
    key: T,
    value: SliderSettings[T]
  ) {
    this.sliderSettings[key] = value;
    this.updateView();
  }

  setTickCountLatex(value: string) {
    this.tickCountLatex = value;
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

  isTickCountValid() {
    return (
      isValidNumber(this.tickCountLatex) &&
      EvaluateSingleExpression(this.tickCountLatex) > 0
    );
  }

  async capture() {
    await capture(this);
  }

  areCaptureSettingsValid() {
    if (!this.isCaptureWidthValid() || !this.isCaptureHeightValid()) {
      return false;
    }
    if (this.captureMethod === "once") {
      return true;
    } else if (this.captureMethod === "slider") {
      return (
        this.isSliderSettingValid("variable") &&
        this.isSliderSettingValid("minLatex") &&
        this.isSliderSettingValid("maxLatex") &&
        this.isSliderSettingValid("stepLatex")
      );
    } else if (this.captureMethod === "action") {
      return this.isTickCountValid();
    }
  }

  getActions() {
    return Calc.controller
      .getAllItemModels()
      .filter(
        (e) => e.type === "expression" && e.formula?.action_value !== undefined
      ) as ExpressionModel[];
  }

  hasAction() {
    return this.getActions().length > 0;
  }

  getCurrentAction() {
    const model = Calc.controller.getItemModel(this.currentActionID);
    if (model === undefined) {
      const action = this.getActions()[0];
      if (action !== undefined) {
        this.currentActionID = action.id;
      }
      return action;
    } else {
      return model as ExpressionModel;
    }
  }

  addToActionIndex(dx: number) {
    const actions = this.getActions();
    const currentActionIndex = actions.findIndex(
      (e) => e.id === this.currentActionID
    );
    // add actions.length to handle (-1) % n = -1
    const action =
      actions[(currentActionIndex + actions.length + dx) % actions.length];
    if (action !== undefined) {
      this.currentActionID = action.id;
    }
    this.updateView();
  }

  addToPreviewIndex(dx: number) {
    if (this.frames.length > 0) {
      this.previewIndex += dx;
      this.previewIndex %= this.frames.length;
    } else {
      this.previewIndex = 0;
    }
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
        "keydown.dsm-vc-preview-expanded",
        (e: KeyboardEvent) => {
          if (keys.lookup(e) === "Esc") {
            this.togglePreviewExpanded();
          }
        }
      );
    } else {
      jquery(document).off("keydown.dsm-vc-preview-expanded");
    }
    this.updateView();
  }

  removeSelectedFrame() {
    this.frames.splice(this.previewIndex, 1);
    if (this.previewIndex >= this.frames.length) {
      this.previewIndex = this.frames.length - 1;
    }
    if (this.frames.length === 0) {
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
