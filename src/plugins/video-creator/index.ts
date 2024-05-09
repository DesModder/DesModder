import { PluginController } from "../PluginController";
import { updateView } from "./View";
import {
  CANCELLED,
  CaptureMethod,
  SliderSettings,
  capture,
} from "./backend/capture";
import { OutFileType, exportFrames, initFFmpeg } from "./backend/export";
import { escapeRegex } from "./backend/utils";
import { MainPopupFunc } from "./components/MainPopup";
import { ExpressionModel } from "#globals";
import {
  keys,
  EvaluateSingleExpression,
  getCurrentGraphTitle,
} from "#utils/depUtils.ts";
import {
  ManagedNumberInputModel,
  ManagedNumberInputModelOpts,
} from "./components/ManagedNumberInput";
import { Orientation } from "./orientation";

type FocusedMQ = string;

const DEFAULT_FILENAME = "DesModder_Video_Creator";

export default class VideoCreator extends PluginController {
  static id = "video-creator" as const;
  static enabledByDefault = true;

  ffmpegLoaded = false;
  frames: string[] = [];
  isCapturing = false;
  captureCancelled = false;
  callbackIfCancel?: () => void;
  dispatchListenerID?: string;
  updateSeen = false;
  callbackIfUpdate?: () => void;
  readonly fps = this.managedNumberInputModel("30", {
    afterLatexChanged: () => {
      // advancing here resets the timeout
      // in case someone uses a low fps like 0.0001
      this.advancePlayPreviewFrame(false);
    },
  });

  fileType: OutFileType = "mp4";
  outfileName: string | null = null;

  focusedMQ: FocusedMQ = "none";

  // ** export status
  isExporting = false;
  // -1 while pending/waiting
  // 0 to 1 during encoding
  exportProgress = -1;

  // ** capture methods
  #captureMethod: CaptureMethod = "once";
  sliderVariable = "a";
  readonly sliderSettings: SliderSettings = {
    min: this.managedNumberInputModel("0"),
    max: this.managedNumberInputModel("10"),
    step: this.managedNumberInputModel("1"),
  };

  actionCaptureState: "none" | "waiting-for-update" | "waiting-for-screenshot" =
    "none";

  currentActionID: string | null = null;
  readonly tickCount = this.managedNumberInputModel("10");
  readonly tickTimeStep = this.managedNumberInputModel("40");

  // ** capture sizing
  readonly captureHeight = this.managedNumberInputModel("");
  readonly captureWidth = this.managedNumberInputModel("");
  samePixelRatio = false;

  readonly or = new Orientation(this);

  // ** play preview
  previewIndex = 0;
  isPlayingPreview = false;
  playPreviewTimeout: number | null = null;
  isPlayPreviewExpanded = false;

  managedNumberInputModel(
    initLatex: string,
    opts?: ManagedNumberInputModelOpts
  ) {
    return new ManagedNumberInputModel(initLatex, this.calc, {
      ...opts,
      afterLatexChanged: () => {
        opts?.afterLatexChanged?.();
        this.updateView();
      },
    });
  }

  onKeydown = this._onKeydown.bind(this);
  _onKeydown(e: KeyboardEvent) {
    if (keys.lookup(e) === "Esc" && this.isPlayPreviewExpanded) {
      e.stopImmediatePropagation();
      this.togglePreviewExpanded();
    }
  }

  isMenuOpen() {
    return this.dsm.pillboxMenus?.pillboxMenuOpen === "dsm-vc-menu";
  }

  afterEnable() {
    this.calc.observe("graphpaperBounds", () => this.graphpaperBoundsChanged());
    this._applyDefaultCaptureSize();
    this.or.afterEnable();
    this.dsm.pillboxMenus?.addPillboxButton({
      id: "dsm-vc-menu",
      tooltip: "video-creator-menu",
      iconClass: "dcg-icon-film",
      popup: () => MainPopupFunc(this),
    });
    document.addEventListener("keydown", this.onKeydown);
  }

  afterDisable() {
    this.dsm.pillboxMenus?.removePillboxButton("dsm-vc-menu");
    document.removeEventListener("keydown", this.onKeydown);
    this.or.afterDisable();
  }

  graphpaperBoundsChanged() {
    this.updateView();
  }

  updateView() {
    updateView(this);
  }

  async tryInitFFmpeg() {
    await initFFmpeg(this);
    this.ffmpegLoaded = true;
    this.updateView();
  }

  deleteAll() {
    this.frames = [];
    this.previewIndex = 0;
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
    const v = this.fps.getValue();
    return v >= 0;
  }

