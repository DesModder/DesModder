/* eslint-disable @typescript-eslint/method-signature-style, @typescript-eslint/dot-notation */
import { mainEditorView } from "../state";
import { pluginsForceDisabled } from "../state/pluginsEnabled";
import GLesmos from "./GLesmos";
import BetterEvaluationView from "./better-evaluation-view";
import BuiltinSettings from "./builtin-settings";
import CompactView from "./compact-view";
import DebugMode from "./debug-mode";
import DuplicateHotkey from "./duplicate-hotkey";
import ExprActionButtons, { ActionButton } from "./expr-action-buttons";
import FindReplace from "./find-replace";
import FolderTools from "./folder-tools";
import HideErrors from "./hide-errors";
import Intellisense from "./intellisense";
import ManageMetadata from "./manage-metadata";
import Multiline from "./multiline";
import PinExpressions from "./pin-expressions";
import RightClickTray from "./right-click-tray";
import SetPrimaryColor from "./set-primary-color";
import ShiftEnterNewline from "./shift-enter-newline";
import ShowTips from "./show-tips";
import TextMode from "./text-mode";
import Wakatime from "./wakatime";
import WolframToDesmos from "./wolfram2desmos";
import { Compartment } from "@codemirror/state";
import { EditorView, ViewPlugin } from "@codemirror/view";
import MainController from "MainController";
import PerformanceInfo, { performanceInfo } from "cmPlugins/performance-info";
import PillboxMenus, { pillboxMenus } from "cmPlugins/pillbox-menus";
import VideoCreator, { videoCreator } from "cmPlugins/video-creator";
import window, { Calc } from "globals/window";

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
  /** Consumed by expr-action-buttons. This should really be a facet a la Codemirror. */
  actionButtons?: ActionButton[];
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
  new (controller: MainController, config: Settings): PluginInstance<Settings>;
  config?: readonly ConfigItem[];
}

export const keyToCMPlugin = {
  pillboxMenus,
  videoCreator,
  performanceInfo,
};

const keyToCMPluginConstructor = {
  pillboxMenus: PillboxMenus,
  videoCreator: VideoCreator,
  performanceInfo: PerformanceInfo,
};

export const idToCMPluginConstructor = Object.fromEntries(
  Object.entries(keyToCMPluginConstructor).map(([_, v]) => [v.id, v])
) as Record<CMPluginID, KCPC[keyof KCPC]>;

const cmKeyToID = Object.fromEntries(
  Object.entries(keyToCMPluginConstructor).map(([k, v]) => [k, v.id])
) as Record<keyof KCP, CMPluginID>;

export const idToCMPlugin = Object.fromEntries(
  Object.entries(keyToCMPlugin).map(([k, v]) => [cmKeyToID[k as keyof KCP], v])
) as Record<CMPluginID, KCPC[keyof KCPC]>;

export const cmPluginList = Object.values(keyToCMPluginConstructor);

type KCPC = typeof keyToCMPluginConstructor;

type KCP = typeof keyToCMPlugin;
type KeyToCMPluginInstance = {
  readonly [K in keyof KCP]:
    | undefined
    | (ReturnType<KCP[K]> extends ViewPlugin<infer T> ? T : never);
};
type IDToCMPluginInstance = {
  readonly [K in keyof KCP as KCPC[K]["id"]]:
    | undefined
    | (ReturnType<KCP[K]> extends ViewPlugin<infer T> ? T : never);
};
type IDToPluginSpec = {
  readonly [K in keyof KCP as KCPC[K]["id"]]: ReturnType<KCP[K]>;
};
export type CMPluginID = keyof IDToPluginSpec;

export const keyToPlugin = {
  builtinSettings: BuiltinSettings,
  betterEvaluationView: BetterEvaluationView,
  setPrimaryColor: SetPrimaryColor,
  wolframToDesmos: WolframToDesmos,
  pinExpressions: PinExpressions,
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
  metadata: ManageMetadata,
  multiline: Multiline,
  intellisense: Intellisense,
  compactView: CompactView,
  exprActionButtons: ExprActionButtons,
} satisfies Record<string, Plugin<any>>;

