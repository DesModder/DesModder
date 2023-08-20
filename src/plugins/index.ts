/* eslint-disable @typescript-eslint/method-signature-style, @typescript-eslint/dot-notation */
import { Dataflow } from "../dataflow";
import GLesmos from "./GLesmos";
import BetterEvaluationView from "./better-evaluation-view";
import BuiltinSettings from "./builtin-settings";
import CompactView from "./compact-view";
import CustomMathQuillConfig from "./custom-mathquill-config";
import DebugMode from "./debug-mode";
import DuplicateHotkey from "./duplicate-hotkey";
import ExprActionButtons from "./expr-action-buttons";
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
import DSM from "MainController";

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
  variant?: "range" | "number";
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
  new (dsm: DSM, config: Settings): PluginInstance<Settings>;
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
  customMathQuillConfig: CustomMathQuillConfig,
  rightClickTray: RightClickTray,
  duplicateHotkey: DuplicateHotkey,
  glesmos: GLesmos,
  shiftEnterNewline: ShiftEnterNewline,
  hideErrors: HideErrors,
  folderTools: FolderTools,
  textMode: TextMode,
  performanceInfo: PerformanceInfo,
  metadata: ManageMetadata,
  multiline: Multiline,
  intellisense: Intellisense,
  compactView: CompactView,
  exprActionButtons: ExprActionButtons,
} satisfies Record<string, Plugin<any>>;

export const pluginList = Object.values(keyToPlugin);

export const plugins = new Map(pluginList.map((plugin) => [plugin.id, plugin]));

type KP = typeof keyToPlugin;
type IDToPluginInstance = {
  [K in keyof KP as KP[K]["id"]]?: InstanceType<KP[K]>;
};
export type PluginID = keyof IDToPluginInstance;
export type SpecificPlugin = KP[keyof KP];

declare module "dataflow" {
  type M = {
    [key in PluginID as `${key}/enabled`]: {
      output: true;
      input: unknown;
    };
  };
  interface Facets extends M {}
}

// prettier-ignore
export class TransparentPlugins extends Dataflow  {
  /** Note that `enabledPlugins[id]` is truthy if and only if `id` is of
   * an enabled plugin. Otherwise, `enabledPlugins[id]` is undefined */
  private readonly ep: IDToPluginInstance = {};

  readonly enabledPlugins = this.ep as Record<
    PluginID,
    PluginInstance | undefined
  >;

  // protected = only appears in replacements

  get pillboxMenus () { return this.ep["pillbox-menus"]; }
  protected get betterEvaluationView () { return this.ep["better-evaluation-view"]; }
  get pinExpressions () { return this.ep["pin-expressions"]; }
  protected get showTips () { return this.ep["show-tips"]; }
  protected get rightClickTray () { return this.ep["right-click-tray"]; }
  get glesmos () { return this.ep["GLesmos"]; }
  protected get hideErrors () { return this.ep["hide-errors"]; }
  get textMode () { return this.ep["text-mode"]; }
  get metadata () { return this.ep["manage-metadata"]; }
  protected get exprActionButtons () { return this.ep["expr-action-buttons"]; }
}

export type IDToPluginSettings = {
  readonly [K in keyof KP as KP[K]["id"]]: GenericSettings | undefined;
};
