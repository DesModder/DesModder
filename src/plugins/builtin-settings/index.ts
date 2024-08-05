import { PluginController } from "../PluginController";
import {
  Config,
  configList,
  settingsConfigList,
  specialConfigList,
} from "./config";

const settingsKeys = settingsConfigList.map((e) => e.key);
const specialKeys = specialConfigList.map((e) => e.key);

function hasQueryFlag(s: string) {
  const params = new URLSearchParams(window.location.href);
  return params.has(s) && params.get(s) !== "false";
}

export default class BuiltinSettings extends PluginController<Config> {
  static id = "builtin-settings" as const;
  static enabledByDefault = true;
  static config = configList;
  initialSettings: null | Config = null;

  afterEnable() {
    this.initialSettings = { ...this.settings };
    for (const key of settingsKeys) {
      this.initialSettings[key] =
        (
          this.calc.settings as typeof this.calc.settings & {
            advancedStyling: boolean;
            authorFeatures: boolean;
          }
        )[key] ?? false;
    }
    for (const key of specialKeys) {
      switch (key) {
        case "showIDs":
          this.initialSettings[key] = hasQueryFlag("showIDs");
          break;
        default:
          key satisfies never;
      }
    }
    this.updateConfig(this.settings);
  }

  afterDisable() {
    if (this.initialSettings !== null) this.updateConfig(this.initialSettings);
  }

  afterConfigChange() {
    this.updateConfig(this.settings);
  }

  private updateURL(config: Config) {
    const params = new URLSearchParams(window.location.search);
    for (const key of specialKeys) {
      switch (key) {
        case "showIDs":
          if (config[key]) {
            params.set(key, "trueDSMDELETE");
          } else {
            params.delete(key);
          }
          break;
        default:
          key satisfies never;
      }
    }
    const href = window.location.href;
    const url = new URL(href);
    url.search = params.toString();
    const newURL = url.toString().replace(/=trueDSMDELETE/g, "");
    if (newURL !== href) {
      history.replaceState({}, "", newURL);
    }
  }

  private updateSettings(config: Config) {
    let { graphpaper, zoomButtons } = config;
    zoomButtons &&= graphpaper;
    // Deal with zoomButtons needing to be off before graphpaper is disabled
    // But graphpaper needs to be on before zoomButtons is enabled.
    if (graphpaper) this.calc.updateSettings({ graphpaper });
    if (!zoomButtons) this.calc.updateSettings({ zoomButtons });
    // Copy so that the extraneous entries of config (such as showIDs)
    // do not get sent to `updateSettings`.
    const settings: any = {};
    for (const key of settingsKeys) {
      settings[key] = config[key];
    }
    this.calc.updateSettings({ ...settings, zoomButtons, graphpaper });
  }

  updateConfig(config: Config) {
    this.updateURL(config);
    this.updateSettings(config);
  }
}
