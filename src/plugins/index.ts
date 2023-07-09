/* eslint-disable @typescript-eslint/method-signature-style, @typescript-eslint/dot-notation */
import Intellisense, { intellisense } from "../plugins/intellisense";
import { mainEditorView } from "../state";
import { pluginsForceDisabled } from "../state/pluginsEnabled";
import { Compartment, Extension } from "@codemirror/state";
import { EditorView, PluginValue, ViewPlugin } from "@codemirror/view";
import MainController from "MainController";
import window, { Calc } from "globals/window";
import GLesmos, { glesmos } from "plugins/GLesmos";
import BetterEvaluationView, {
  betterEvaluationView,
} from "plugins/better-evaluation-view";
import BuiltinSettings, { builtinSettings } from "plugins/builtin-settings";
import CompactView, { compactView } from "plugins/compact-view";
import DebugMode, { debugMode } from "plugins/debug-mode";
import DuplicateHotkey, { duplicateHotkey } from "plugins/duplicate-hotkey";
import ExprActionButtons, {
  ActionButton,
  exprActionButtons,
} from "plugins/expr-action-buttons";
import FindReplace, { findReplace } from "plugins/find-replace";
import FolderTools, { folderTools } from "plugins/folder-tools";
import HideErrors, { hideErrors } from "plugins/hide-errors";
import ManageMetadata, { manageMetadata } from "plugins/manage-metadata";
import Multiline, { multiline } from "plugins/multiline";
import PerformanceInfo, { performanceInfo } from "plugins/performance-info";
import PillboxMenus, { pillboxMenus } from "plugins/pillbox-menus";
import {
  PluginConfig,
  pluginConfig,
} from "plugins/pillbox-menus/facets/pluginConfig";
import PinExpressions, { pinExpressions } from "plugins/pin-expressions";
import RightClickTray, { rightClickTray } from "plugins/right-click-tray";
import SetPrimaryColor, { setPrimaryColor } from "plugins/set-primary-color";
import ShiftEnterNewline, {
  shiftEnterNewline,
} from "plugins/shift-enter-newline";
import ShowTips, { showTips } from "plugins/show-tips";
import TextMode, { textMode } from "plugins/text-mode";
import VideoCreator, { videoCreator } from "plugins/video-creator";
import Wakatime, { wakatime } from "plugins/wakatime";
import WolframToDesmos, { wolframToDesmos } from "plugins/wolfram2desmos";

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
  textMode,
  metadata: manageMetadata,
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
  textMode: TextMode,
  metadata: ManageMetadata,
};

export const idToCMPluginConstructor = Object.fromEntries(
  Object.entries(keyToCMPluginConstructor).map(([_, v]) => [v.id, v])
) as Record<PluginID, KCPC[keyof KCPC]>;

const cmKeyToID = Object.fromEntries(
  Object.entries(keyToCMPluginConstructor).map(([k, v]) => [k, v.id])
) as Record<keyof KCP, PluginID>;

export const idToCMPlugin = Object.fromEntries(
  Object.entries(keyToCMPlugin).map(([k, v]) => [cmKeyToID[k as keyof KCP], v])
) as Record<PluginID, KCPC[keyof KCPC]>;

export const pluginList = Object.values(keyToCMPluginConstructor);

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
export type PluginID = keyof IDToPluginSpec;

type KeyToAnyPluginInstance = KeyToCMPluginInstance;

export type SpecificPlugin = KCPC[keyof KCPC];

export type IDToPluginSettings = Record<PluginID, GenericSettings | undefined>;

export function getPlugin(id: PluginID): SpecificPlugin {
  return idToCMPluginConstructor[id];
}

/** Note the point of TransparentPlugins is just to implement parts of
 * MainController in this file, since TS makes it hard to split a class
 * implementation while ensuring type safety. */
class _TransparentPlugins {
  /** Note that `enabledPlugins[id]` is truthy if and only if `id` is of
   * an enabled plugin. Otherwise, `enabledPlugins[id]` is undefined */
  protected readonly ep: Partial<IDToCMPluginInstance> = {};
  protected readonly ips: IDToPluginSpec;
  protected readonly compartments: Record<PluginID, Compartment>;
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
      ...Object.values(this.compartments).map((c) => c.of([])),
    ]);
  }

  readonly enabledPlugins = this.ep as Record<
    PluginID,
    PluginInstance | undefined
  >;

  cmPlugin<K extends PluginID>(id: K) {
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
  get textMode () { return this.cmPlugin("text-mode"); }
  get performanceInfo () { return this.cmPlugin("performance-info"); }
  get metadata () { return this.cmPlugin("manage-metadata"); }
  get intellisense () { return this.cmPlugin("intellisense"); }
  get compactView () { return this.cmPlugin("compact-view"); }
  get multiline () { return this.cmPlugin("multiline"); }
  get exprActionButtons () { return this.cmPlugin("expr-action-buttons"); }
}
