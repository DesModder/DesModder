/* eslint-disable @typescript-eslint/method-signature-style */
import GLesmos from "./GLesmos/Controller";
import betterEvaluationView from "./better-evaluation-view";
import TextMode from "./text-mode/Controller";
import MainController from "main/Controller";
import glesmos from "plugins/GLesmos";
import builtinSettings from "plugins/builtin-settings";
import debugMode from "plugins/debug-mode";
import duplicateHotkey from "plugins/duplicate-hotkey";
import findReplace from "plugins/find-replace";
import folderTools, { FolderTools } from "plugins/folder-tools";
import hideErrors, { HideErrors } from "plugins/hide-errors";
import performanceInfo from "plugins/performance-info";
import pillboxMenus, { PillboxMenus } from "plugins/pillbox-menus";
import pinExpressions, { PinExpressions } from "plugins/pin-expressions";
import rightClickTray from "plugins/right-click-tray";
import setPrimaryColor from "plugins/set-primary-color";
import shiftEnterNewline from "plugins/shift-enter-newline";
import showTips from "plugins/show-tips";
import textMode from "plugins/text-mode";
import videoCreator from "plugins/video-creator";
import wakatime from "plugins/wakatime";
import wolfram2desmos from "plugins/wolfram2desmos";

interface ConfigItemGeneric {
  key: string;
  // TODO proper type here
  shouldShow?: (current: any) => boolean;
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

export type GenericSettings = Record<string, any>;
export type PluginEnableResult = Record<string, any> | undefined;

export type Plugin<Settings extends GenericSettings = GenericSettings> = {
  /** The ID is fixed permanently, even for future releases. It is kebab
   * case. If you rename the plugin, keep the ID the same for settings sync */
  id: string;
  /** The key is used for dot access syntax and should be camelCase */
  key?: undefined;
  // display name and descriptions are managed in a translations file
  descriptionLearnMore?: string;
  onEnable(controller: MainController, config?: unknown): PluginEnableResult;
  config?: readonly ConfigItem[];
  onConfigChange?(config: Settings): void;
} & (
  | {
      onDisable(controller: MainController): void;
      afterDisable?(): void;
      enabledByDefault: boolean;
    }
  | {
      // A core plugin, which can't be disabled
      onDisable: null;
      enabledByDefault: true;
    }
);

export const pluginList: Plugin[] = [
  pillboxMenus,
  builtinSettings,
  betterEvaluationView,
  setPrimaryColor,
  wolfram2desmos,
  pinExpressions,
  videoCreator,
  wakatime,
  findReplace,
  debugMode,
  showTips,
  rightClickTray,
  duplicateHotkey,
  glesmos,
  shiftEnterNewline,
  hideErrors,
  folderTools,
  textMode,
  performanceInfo,
];

export type PluginID = string;

export const plugins = new Map(pluginList.map((plugin) => [plugin.id, plugin]));

type U<T> = T | undefined;
// prettier-ignore
export class TransparentPlugins {
  /** Note that `enabledPlugins[id]` is truthy if and only if `id` is of
   * an enabled plugin. Otherwise, `enabledPlugins[id]` is undefined */
  enabledPlugins: Record<PluginID, Record<string, any> | undefined> = {};

  private get ep () { return this.enabledPlugins; }
  get pillboxMenus         () { return this.ep["pillbox-menus"]          as U<PillboxMenus>; }
  get betterEvaluationView () { return this.ep["better-evaluation-view"] as U<object>; }
  get debugMode            () { return this.ep["debug-mode"]             as U<object>; }
  get pinExpressions       () { return this.ep["pin-expressions"]        as U<PinExpressions>; }
  get folderTools          () { return this.ep["folder-tools"]           as U<FolderTools>; }
  get textMode             () { return this.ep["text-mode"]              as U<TextMode>; }
  get glesmos              () { return this.ep.GLesmos                   as U<GLesmos>; }
  get hideErrors           () { return this.ep["hide-errors"]            as U<HideErrors>; }
  get shiftEnterNewline    () { return this.ep["shift-enter-newline"]    as U<object>; }
  get showTips             () { return this.ep["show-tips"]              as U<object>; }
}
