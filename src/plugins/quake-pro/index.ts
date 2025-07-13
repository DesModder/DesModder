import { PluginController } from "../PluginController";
import { Config, configList } from "./config";

export default class quakePro extends PluginController<Config> {
  static id = "quake-pro" as const;
  static enabledByDefault = false;
  static config = configList;

  magnification = 1;

  afterEnable() {
    this.magnification = this.settings.magnification;
    this.redrawAllLayers();
  }

  afterConfigChange() {
    this.magnification = this.settings.magnification;
    this.redrawAllLayers();
  }

  afterDisable() {
    this.magnification = 1;
    this.redrawAllLayers();
  }

  redrawAllLayers() {
    const { grapher3d } = this.cc;
    if (!grapher3d) return;
    grapher3d.redrawAllLayers();
  }
}
