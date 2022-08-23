import duplicateHotkey from "plugins/duplicate-hotkey";
import findReplace from "plugins/find-replace";
import wolfram2desmos from "plugins/wolfram2desmos";
import videoCreator from "plugins/video-creator";
import builtinSettings from "plugins/builtin-settings";
import rightClickTray from "plugins/right-click-tray";
import pinExpressions from "plugins/pin-expressions";
import shiftEnterNewline from "plugins/shift-enter-newline";
import GLesmos from "plugins/GLesmos";
import hideErrors from "plugins/hide-errors";
import debugMode from "plugins/debug-mode";
import showTips from "plugins/show-tips";
import wakatime from "plugins/wakatime";
import folderTools from "plugins/folder-tools";
import textMode from "plugins/text-mode";
import setPrimaryColor from "plugins/set-primary-color";

interface ConfigItemGeneric {
  key: string;
  // display name and descriptions are managed in a translations file
}

export interface ConfigItemBoolean extends ConfigItemGeneric {
  type: "boolean";
  default: boolean;
}

export interface ConfigItemString extends ConfigItemGeneric {
  type: "string";
  variant: "color" | "password" | "text";
  default: string;
}

export type ConfigItem = ConfigItemBoolean | ConfigItemString;

export type GenericSettings = { [key: string]: boolean | string };

export interface Plugin<Settings extends GenericSettings = {}> {
  // the id is fixed permanently, even for future releases
  // where you might change the plugin's name
  // and can help handle migrating save state if the display name changes
  id: string;
  // display name and descriptions are managed in a translations file
  descriptionLearnMore?: string;
  onEnable(config?: unknown): any;
  onDisable?(): void;
  afterDisable?(): void;
  enabledByDefault: boolean;
  alwaysEnabled?: boolean;
  config?: readonly ConfigItem[];
  onConfigChange?(changes: Settings, config: Settings): void;
  manageConfigChange?(current: Settings, next: Settings): Settings;
  enableRequiresReload?: boolean;
  moduleOverrides?: unknown; // should be used only in preload code, not in main code
}

// these plugins will be listed in list order in the menu
// place closer to the top: plugins that people are more likely to adjust

const _plugins = {
  [builtinSettings.id]: builtinSettings,
  [setPrimaryColor.id]: setPrimaryColor,
  [wolfram2desmos.id]: wolfram2desmos,
  [pinExpressions.id]: pinExpressions,
  [videoCreator.id]: videoCreator,
  [wakatime.id]: wakatime,
  [findReplace.id]: findReplace,
  [debugMode.id]: debugMode,
  [showTips.id]: showTips,
  [rightClickTray.id]: rightClickTray,
  [duplicateHotkey.id]: duplicateHotkey,
  [GLesmos.id]: GLesmos,
  [shiftEnterNewline.id]: shiftEnterNewline,
  [hideErrors.id]: hideErrors,
  [folderTools.id]: folderTools,
  [textMode.id]: textMode,
} as const;

export const pluginList = Object.values(_plugins);

export type PluginID = keyof typeof _plugins;

export const plugins = _plugins as { [key in PluginID]: Plugin };
