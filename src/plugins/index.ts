import duplicateHotkey from "plugins/duplicate-hotkey";
import findReplace from "plugins/find-replace";
import wolfram2desmos from "plugins/wolfram2desmos";
import videoCreator from "plugins/video-creator";
import builtinSettings from "plugins/builtin-settings";
import rightClickTray from "plugins/right-click-tray";
import pinExpressions from "plugins/pin-expressions";

interface ConfigItemGeneric {
  key: string;
  name: string;
  description?: string;
}

interface ConfigItemBoolean extends ConfigItemGeneric {
  type: "boolean";
  default: boolean;
}

type ConfigItem = ConfigItemBoolean;

type GenericBooleanSettings = { [key: string]: boolean };

export interface Plugin<Settings extends GenericBooleanSettings = {}> {
  // the id is fixed permanently, even for future releases
  // where you might change the plugin's name
  // and can help handle migrating save state if the display name changes
  id: string;
  name: string;
  description: string;
  onEnable(config?: unknown): void;
  onDisable?(): void;
  enabledByDefault: boolean;
  config?: readonly ConfigItem[];
  onConfigChange?(changes: Settings): void;
  manageConfigChange?(current: Settings, next: Settings): Settings;
  enableRequiresReload?: boolean;
  moduleOverrides?: unknown; // should be used only in preload coad, not in main code
}

// these plugins will be listed in list order in the menu
// place closer to the top: plugins that people are more likely to adjust

const _plugins = {
  [builtinSettings.id]: builtinSettings,
  [videoCreator.id]: videoCreator,
  [duplicateHotkey.id]: duplicateHotkey,
  [findReplace.id]: findReplace,
  [rightClickTray.id]: rightClickTray,
  [wolfram2desmos.id]: wolfram2desmos,
  [pinExpressions.id]: pinExpressions,
} as const;

export const pluginList = Object.values(_plugins);

export type PluginID = keyof typeof _plugins;

export const plugins = _plugins as { [key in PluginID]: Plugin };
