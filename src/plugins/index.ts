/* eslint-disable @typescript-eslint/method-signature-style, @typescript-eslint/dot-notation */
import DSM from "#DSM";
import GLesmos from "./GLesmos";
import BetterEvaluationView from "./better-evaluation-view";
import BuiltinSettings from "./builtin-settings";
import CodeGolf from "./code-golf";
import CompactView from "./compact-view";
import CustomMathQuillConfig from "./custom-mathquill-config";
import DuplicateHotkey from "./duplicate-hotkey";
import ExprActionButtons, {
  ActionButton,
} from "../core-plugins/expr-action-buttons";
import FindReplace from "./find-replace";
import FolderTools from "./folder-tools";
import HideErrors from "./hide-errors";
import Intellisense from "./intellisense";
import ManageMetadata from "../core-plugins/manage-metadata";
import Multiline from "./multiline";
import PasteImage from "./paste-image";
import PerformanceInfo from "./performance-info";
import PillboxMenus from "../core-plugins/pillbox-menus";
import PinExpressions from "./pin-expressions";
import RightClickTray from "./right-click-tray";
import SetPrimaryColor from "./set-primary-color";
import ShowTips from "./show-tips";
import SyntaxHighlighting from "./syntax-highlighting";
import TextMode from "./text-mode";
import VideoCreator from "./video-creator";
import Wakatime from "./wakatime";
import WolframToDesmos from "./wolfram2desmos";
import BetterNavigation from "./better-navigation";
import QuakePro from "./quake-pro";
import OverrideKeystroke from "../core-plugins/override-keystroke";
import { DispatchedEvent } from "src/globals/extra-actions";

interface ConfigItemGeneric {
  // indentation level for hierarchical relationships in settings
  // usually for when several settings only become relevant when another is enabled
  // default 0
  indentationLevel?: number;
  key: string;
  // TODO proper type here
  shouldShow?: (current: any, dsm: DSM) => boolean;
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
export interface ConfigItemColorList extends ConfigItemGeneric {
  type: "color-list";
  default: string[];
}

export type ConfigItem =
  | ConfigItemBoolean
  | ConfigItemString
  | ConfigItemNumber
  | ConfigItemColorList;

export type GenericSettings = Record<string, any>;

/**
 * Life cycle:
 *
 * (.settings gets set before afterEnable)
 * afterEnable
 *
 * (.settings gets updated before afterConfigChange)
 * afterConfigChange
 *
 * beforeDisable
 * afterDisable
 */
export interface PluginInstance<
  Settings extends GenericSettings | undefined = GenericSettings | undefined,
> {
  afterEnable(): void;
  afterConfigChange(): void;
  beforeDisable(): void;
  afterDisable(): void;
  settings: Settings;
  /** Consumed by expr-action-buttons. This should really be a facet a la Codemirror. */
  actionButtons?: ActionButton[];

  /** Returning `"abort-later-handlers"` means don't run any later handlers. */
  handleDispatchedAction?: (
    evt: DispatchedEvent
  ) => "abort-later-handlers" | undefined;
  afterHandleDispatchedAction?: (evt: DispatchedEvent) => void;
  beforeUpdateTheComputedWorld?: () => void;
  afterUpdateTheComputedWorld?: () => void;
}

export interface Plugin<
  Settings extends GenericSettings | undefined = GenericSettings | undefined,
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
  showTips: ShowTips,
  customMathQuillConfig: CustomMathQuillConfig,
  rightClickTray: RightClickTray,
  duplicateHotkey: DuplicateHotkey,
  glesmos: GLesmos,
  hideErrors: HideErrors,
  folderTools: FolderTools,
  textMode: TextMode,
  performanceInfo: PerformanceInfo,
  metadata: ManageMetadata,
  overrideKeystroke: OverrideKeystroke,
  multiline: Multiline,
  intellisense: Intellisense,
  compactView: CompactView,
  exprActionButtons: ExprActionButtons,
  codeGolf: CodeGolf,
  syntaxHighlighting: SyntaxHighlighting,
  betterNavigation: BetterNavigation,
  pasteImage: PasteImage,
  quakePro: QuakePro,
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
  get showTips () { return this.ep["show-tips"]; }
  get customMathQuillConfig () { return this.ep["custom-mathquill-config"]; }
  get rightClickTray () { return this.ep["right-click-tray"]; }
  get duplicateHotkey () { return this.ep["duplicate-expression-hotkey"]; }
  get glesmos () { return this.ep["GLesmos"]; }
  get hideErrors () { return this.ep["hide-errors"]; }
  get folderTools () { return this.ep["folder-tools"]; }
  get textMode () { return this.ep["text-mode"]; }
  get performanceInfo () { return this.ep["performance-info"]; }
  get metadata () { return this.ep["manage-metadata"]; }
  get overrideKeystroke () { return this.ep["override-keystroke"]; }
  get intellisense () { return this.ep["intellisense"]; }
  get compactView () { return this.ep["compact-view"]; }
  get multiline () { return this.ep["multiline"]; }
  get exprActionButtons () { return this.ep["expr-action-buttons"]; }
  get codeGolf () { return this.ep["code-golf"]; }
  get syntaxHighlighting () { return this.ep["syntax-highlighting"]}
  get betterNavigation () { return this.ep["better-navigation"]} 
  get pasteImage () { return this.ep["paste-image"]; }
  get quakePro () { return this.ep["quake-pro"]; }
}

export type IDToPluginSettings = {
  readonly [K in keyof KP as KP[K]["id"]]: GenericSettings | undefined;
};
