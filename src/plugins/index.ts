/* eslint-disable @typescript-eslint/method-signature-style, @typescript-eslint/dot-notation */
import GLesmos from "./GLesmos";
import BetterEvaluationView from "./better-evaluation-view";
import BuiltinSettings from "./builtin-settings";
import DebugMode from "./debug-mode";
import DuplicateHotkey from "./duplicate-hotkey";
import FindReplace from "./find-replace";
import FolderTools from "./folder-tools";
import HideErrors from "./hide-errors";
import Intellisense from "./intellisense";
import ManageMetadata from "./manage-metadata";
import Multiline from "./multiline";
import PerformanceInfo from "./performance-info";
import PillboxMenus from "./pillbox-menus";
import PinExpressions from "./pin-expressions";
import RightClickTray from "./right-click-tray";
import SetPrimaryColor from "./set-primary-color";
import ShiftEnterNewline from "./shift-enter-newline";
import ShowTips from "./show-tips";
import TextMode from "./text-mode";
import VideoCreator from "./video-creator";
import Wakatime from "./wakatime";
import WolframToDesmos from "./wolfram2desmos";
import MainController from "main/Controller";

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

export interface ConfigItemNumber extends ConfigItemGeneric {
  type: "number";
  default: number;
  min: number;
  max: number;
  step: number;
}

export type ConfigItem =
  | ConfigItemBoolean
  | ConfigItemString
  | ConfigItemNumber;

export type GenericSettings = Record<string, any>;

/**
 * Life cycle:
 *
 * (.settings gets set before afterEnable)
 * afterEnable
 *
 * (.settings gets updated befre afterConfigChange)
 * afterConfigChange
 *
 * beforeDisable
 * afterDisable
 */
export interface PluginInstance<
  Settings extends GenericSettings | undefined = GenericSettings | undefined
> {
  afterEnable(): void;
  afterConfigChange(): void;
  beforeDisable(): void;
  afterDisable(): void;
  settings: Settings;
}

export interface Plugin<
  Settings extends GenericSettings | undefined = GenericSettings | undefined
> {
  /** The ID is fixed permanently, even for future releases. It is kebab
   * case. If you rename the plugin, keep the ID the same for settings sync */
  id: string;
  // display name and descriptions are managed in a translations file
  descriptionLearnMore?: string;
  enabledByDefault: boolean;
  forceEnabled?: boolean;
  new (controller: MainController, config: Settings): PluginInstance<Settings>;
  config?: readonly ConfigItem[];
}

export const keyToPlugin = {
  pillboxMenus: PillboxMenus,
  builtinSettings: BuiltinSettings,
  betterEvaluationView: BetterEvaluationView,
  setPrimaryColor: SetPrimaryColor,
  wolframToDesmos: WolframToDesmos,
  pinExpressions: PinExpressions,
  videoCreator: VideoCreator,
  wakatime: Wakatime,
  findReplace: FindReplace,
  debugMode: DebugMode,
  showTips: ShowTips,
  rightClickTray: RightClickTray,
  duplicateHotkey: DuplicateHotkey,
  glesmos: GLesmos,
  shiftEnterNewline: ShiftEnterNewline,
  hideErrors: HideErrors,
  folderTools: FolderTools,
  textMode: TextMode,
  performanceInfo: PerformanceInfo,
  metadata: ManageMetadata,
  intellisense: Intellisense,
  multiline: Multiline,
} satisfies Record<string, Plugin<any>>;

export const pluginList = Object.values(keyToPlugin);

export const plugins = new Map(pluginList.map((plugin) => [plugin.id, plugin]));

type KP = typeof keyToPlugin;
type KeyToPluginInstance = {
  readonly [K in keyof KP]: undefined | InstanceType<KP[K]>;
};
type IDToPluginInstance = {
  [K in keyof KP as KP[K]["id"]]?: InstanceType<KP[K]>;
};
export type PluginID = keyof IDToPluginInstance;
export type SpecificPlugin = KP[keyof KP];

// prettier-ignore
export class TransparentPlugins implements KeyToPluginInstance {
  /** Note that `enabledPlugins[id]` is truthy if and only if `id` is of
   * an enabled plugin. Otherwise, `enabledPlugins[id]` is undefined */
  private readonly ep: IDToPluginInstance = {};

  readonly enabledPlugins = this.ep as Record<
    PluginID,
    PluginInstance | undefined
  >;

  get pillboxMenus () { return this.ep["pillbox-menus"]; }
  get builtinSettings () { return this.ep["builtin-settings"]; }
  get betterEvaluationView () { return this.ep["better-evaluation-view"]; }
  get setPrimaryColor () { return this.ep["set-primary-color"]; }
  get wolframToDesmos () { return this.ep["wolfram2desmos"]; }
  get pinExpressions () { return this.ep["pin-expressions"]; }
  get videoCreator () { return this.ep["video-creator"]; }
  get wakatime () { return this.ep["wakatime"]; }
  get findReplace () { return this.ep["find-and-replace"]; }
  get debugMode () { return this.ep["debug-mode"]; }
  get showTips () { return this.ep["show-tips"]; }
  get rightClickTray () { return this.ep["right-click-tray"]; }
  get duplicateHotkey () { return this.ep["duplicate-expression-hotkey"]; }
  get glesmos () { return this.ep["GLesmos"]; }
  get shiftEnterNewline () { return this.ep["shift-enter-newline"]; }
  get hideErrors () { return this.ep["hide-errors"]; }
  get folderTools () { return this.ep["folder-tools"]; }
  get textMode () { return this.ep["text-mode"]; }
  get performanceInfo () { return this.ep["performance-info"]; }
  get metadata () { return this.ep["manage-metadata"]; }
  get intellisense () { return this.ep["intellisense"]; }
  get multiline () { return this.ep["multiline"]; }
}

export type IDToPluginSettings = {
  readonly [K in keyof KP as KP[K]["id"]]: GenericSettings | undefined;
};