  getFPSNumber() {
    return this.fps.getValue();
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
      this.outfileName ?? getCurrentGraphTitle(this.calc) ?? DEFAULT_FILENAME
    );
  }

  set captureMethod(method: CaptureMethod) {
    this.#captureMethod = method;
    // TODO-updateView
    this.updateView();
  }

  get captureMethod() {
    return this.isCaptureMethodValid(this.#captureMethod)
      ? this.#captureMethod
      : this.isCaptureMethodValid("once")
      ? "once"
      : "ntimes";
  }

  isValidNumber(s: string) {
    return !isNaN(this.eval(s));
  }

  isValidLength(s: string) {
    const evaluated = this.eval(s);
    return !isNaN(evaluated) && evaluated >= 2;
  }

  eval(s: string) {
    return EvaluateSingleExpression(this.calc, s);
  }

  isCaptureMethodValid(method: CaptureMethod) {
    switch (method) {
      case "action":
        return this.hasAction();
      case "ticks":
        return this.cc.getPlayingSliders().length > 0 || this.cc.is3dProduct();
      case "slider":
        return true;
      case "once":
        return !this.or.orientationModeRequiresStepCount();
      case "ntimes":
        return this.or.orientationModeRequiresStepCount();
    }
  }

  isCaptureWidthValid() {
    return isValidLength(this.captureWidth.getValue());
  }

  isCaptureHeightValid() {
    return isValidLength(this.captureHeight.getValue());
  }

  _applyDefaultCaptureSize() {
    const size = this.calc.graphpaperBounds.pixelCoordinates;
    this.captureWidth.setLatexWithCallbacks(size.width.toFixed(0));
    this.captureHeight.setLatexWithCallbacks(size.height.toFixed(0));
  }

  applyDefaultCaptureSize() {
    this._applyDefaultCaptureSize();
    this.updateView();
  }

  isDefaultCaptureSizeDifferent() {
    const size = this.calc.graphpaperBounds.pixelCoordinates;
    return (
      this.captureWidth.getValue() !== Math.round(size.width) ||
      this.captureHeight.getValue() !== Math.round(size.height)
    );
  }

  getCaptureWidthNumber() {
    return this.captureWidth.getValue();
  }

  getCaptureHeightNumber() {
    return this.captureHeight.getValue();
  }

  setSamePixelRatio(samePixelRatio: boolean) {
    this.samePixelRatio = samePixelRatio;
    this.updateView();
  }

  _getTargetPixelRatio() {
    return (
      this.captureWidth.getValue() /
      this.calc.graphpaperBounds.pixelCoordinates.width
    );
  }

  getTargetPixelRatio() {
    return this.samePixelRatio ? 1 : this._getTargetPixelRatio();
  }

  getTickTimeStepNumber() {
    return this.tickTimeStep.getValue();
  }

  isTickTimeStepValid() {
    const ts = this.getTickTimeStepNumber();
    return !isNaN(ts) && ts > 0;
  }

  getMatchingSlider() {
    const regex = new RegExp(
      `^(\\\\?\\s)*${escapeRegex(this.sliderVariable)}(\\\\?\\s)*=`
    );
    return this.calc
      .getState()
      .expressions.list.find(
        (e) =>
          e.type === "expression" &&
          typeof e.latex === "string" &&
          regex.test(e.latex)
      );
  }

  setSliderVariable(s: string) {
    this.sliderVariable = s;
  }

  isSliderVariableValid() {
    return this.getMatchingSlider() !== undefined;
  }

  isSliderSettingValid<T extends keyof SliderSettings>(key: T) {
    return !isNaN(this.sliderSettings[key].getValue());
  }

  getTickCountNumber() {
    return this.tickCount.getValue();
  }

  isTickCountValid() {
    const tc = this.getTickCountNumber();
    return Number.isInteger(tc) && tc > 0;
  }

  async capture() {
    await capture(this);
  }

  areCaptureSettingsValid() {
    // TODO: don't care about e.g. "from" when doing "step" capture, etc.
    if (!this.or.areCaptureSettingsValid()) return false;
    if (!this.isCaptureWidthValid() || !this.isCaptureHeightValid())
      return false;
    switch (this.captureMethod) {
      case "once":
        return true;
      case "ntimes":
        return this.isTickCountValid();
      case "slider":
        return (
          this.isSliderVariableValid() &&
          this.isSliderSettingValid("min") &&
          this.isSliderSettingValid("max") &&
          this.isSliderSettingValid("step")
        );
      case "action":
        return this.isTickCountValid();
      case "ticks":
        return this.isTickCountValid() && this.isTickTimeStepValid();
      default: {
        const exhaustiveCheck: never = this.captureMethod;
        return exhaustiveCheck;
      }
    }
  }

  getActions() {
    return this.cc
      .getAllItemModels()
      .filter(
        (e) => e.type === "expression" && e.formula?.action_value !== undefined
      ) as ExpressionModel[];
  }

  hasAction() {
    return this.getActions().length > 0;
  }

  getCurrentAction() {
    const model = this.cc.getItemModel(this.currentActionID);
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
      this.previewIndex += this.frames.length;
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

  pushFrame(frame: string) {
    if (
      !this.isPlayingPreview &&
      this.previewIndex === this.frames.length - 1
    ) {
      this.previewIndex++;
    }
    this.frames.push(frame);
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

  cancelCapture() {
    if (this.callbackIfCancel) {
      this.callbackIfCancel();
    } else {
      this.captureCancelled = true;
    }
  }

  async awaitCancel(): Promise<typeof CANCELLED> {
    return await new Promise((resolve) => {
      if (this.captureCancelled) {
        resolve(CANCELLED);
        return;
      }
      this.callbackIfCancel = () => {
        this.callbackIfCancel = undefined;
        resolve(CANCELLED);
      };
    });
  }

  registerUpdateListener() {
    this.dispatchListenerID = this.cc.dispatcher.register((e) => {
      if (
        // near-equivalent to vc.calc.observeEvent("change", ...)
        // but event "change" is not triggered for slider playing movement
        e.type === "on-evaluator-changes"
      ) {
        this.gotUpdate();
      }
    });
  }

  unregisterUpdateListener() {
    if (this.dispatchListenerID !== undefined) {
      this.cc.dispatcher.unregister(this.dispatchListenerID);
      this.dispatchListenerID = undefined;
    }
  }

  private gotUpdate() {
    if (!this.isCapturing) {
      this.unregisterUpdateListener();
      return;
    }
    if (this.callbackIfUpdate) {
      this.callbackIfUpdate();
    } else {
      this.updateSeen = true;
    }
  }

  async awaitUpdate() {
    await new Promise<void>((resolve) => {
      if (this.updateSeen) {
        resolve();
        return;
      }
      this.callbackIfUpdate = () => {
        this.callbackIfUpdate = undefined;
        resolve();
      };
    });
  }
}

function isValidLength(v: number) {
  return !isNaN(v) && v >= 2;
}
