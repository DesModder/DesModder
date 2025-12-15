import { PluginController } from "../PluginController";
import { Config, configList } from "./config";

export default class quakePro extends PluginController<Config> {
  static id = "quake-pro" as const;
  static enabledByDefault = false;
  static config = configList;

  dollyMagnification = 1;
  scalarZoomed = 1;

  afterEnable() {
    this.dollyMagnification = this.settings.dollyMagnification;
    this.scalarZoomed = this.settings.scalarZoomed;
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
    this.redrawAllLayers();
  }

  redrawAllLayers() {
    const { grapher3d } = this.cc;
    if (!grapher3d) return;
    grapher3d.redrawAllLayers();
  }
}
