import { WorkerData3d } from "../../globals/Calc.ts";
import { PluginController } from "../PluginController";
import { Config, configList } from "./config";

export default class quakePro extends PluginController<Config> {
  static id = "quake-pro" as const;
  static enabledByDefault = false;
  static config = configList;

  dollyMagnification = 1;
  scalarZoomed = 1;

  vanillaGetWorkerData?: () => WorkerData3d;

  afterEnable() {
    this.dollyMagnification = this.settings.dollyMagnification;
    this.scalarZoomed = this.settings.scalarZoomed;
    const grapher3d = this.getGrapher3d();
    if (grapher3d) {
      this.vanillaGetWorkerData = grapher3d.getWorkerData.bind(grapher3d);
      grapher3d.getWorkerData = this.getWorkerData;
    }
    this.redrawAllLayers();
  }

  afterConfigChange() {
    this.dollyMagnification = this.settings.dollyMagnification;
    this.scalarZoomed = this.settings.scalarZoomed;
    this.redrawAllLayers();
  }

  afterDisable() {
    this.dollyMagnification = 1;
    this.scalarZoomed = 1;
    const grapher3d = this.getGrapher3d();
    if (grapher3d) {
      grapher3d.getWorkerData = this.vanillaGetWorkerDataAssuming3d();
    }
    this.redrawAllLayers();
  }

  getGrapher3d() {
    return this.cc.grapher3d;
  }

  redrawAllLayers() {
    const grapher3d = this.getGrapher3d();
    if (!grapher3d) return;
    grapher3d.redrawAllLayers();
  }

  vanillaGetWorkerDataAssuming3d() {
    if (!this.vanillaGetWorkerData) {
      throw new Error("Impossible: 3d without vanillaGetWorkerData.");
    }
    return this.vanillaGetWorkerData;
  }

  getWorkerData = () => {
    const workerData = this.vanillaGetWorkerDataAssuming3d()();

    const quakePro = this.settings;
    const { settings } = workerData;

    /** This stores a value from 0-1 depending how zoomed the user currently is (based on dragging the slider). */
    const zoomPercentage =
      settings.perspectiveDistortion /
      (quakePro?.dollyMagnification ?? 1) /
      6.25;

    const scalarMultiplier = quakePro
      ? (quakePro.scalarZoomed - 1) * zoomPercentage + 1
      : 1;

    // Adds the Quake Pro settings
    settings.quakePro = {
      ...(quakePro ?? {}),
      zoomPercentage,
      scalarMultiplier,
    };
    return workerData;
  };
}
