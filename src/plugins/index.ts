/* eslint-disable @typescript-eslint/method-signature-style, @typescript-eslint/dot-notation */
import Intellisense, { intellisense } from "../cmPlugins/intellisense";
import { mainEditorView } from "../state";
import { pluginsForceDisabled } from "../state/pluginsEnabled";
import ManageMetadata from "./manage-metadata";
import TextMode from "./text-mode";
import { Compartment, Extension } from "@codemirror/state";
import { EditorView, PluginValue, ViewPlugin } from "@codemirror/view";
import MainController from "MainController";
import GLesmos, { glesmos } from "cmPlugins/GLesmos";
import BetterEvaluationView, {
  betterEvaluationView,
} from "cmPlugins/better-evaluation-view";
import BuiltinSettings, { builtinSettings } from "cmPlugins/builtin-settings";
import CompactView, { compactView } from "cmPlugins/compact-view";
import DebugMode, { debugMode } from "cmPlugins/debug-mode";
import DuplicateHotkey, { duplicateHotkey } from "cmPlugins/duplicate-hotkey";
import ExprActionButtons, {
  ActionButton,
  exprActionButtons,
} from "cmPlugins/expr-action-buttons";
import FindReplace, { findReplace } from "cmPlugins/find-replace";
import FolderTools, { folderTools } from "cmPlugins/folder-tools";
import HideErrors, { hideErrors } from "cmPlugins/hide-errors";
import Multiline, { multiline } from "cmPlugins/multiline";
import PerformanceInfo, { performanceInfo } from "cmPlugins/performance-info";
import PillboxMenus, { pillboxMenus } from "cmPlugins/pillbox-menus";
import {
  PluginConfig,
  pluginConfig,
} from "cmPlugins/pillbox-menus/facets/pluginConfig";
import PinExpressions, { pinExpressions } from "cmPlugins/pin-expressions";
import RightClickTray, { rightClickTray } from "cmPlugins/right-click-tray";
import SetPrimaryColor, { setPrimaryColor } from "cmPlugins/set-primary-color";
import ShiftEnterNewline, {
  shiftEnterNewline,
} from "cmPlugins/shift-enter-newline";
import ShowTips, { showTips } from "cmPlugins/show-tips";
import VideoCreator, { videoCreator } from "cmPlugins/video-creator";
import Wakatime, { wakatime } from "cmPlugins/wakatime";
import WolframToDesmos, { wolframToDesmos } from "cmPlugins/wolfram2desmos";
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

export interface CMPluginSpec<T extends PluginValue> {
  id: PluginID;
  category: string;
  config: PluginConfig["config"];
  plugin: ViewPlugin<T>;
  extensions: Extension;
}

export const keyToCMPlugin = {
  pillboxMenus,
  videoCreator,
  performanceInfo,
  builtinSettings,
  duplicateHotkey,
  betterEvaluationView,
  compactView,
  debugMode,
  findReplace,
  glesmos,
  hideErrors,
  intellisense,
  multiline,
  rightClickTray,
  setPrimaryColor,
  shiftEnterNewline,
  showTips,
  wolframToDesmos,
  wakatime,
  pinExpressions,
  folderTools,
  exprActionButtons,
};

const keyToCMPluginConstructor = {
  pillboxMenus: PillboxMenus,
  videoCreator: VideoCreator,
  performanceInfo: PerformanceInfo,
  builtinSettings: BuiltinSettings,
  duplicateHotkey: DuplicateHotkey,
  betterEvaluationView: BetterEvaluationView,
  compactView: CompactView,
  debugMode: DebugMode,
  findReplace: FindReplace,
  glesmos: GLesmos,
  hideErrors: HideErrors,
  intellisense: Intellisense,
  multiline: Multiline,
  rightClickTray: RightClickTray,
  setPrimaryColor: SetPrimaryColor,
  shiftEnterNewline: ShiftEnterNewline,
  showTips: ShowTips,
  wolframToDesmos: WolframToDesmos,
  wakatime: Wakatime,
  pinExpressions: PinExpressions,
  folderTools: FolderTools,
  exprActionButtons: ExprActionButtons,
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
    | (ReturnType<KCP[K]>["plugin"] extends ViewPlugin<infer T> ? T : never);
};
type IDToCMPluginInstance = {
  readonly [K in keyof KCP as KCPC[K]["id"]]:
    | undefined
    | (ReturnType<KCP[K]>["plugin"] extends ViewPlugin<infer T> ? T : never);
};
type IDToPluginSpec = {
  readonly [K in keyof KCP as KCPC[K]["id"]]: ReturnType<KCP[K]>["plugin"];
};
export type CMPluginID = keyof IDToPluginSpec;

export const keyToPlugin = {
  textMode: TextMode,
  metadata: ManageMetadata,
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
    const bits = Object.entries(keyToCMPlugin).map(
      ([k, v]) => [k, v(dsm)] as const
    );
    this.ips = Object.fromEntries(
      bits.map(([k, v]) => [cmKeyToID[k as keyof KCP], v.plugin])
    ) as IDToPluginSpec;
    this.compartments = Object.fromEntries(
      Object.keys(idToCMPluginConstructor).map((id) => [id, new Compartment()])
    ) as Record<keyof typeof idToCMPluginConstructor, Compartment>;
    this.view = mainEditorView([
      pluginsForceDisabled.of(forceDisabled),
      this.ips["pillbox-menus"],
      ...bits.flatMap(([_, v]) => [v.extensions].concat([configExtension(v)])),
      ...legacyPluginList.flatMap((x) => configExtension(x)),
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

function configExtension(x: PluginConfig) {
  return x.category === "core-core"
    ? []
    : pluginConfig.of({
        id: x.id,
        category: x.category,
        config: x.config ?? [],
      });
}

// prettier-ignore
export class TransparentPlugins extends _TransparentPlugins implements KeyToAnyPluginInstance  {
  get pillboxMenus () { return this.cmPlugin("pillbox-menus") }
  get builtinSettings () { return this.cmPlugin("builtin-settings"); }
  get betterEvaluationView () { return this.cmPlugin("better-evaluation-view"); }
  get setPrimaryColor () { return this.cmPlugin("set-primary-color"); }
  get wolframToDesmos () { return this.cmPlugin("wolfram2desmos"); }
  get pinExpressions () { return this.cmPlugin("pin-expressions"); }
  get videoCreator () { return this.cmPlugin("video-creator"); }
  get wakatime () { return this.cmPlugin("wakatime"); }
  get findReplace () { return this.cmPlugin("find-and-replace"); }
  get debugMode () { return this.cmPlugin("debug-mode"); }
  get showTips () { return this.cmPlugin("show-tips"); }
  get rightClickTray () { return this.cmPlugin("right-click-tray"); }
  get duplicateHotkey () { return this.cmPlugin("duplicate-expression-hotkey"); }
  get glesmos () { return this.cmPlugin("GLesmos"); }
  get shiftEnterNewline () { return this.cmPlugin("shift-enter-newline"); }
  get hideErrors () { return this.cmPlugin("hide-errors") }
  get folderTools () { return this.cmPlugin("folder-tools"); }
  get textMode () { return this.ep["text-mode"]; }
  get performanceInfo () { return this.cmPlugin("performance-info"); }
  get metadata () { return this.ep["manage-metadata"]; }
  get intellisense () { return this.cmPlugin("intellisense"); }
  get compactView () { return this.cmPlugin("compact-view"); }
  get multiline () { return this.cmPlugin("multiline"); }
  get exprActionButtons () { return this.cmPlugin("expr-action-buttons"); }
}