const legacyPluginList = Object.values(keyToPlugin);

export const pluginList = cmPluginList.concat(legacyPluginList as any) as (
  | (typeof legacyPluginList)[number]
  | (typeof cmPluginList)[number]
)[];

export const plugins = new Map(
  legacyPluginList.map((plugin) => [plugin.id, plugin])
);

type KP = typeof keyToPlugin;
type KeyToPluginInstance = {
  readonly [K in keyof KP]: undefined | InstanceType<KP[K]>;
};
type IDToPluginInstance = {
  [K in keyof KP as KP[K]["id"]]?: InstanceType<KP[K]>;
};
export type PluginID = keyof IDToPluginInstance | keyof IDToPluginSpec;
export type SpecificPlugin = KP[keyof KP] | KCPC[keyof KCPC];

type KeyToAnyPluginInstance = KeyToPluginInstance & KeyToCMPluginInstance;

export type IDToPluginSettings = Record<PluginID, GenericSettings | undefined>;

export function getPlugin(id: PluginID): SpecificPlugin {
  return plugins.get(id as any) ?? idToCMPluginConstructor[id as CMPluginID];
}

/** Note the point of TransparentPlugins is just to implement parts of
 * MainController in this file, since TS makes it hard to split a class
 * implementation while ensuring type safety. */
class _TransparentPlugins {
  /** Note that `enabledPlugins[id]` is truthy if and only if `id` is of
   * an enabled plugin. Otherwise, `enabledPlugins[id]` is undefined */
  protected readonly ep: IDToPluginInstance = {};
  protected readonly ips: IDToPluginSpec;
  protected readonly compartments: Record<CMPluginID, Compartment>;
  readonly view: EditorView;

  constructor() {
    const forceDisabled = window.DesModderPreload!.pluginsForceDisabled;
    if (Calc.controller.isGeometry()) forceDisabled.add("text-mode");
    const dsm = this as any as MainController;
    this.ips = Object.fromEntries(
      Object.entries(keyToCMPlugin).map(([k, v]) => [
        cmKeyToID[k as keyof KCP],
        v(dsm),
      ])
    ) as IDToPluginSpec;
    this.compartments = Object.fromEntries(
      Object.keys(idToCMPluginConstructor).map((id) => [id, new Compartment()])
    ) as Record<keyof typeof idToCMPluginConstructor, Compartment>;
    this.view = mainEditorView([
      pluginsForceDisabled.of(forceDisabled),
      this.ips["pillbox-menus"],
      ...Object.values(this.compartments).map((c) => c.of([])),
    ]);
  }

  readonly enabledPlugins = this.ep as Record<
    PluginID,
    PluginInstance | undefined
  >;

  cmPlugin<K extends CMPluginID>(id: K) {
    return (
      (this.view.plugin(this.ips[id]) as IDToCMPluginInstance[K]) ?? undefined
    );
  }
}

// prettier-ignore
export class TransparentPlugins extends _TransparentPlugins implements KeyToAnyPluginInstance  {
  get pillboxMenus () { return this.cmPlugin("pillbox-menus") }
  get builtinSettings () { return this.ep["builtin-settings"]; }
  get betterEvaluationView () { return this.ep["better-evaluation-view"]; }
  get setPrimaryColor () { return this.ep["set-primary-color"]; }
  get wolframToDesmos () { return this.ep["wolfram2desmos"]; }
  get pinExpressions () { return this.ep["pin-expressions"]; }
  get videoCreator () { return this.cmPlugin("video-creator"); }
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
  get performanceInfo () { return this.cmPlugin("performance-info"); }
  get metadata () { return this.ep["manage-metadata"]; }
  get intellisense () { return this.ep["intellisense"]; }
  get compactView () { return this.ep["compact-view"]; }
  get multiline () { return this.ep["multiline"]; }
  get exprActionButtons () { return this.ep["expr-action-buttons"]; }
}
