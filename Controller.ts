import { updateView } from "./View";
import {
  Calc,
  SimulationModel,
  jquery,
  keys,
  Bounds,
  EvaluateSingleExpression,
} from "desmodder";

// kinda jank, but switching to moduleResolution: 'node' messes up
// existing non-relative imports
import {
  createFFmpeg,
  fetchFile,
} from "./node_modules/@ffmpeg/ffmpeg/src/index.js";

type PNGDataURI = string;
export type OutFileType = "gif" | "mp4" | "webm";
type FFmpeg = ReturnType<typeof createFFmpeg>;
export type CaptureMethod = "once" | "simulation" | "slider";
interface SliderSettings {
  variable: string;
  minLatex: string;
  maxLatex: string;
  stepLatex: string;
}

function isValidNumber(s: string) {
  return !isNaN(EvaluateSingleExpression(s));
}

function boundsEqual(a: Bounds, b: Bounds) {
  return (
    a.left === b.left &&
    a.right === b.right &&
    a.top === b.top &&
    a.bottom === b.bottom
  );
}

interface CaptureSize {
  width: number;
  height: number;
}

function captureSizesEqual(a: CaptureSize, b: CaptureSize) {
  return a.width === b.width && a.height === b.height;
}

type FocusedMQ =
  | "none"
  | "capture-slider-var"
  | "capture-slider-min"
  | "capture-slider-max"
  | "capture-slider-step"
  | "capture-simulation-while"
  | "export-fps";

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default class Controller {
  frames: PNGDataURI[] = [];
  isCapturing = false;
  fpsLatex = "30";
  fileType: OutFileType = "gif";

  focusedMQ: FocusedMQ = "none";

  // ** export status
  isExporting = false;
  // -1 while pending/waiting
  // 0 to 1 during encoding
  exportProgress = 0;
  ffmpeg: null | FFmpeg = null;

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
  captureCancelled: boolean = false;

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

  cancelCapture() {
    this.captureCancelled = true;
  }

  deleteAll() {
    this.frames = [];
    this.updateView();
  }

  async captureFrame(isFirst: boolean) {
    return new Promise<void>((resolve, reject) => {
      // we will allow different math bounds
      // if (this.areMathBoundsDifferent) {
      //   reject('bounds invalid from earlier')
      // }

      const tryCancel = () => {
        if (this.captureCancelled) {
          this.captureCancelled = false;
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
          mathBounds: this.expectedBounds ?? undefined,
          width: this.expectedSize ? this.expectedSize.width : undefined,
          height: this.expectedSize ? this.expectedSize.height : undefined,
        },
        (data) => {
          clearInterval(interval);
          this.checkCaptureSize();
          // handle correct math bounds (which gets updated asynchronously) here;
          // probably is the same as the bounds used for the screenshot
          this.frames.push(data);
          this.updateView();
          const bounds = Calc.graphpaperBounds.mathCoordinates;
          if (isFirst) {
            this.expectedBounds = bounds;
          }
          if (
            this.expectedBounds === null ||
            boundsEqual(bounds, this.expectedBounds)
          ) {
            resolve();
          } else {
            this.mathBoundsMismatch();
            reject("bounds changed during capture");
          }
        }
      );
    });
  }

  setExportProgress(ratio: number) {
    this.exportProgress = ratio;
    this.updateView();
  }

  async export(ffmpeg: FFmpeg) {
    const outFilename = "out." + this.fileType;

    const moreFlags = {
      mp4: ["-vcodec", "libx264"],
      webm: ["-vcodec", "libvpx-vp9", "-quality", "realtime", "-speed", "8"],
      // generate fresh palette on every frame (higher quality)
      // https://superuser.com/a/1239082
      gif: [
        "-lavfi",
        "palettegen=stats_mode=single[pal],[0:v][pal]paletteuse=new=1",
      ],
    }[this.fileType];

    const fps = EvaluateSingleExpression(this.fpsLatex);

    await ffmpeg.run(
      "-r",
      fps.toString(),
      "-pattern_type",
      "glob",
      "-i",
      "*.png",
      // average video bitrate. May have room for improvements
      "-b:v",
      "2M",
      ...moreFlags,
      outFilename
    );

    return outFilename;
  }

  async exportFrames() {
    this.setExportProgress(-1);

    // reference https://gist.github.com/SlimRunner/3b0a7571f04d3a03bff6dbd9de6ad729#file-desmovie-user-js-L278
    if (this.ffmpeg === null) {
      this.ffmpeg = createFFmpeg({ log: false });
      this.ffmpeg.setLogger(({ type, message }) => {
        if (type === "fferr") {
          const match = message.match(/frame=\s*(?<frame>\d+)/);
          if (match === null) {
            return;
          } else {
            const frame = (match.groups as { frame: string }).frame;
            let denom = this.frames.length - 1;
            if (denom === 0) denom = 1;
            const ratio = parseInt(frame) / denom;
            this.setExportProgress(ratio);
          }
        }
      });
      await this.ffmpeg.load();
    }

    const filenames: string[] = [];

    const len = (this.frames.length - 1).toString().length;
    this.frames.forEach(async (frame, i) => {
      const raw = i.toString();
      // glob orders lexicographically, but we want numerically
      const padded = "0".repeat(len - raw.length) + raw;
      const filename = `desmos.${padded}.png`;
      // filenames may be pushed out of order because async, but doesn't matter
      filenames.push(filename);
      if (this.ffmpeg !== null) {
        this.ffmpeg.FS("writeFile", filename, await fetchFile(frame));
      }
    });

    this.isExporting = true;
    this.updateView();

    const outFilename = await this.export(this.ffmpeg);

    const data = this.ffmpeg.FS("readFile", outFilename);
    for (const filename of filenames) {
      this.ffmpeg.FS("unlink", filename);
    }
    this.ffmpeg.FS("unlink", outFilename);
    const url = URL.createObjectURL(
      new Blob([data.buffer as ArrayBuffer], { type: "video/mp4" })
    );

    const humanOutFilename = "DesModder Video Creator." + this.fileType;
    this.download(url, humanOutFilename);

    this.isExporting = false;
    this.updateView();
  }

  download(url: string, filename: string) {
    // https://gist.github.com/SlimRunner/3b0a7571f04d3a03bff6dbd9de6ad729#file-desmovie-user-js-L325
    // no point supporting anything besides Chrome (no SharedArrayBuffer support)
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 0);
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

  isSliderSettingValid<T extends keyof SliderSettings>(key: T) {
    if (key === "variable") {
      return this.getMatchingSlider() !== undefined;
    } else {
      return isValidNumber(this.sliderSettings[key]);
    }
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

  async captureSlider() {
    const variable = this.sliderSettings.variable;
    const min = EvaluateSingleExpression(this.sliderSettings.minLatex);
    const max = EvaluateSingleExpression(this.sliderSettings.maxLatex);
    const step = EvaluateSingleExpression(this.sliderSettings.stepLatex);
    const slider = this.getMatchingSlider();
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
        await this.captureFrame(i === 0);
      } catch {
        // should be paused due to mathBoundsMismatch or cancellation
        break;
      }
    }
  }

  isWhileLatexValid() {
    return this._isWhileLatexValid;
  }

  getNewWhileLatexHelper() {
    return Calc.HelperExpression({
      latex: `\\left\\{${this.simulationWhileLatex}:1, 0\\right\\}`,
    });
  }

  captureSimulation() {
    const simulationID = this.currentSimulationID;
    if (/^(\\?\s)*$/.test(this.simulationWhileLatex)) {
      // would give an infinite loop, probably unintended
      // use 1 > 0 for intentional infinite loop
      this.isCapturing = false;
      this.captureCancelled = false;
      this.updateView();
      return;
    }

    const helper = this.getNewWhileLatexHelper();

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
          id: simulationID,
        });
        try {
          await this.captureFrame(first);
          first = false;
        } catch {
          // should be paused due to mathBoundsMismatch or cancellation
          break;
        }
      }

      this.captureCancelled = false;
      this.isCapturing = false;
      this.updateView();
    });
  }

  async capture() {
    this.isCapturing = true;
    this.updateView();
    if (this.captureMethod !== "once") {
      Calc.controller.stopPlayingSimulation();
      Calc.controller.stopAllSliders();
    }
    if (this.captureMethod === "simulation") {
      this.captureSimulation();
      // captureSimulation handles settings isCapturing to false
    } else {
      if (this.captureMethod === "once") {
        try {
          await this.captureFrame(true);
        } catch {
          // math bounds mismatch, irrelevant
        }
      } else if (this.captureMethod === "slider") {
        await this.captureSlider();
      }
      this.isCapturing = false;
      this.updateView();
    }
    // no need to retain the pending cancellation; capture is already finished
    this.captureCancelled = false;
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

  setSimulationWhileLatex(s: string) {
    this.simulationWhileLatex = s;
    if (this.whileLatexHelper !== null) {
      this.whileLatexHelper.unobserve("numericValue");
    }
    const helper = this.getNewWhileLatexHelper();
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
    const fps = EvaluateSingleExpression(this.fpsLatex);
    if (this.isPlayingPreview) {
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
