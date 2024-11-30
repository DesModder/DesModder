import VideoCreator from ".";
import {
  Matrix3,
  approx3su,
  eulerFromOrientation,
  getOrientation,
  orientationFromEuler,
  setOrientation,
} from "../../globals/matrix3";
import { hookIntoFunction } from "#utils/listenerHelpers.ts";

type OrientationMode = "none" | "from-to" | "current-delta" | "current-speed";

export const noSpeed: SpeedAndDirection = { dir: "xyRot", speed: 0 };

export class Orientation {
  cc = this.vc.cc;
  readonly cleanupCallbacks: (() => void)[] = [];
  #orientationMode: OrientationMode = "none";
  sdBeforeCapture: SpeedAndDirection = noSpeed;

  constructor(public vc: VideoCreator) {}

  get orientationMode(): OrientationMode {
    if (this.cc.is3dProduct()) {
      if (this.#orientationMode === "none") return "current-speed";
      else return this.#orientationMode;
    } else return "none";
  }

  set orientationMode(mode: OrientationMode) {
    this.#orientationMode = mode;
    // TODO-updateView
    this.vc.updateView();
  }

  afterEnable() {
    this.updateLatexOrientationFromGraph();
    const controls = this.cc.grapher3d?.controls;
    if (controls) {
      const unhook = hookIntoFunction(
        controls,
        "copyWorldRotationToWorld",
        "video-creator-rotation-listener",
        0,
        () => this.updateLatexOrientationFromGraph()
      );
      if (unhook) this.cleanupCallbacks.push(unhook);
      const keys = [
        "onTapStart",
        "onTapMove",
        "onTapUp",
        "onMouseWheel",
      ] as const;
      for (const k of keys) {
        const unhook = hookIntoFunction(
          controls,
          k,
          "video-creator-spinning-listener-" + k,
          0,
          () => this.applySpinningSpeedFromGraph()
        );
        if (unhook) this.cleanupCallbacks.push(unhook);
      }
    }
    const dispatcherID = this.cc.dispatcher.register((evt) => {
      if (evt.type === "set-graph-settings" && "degreeMode" in evt) {
        this.updateLatexOrientationFromGraph();
      }
    });
    this.cleanupCallbacks.push(() =>
      this.cc.dispatcher.unregister(dispatcherID)
    );
  }

  afterDisable() {
    for (const cleanup of this.cleanupCallbacks) cleanup();
  }

  /** Writes angle (in radians) as string (in preferred degrees or radians). */
  angleToString(n: number) {
    if (this.cc.getDegreeMode()) {
      return (n / (Math.PI / 180)).toFixed(1);
    } else {
      return (n / (Math.PI * 2)).toFixed(3) + "\\tau";
    }
  }

  readonly zTip = this.vc.managedNumberInputModel("", {
    afterLatexChanged: () => this.updateOrientationFromLatex(),
    defaultLatex: () => this.angleToString(this.getEulerOrientation().zTip),
  });

  readonly xyRot = this.vc.managedNumberInputModel("", {
    afterLatexChanged: () => this.updateOrientationFromLatex(),
    defaultLatex: () => this.angleToString(this.getEulerOrientation().xyRot),
  });

  readonly zTipFrom = this.vc.managedNumberInputModel("", {
    defaultLatex: () => this.angleToString(this.getEulerOrientation().zTip),
  });

  readonly xyRotFrom = this.vc.managedNumberInputModel("", {
    defaultLatex: () => this.angleToString(this.getEulerOrientation().xyRot),
  });

  readonly zTipTo = this.vc.managedNumberInputModel("", {
    defaultLatex: () => this.zTipFrom.getLatexPopulatingDefault(),
  });

  readonly xyRotTo = this.vc.managedNumberInputModel("", {
    defaultLatex: () =>
      this.zTipFrom.getValue() === this.zTipTo.getValue()
        ? this.angleToString(this.xyRotFrom.getValue() + 2 * Math.PI)
        : this.xyRotFrom.getLatexPopulatingDefault(),
  });

  readonly zTipStep = this.vc.managedNumberInputModel("", {
    defaultLatex: () => "0",
  });

  readonly xyRotStep = this.vc.managedNumberInputModel("", {
    defaultLatex: () => "0",
  });

  readonly speedRot = this.vc.managedNumberInputModel("", {
    afterLatexChanged: () => this.updateSpinningSpeedFromLatex(),
    defaultLatex: () => {
      const sd = this.getSpinningSpeedAndDirection();
      if (!sd) return "";
      return this.angleToString(sd.speed);
    },
  });

  isAngleValid(v: number) {
    return !isNaN(v) && Math.abs(v) < 2 ** 30;
  }

  isCurrentXYRotValid() {
    return this.isAngleValid(this.xyRot.getValue());
  }

  isCurrentZTipValid() {
    return this.isAngleValid(this.zTip.getValue());
  }

  isXYRotStepValid() {
    return this.isAngleValid(this.xyRotStep.getValue());
  }

  isZTipStepValid() {
    return this.isAngleValid(this.zTipStep.getValue());
  }

  isXYRotFromValid() {
    return this.isAngleValid(this.xyRotFrom.getValue());
  }

  isZTipFromValid() {
    return this.isAngleValid(this.zTipFrom.getValue());
  }

  isXYRotToValid() {
    return this.isAngleValid(this.xyRotTo.getValue());
  }

  isZTipToValid() {
    return this.isAngleValid(this.zTipTo.getValue());
  }

  isSpeedRotValid() {
    return this.isAngleValid(this.speedRot.getValue());
  }

  isCurrentOrientationRelevant() {
    return this.cc.is3dProduct();
  }

  isToOrientationRelevant() {
    return (
      this.isCurrentOrientationRelevant() && this.vc.captureMethod === "slider"
    );
  }

  isStepOrientationRelevant() {
    return (
      this.isCurrentOrientationRelevant() && this.vc.captureMethod === "action"
    );
  }

  isSpeedOrientationRelevant() {
    return (
      this.isCurrentOrientationRelevant() &&
      this.vc.captureMethod === "ticks" &&
      this.getSpinningSpeedAndDirection() !== undefined
    );
  }

  orientationModeRequiresStepCount() {
    return (
      this.orientationMode === "from-to" ||
      this.orientationMode === "current-delta"
    );
  }

  toggleSpinningDirection() {
    const sd = this.getSpinningSpeedAndDirection();
    if (!sd) return;
    const { dir, speed } = sd;
    this.setSpinningSpeedAndDirection({
      dir: dir === "zTip" ? "xyRot" : "zTip",
      speed,
    });
  }

  applySpinningSpeedFromGraph() {
    if (!this.vc.isMenuOpen()) return;
    if (this._applyingSpinningOrientation) return;
    const sd = this.getSpinningSpeedAndDirection();
    if (!sd) return;
    const trigAngleMultiplier = this.trigAngleMultiplier();
    if (this.speedRot.getValue() * trigAngleMultiplier !== sd.speed) {
      this.speedRot.setLatexWithoutCallbacks("");
    }
  }

  updateSpinningSpeedFromLatex() {
    let speed = this.speedRot.getValue() * this.trigAngleMultiplier();
    if (isNaN(speed)) speed = 0;
    this.setSpeed(speed);
  }

  setSpeed(speed: number) {
    const sd = this.getSpinningSpeedAndDirection();
    if (!sd) return;
    const { dir } = sd;
    this.setSpinningSpeedAndDirection({ dir, speed });
  }

  private speedAndDirectionToAxis3DSpeed({ dir, speed }: SpeedAndDirection) {
    const ss = speed >= 0 ? 1 : -1;
    if (dir === "xyRot") {
      return {
        axis3D: [0, 0, ss] as const,
        speed3D: Math.abs(speed),
      };
    } else {
      const { xyRot } = this.getEulerOrientation();
      return {
        axis3D: [ss * Math.cos(xyRot), -ss * Math.sin(xyRot), 0] as const,
        speed3D: Math.abs(speed),
      };
    }
  }

  setSpinningSpeedAndDirection(sd: SpeedAndDirection) {
    const controls = this.cc.grapher3d?.controls;
    if (!controls) return;
    if (!this.isAngleValid(sd.speed)) return;
    const { axis3D, speed3D } = this.speedAndDirectionToAxis3DSpeed(sd);
    controls.axis3D = axis3D;
    controls.speed3D = speed3D;
  }

  /** Returns undefined if the spin doesn't correspond to a simple zTip or xyRot. */
  getSpinningSpeedAndDirection(): undefined | SpeedAndDirection {
    const controls = this.cc.grapher3d?.controls;
    if (!controls) return undefined;
    const [x, y, z] = controls.axis3D;
    if (Math.abs(z) > 0.999) {
      return { dir: "xyRot", speed: controls.speed3D * Math.sign(z) };
    } else if (Math.abs(z) < 0.001) {
      const { xyRot } = this.getEulerOrientation();
      const dot = Math.cos(xyRot) * x - Math.sin(xyRot) * y;
      return { dir: "zTip", speed: controls.speed3D * Math.sign(dot) };
    } else {
      return undefined;
    }
  }

  _applyingSpinningOrientation = false;
  updateLatexOrientationFromGraph() {
    if (!this.vc.isMenuOpen()) return;
    const { grapher3d } = this.cc;
    if (!grapher3d) return;
    if (this._applyingSpinningOrientation) return;
    const mat = getOrientation(grapher3d);
    const tm = this._targetMatrixFromLatex;
    if (tm && approx3su(mat, tm)) {
      // Avoid a cycle where editing the latex changes the world changes the latex
      return;
    }
    this._targetMatrixFromLatex = undefined;
    // TODO: _applyingSpinningOrientation still needed? We have setLatexWithoutCallbacks now.
    this._applyingSpinningOrientation = true;
    this.zTip.setLatexWithoutCallbacks("");
    this.xyRot.setLatexWithoutCallbacks("");
    // TODO-updateView: should be tick?
    this.vc.updateView();
    this._applyingSpinningOrientation = false;
  }

  _targetMatrixFromLatex: Matrix3 | undefined;
  updateOrientationFromLatex() {
    if (this._applyingSpinningOrientation) return;
    const { zTip, xyRot } = this.getOrientationFromLatex();
    if (!this.isAngleValid(zTip) || !this.isAngleValid(xyRot)) return;
    const { grapher3d } = this.cc;
    if (!grapher3d) return;
    const mat = orientationFromEuler(grapher3d, zTip, xyRot);
    this._targetMatrixFromLatex = mat;
    setOrientation(grapher3d, mat);
    this.applySpinningSpeedFromGraph();
  }

  setOrientationFromCapture(xyRot: number, zTip: number) {
    this.xyRot.setLatexWithoutCallbacks(this.angleToString(xyRot));
    this.zTip.setLatexWithoutCallbacks(this.angleToString(zTip));
    this.updateOrientationFromLatex();
  }

  getOrientationFromLatex() {
    const trigAngleMultiplier = this.trigAngleMultiplier();
    const zTip = this.zTip.getValue() * trigAngleMultiplier;
    const xyRot = this.xyRot.getValue() * trigAngleMultiplier;
    return { zTip, xyRot };
  }

  getEulerOrientation() {
    const { grapher3d } = this.cc;
    if (!grapher3d) return { zTip: 0, xyRot: 0 };
    const mat = getOrientation(grapher3d);
    return eulerFromOrientation(mat);
  }

  trigAngleMultiplier() {
    return this.cc.getDegreeMode() ? Math.PI / 180 : 1;
  }

  areCaptureSettingsValid() {
    if (this.isCurrentOrientationRelevant())
      if (!this.isCurrentXYRotValid() || !this.isCurrentZTipValid())
        return false;
    if (this.isToOrientationRelevant())
      if (!this.isXYRotToValid() || !this.isZTipToValid()) return false;
    if (this.isStepOrientationRelevant())
      if (!this.isXYRotStepValid() || !this.isZTipStepValid()) return false;
    if (this.isSpeedOrientationRelevant())
      if (!this.isSpeedRotValid()) return false;
    return true;
  }
}

interface SpeedAndDirection {
  dir: "xyRot" | "zTip";
  speed: number;
}
