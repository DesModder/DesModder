/* eslint-disable @typescript-eslint/method-signature-style */
import { DesModderController } from "../script";
import betterEvaluationView from "./better-evaluation-view";
import GLesmos from "plugins/GLesmos";
import builtinSettings from "plugins/builtin-settings";
import debugMode from "plugins/debug-mode";
import duplicateHotkey from "plugins/duplicate-hotkey";
import findReplace from "plugins/find-replace";
import folderTools from "plugins/folder-tools";
import hideErrors from "plugins/hide-errors";
import performanceInfo from "plugins/performance-info";
import pinExpressions from "plugins/pin-expressions";
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

export interface Plugin<Settings extends GenericSettings = GenericSettings> {
  /** The ID is fixed permanently, even for future releases. It is kebab
   * case. If you rename the plugin, keep the ID the same for settings sync */
  id: string;
  /** The key is used for dot access syntax and should be camelCase */
  key: string;
  // display name and descriptions are managed in a translations file
  descriptionLearnMore?: string;
  onEnable(
    controller: DesModderController,
    config?: unknown
  ): PluginEnableResult;
  onDisable(): void;
  afterDisable?(): void;
  enabledByDefault: boolean;
  config?: readonly ConfigItem[];
  onConfigChange?(config: Settings): void;
  moduleOverrides?: unknown; // should be used only in preload code, not in main code
}

export const pluginList: Plugin[] = [
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
  GLesmos,
  shiftEnterNewline,
  hideErrors,
  folderTools,
  textMode,
  performanceInfo,
];

export type PluginID = string;
export type PluginKey = string;

export const plugins = new Map(pluginList.map((plugin) => [plugin.id, plugin]));
