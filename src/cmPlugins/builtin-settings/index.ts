import MainController from "../../MainController";
import { CMPluginSpec } from "../../plugins";
import { pluginSettings } from "../../state/pluginSettings";
import { onState } from "../../state/utils";
import { CMPlugin } from "../CMPlugin";
import { pluginConfig } from "../pillbox-menus/facets/pluginConfig";
import { Config, configList } from "./config";
import { EditorView, ViewPlugin } from "@codemirror/view";
import { Calc } from "globals/window";
import { getQueryParams } from "utils/depUtils";

const managedKeys = configList.map((e) => e.key);

function updateSettings(config: Config) {
  let { graphpaper, zoomButtons } = config;
  zoomButtons &&= graphpaper;
  // Deal with zoomButtons needing to be off before graphpaper is disabled
  // But graphpaper needs to be on before zoomButtons is enabled.
  if (graphpaper) Calc.updateSettings({ graphpaper });
  if (!zoomButtons) Calc.updateSettings({ zoomButtons });
  Calc.updateSettings({ ...config, zoomButtons, graphpaper });
}

export default class BuiltinSettings extends CMPlugin {
  static id = "builtin-settings" as const;
  static enabledByDefault = true;
  readonly initialSettings: Config;

  constructor(view: EditorView, dsm: MainController) {
    super(view, dsm);
    this.initialSettings = Object.fromEntries(
      Object.entries(Calc.settings).filter(([k, _]) =>
        (managedKeys as string[]).includes(k)
      )
    ) as any as Config;
    const queryParams = getQueryParams();
    for (const key of managedKeys) {
      this.initialSettings[key] =
        (
          Calc.settings as typeof Calc.settings & {
            advancedStyling: boolean;
            authorFeatures: boolean;
          }
        )[key] ?? false;
    }
    const queryConfig: Partial<Config> = {};
    for (const key of managedKeys) {
      if (queryParams[key]) {
        queryConfig[key] = true;
      }
      if (queryParams["no" + key]) {
        queryConfig[key] = false;
      }
    }
  }

  destroy() {
    if (this.initialSettings !== null) updateSettings(this.initialSettings);
  }
}

export function builtinSettings(
  dsm: MainController
): CMPluginSpec<BuiltinSettings> {
  return {
    plugin: ViewPlugin.define((view) => new BuiltinSettings(view, dsm), {
      provide: () => [
        onState(pluginSettings, (value) => {
          // The ordering is wrong here. Needs to run *after* the constructor.
          setTimeout(() =>
            updateSettings(value.settings["builtin-settings"]! as Config)
          );
        }),
      ],
    }),
    extensions: [
      pluginConfig.of({
        id: BuiltinSettings.id,
        category: "core",
        config: configList,
      }),
    ],
  };
}
