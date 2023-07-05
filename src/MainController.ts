import { insertElement, replaceElement } from "./preload/replaceElement";
import { mainEditorView } from "./state";
import {
  applyStoredSettings,
  pluginSettings,
  updatePluginSettings,
} from "./state/pluginSettings";
import {
  pluginsEnabled,
  pluginsForceDisabled,
  setPluginEnabled,
  setPluginsEnabled,
} from "./state/pluginsEnabled";
import { StateEffect } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import window, { Calc } from "globals/window";
import {
  plugins,
  pluginList,
  PluginID,
  GenericSettings,
  TransparentPlugins,
  IDToPluginSettings,
  PluginInstance,
} from "plugins";
import { recordToMap } from "utils/messages";

export default class MainController extends TransparentPlugins {
  private readonly view: EditorView;

  constructor() {
    super();
    const forceDisabled = window.DesModderPreload!.pluginsForceDisabled;
    if (Calc.controller.isGeometry()) forceDisabled.add("text-mode");
    this.view = mainEditorView([pluginsForceDisabled.of(forceDisabled)]);
  }

  dispatch(...effects: StateEffect<any>[]) {
    this.view.dispatch({ effects });
  }

  applyStoredEnabled(storedEnabled: Map<PluginID, boolean | undefined>) {
    const pluginsEnabled = new Map(
      pluginList.map((plugin) => [plugin.id, plugin.enabledByDefault] as const)
    );
    for (const { id } of pluginList) {
      const stored = storedEnabled.get(id);
      if (stored !== undefined && id !== "GLesmos") {
        pluginsEnabled.set(id, stored);
      }
    }
    this.dispatch(setPluginsEnabled.of(pluginsEnabled));
  }

  applyStoredSettings(
    storedSettings: Map<PluginID, GenericSettings | undefined>
  ) {
    this.dispatch(applyStoredSettings.of(storedSettings));
  }

  init() {
    const dsmPreload = window.DesModderPreload!;
    this.applyStoredSettings(recordToMap(dsmPreload.pluginSettings));
    this.applyStoredEnabled(recordToMap(dsmPreload.pluginsEnabled));
    delete window.DesModderPreload;

    for (const { id } of pluginList) {
      if (this.isPluginEnabled(id)) this._enablePlugin(id);
    }
    this.pillboxMenus?.updateMenuView();
    // The graph loaded before DesModder loaded, so DesModder was not available to
    // return true when asked isGlesmosMode. Refresh those expressions now
    this.glesmos?.checkGLesmos();
  }

  setPluginEnabled(id: PluginID, enable: boolean) {
    if (enable && this.isPluginForceDisabled(id)) return;
    const pe = this.view.state.field(pluginsEnabled);
    if (enable === pe.get(id)) return;
    this.dispatch(setPluginEnabled.of({ id, enable }));
  }

  disablePlugin(id: PluginID) {
    const plugin = plugins.get(id);
    if (plugin && this.isPluginToggleable(id)) {
      if (this.isPluginEnabled(id)) {
        const plugin = this.enabledPlugins[id];
        plugin?.beforeDisable();
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete this.enabledPlugins[id];
        this.setPluginEnabled(id, false);
        this.pillboxMenus?.updateMenuView();
        plugin?.afterDisable();
        Calc.controller.updateViews();
      }
    }
  }

  _enablePlugin(id: PluginID) {
    const Plugin = plugins.get(id);
    if (Plugin !== undefined) {
      const settings = this.getPluginSettings(id);
      const res = new Plugin(this, settings as any as never);
      const ep = this.enabledPlugins as Record<PluginID, PluginInstance>;
      ep[Plugin.id] = res;
      (res as PluginInstance).settings = settings;
      this.setPluginEnabled(id, true);
      res.afterEnable();
      this.pillboxMenus?.updateMenuView();
      Calc.controller.updateViews();
    }
  }

  enablePlugin(id: PluginID) {
    if (this.isPluginToggleable(id) && !this.isPluginEnabled(id)) {
      this.setPluginEnabled(id, true);
      this._enablePlugin(id);
    }
  }

  togglePlugin(id: PluginID) {
    if (this.isPluginEnabled(id)) {
      this.disablePlugin(id);
    } else {
      this.enablePlugin(id);
    }
  }

  /** Tests only */
  togglePluginsTo(enabled: string[]) {
    const goalEnabled = new Set(enabled);
    for (const id of Object.keys(this.enabledPlugins) as PluginID[]) {
      if (!goalEnabled.has(id)) this.disablePlugin(id);
    }
    for (const id of enabled as PluginID[]) {
      if (!this.isPluginEnabled(id)) this.enablePlugin(id);
    }
  }

  isPluginEnabled(id: PluginID) {
    const pe = this.view.state.field(pluginsEnabled);
    return !this.isPluginForceDisabled(id) && (pe.get(id) ?? false);
  }

  isPluginForceDisabled(id: PluginID) {
    return this.view.state.facet(pluginsForceDisabled).has(id);
  }

  isPluginToggleable(id: PluginID) {
    return !this.isPluginForceDisabled(id);
  }

  togglePluginSettingBoolean(pluginID: PluginID, key: string) {
    const settings = this.getPluginSettings(pluginID);
    if (settings)
      this.setPluginSetting(pluginID, key, !(settings[key] as boolean));
  }

  setPluginSetting(
    pluginID: PluginID,
    key: string,
    value: boolean | string | number,
    temporary: boolean = false
  ) {
    this.updatePluginSettings(pluginID, { [key]: value }, temporary);
  }

  private updatePluginSettings(
    pluginID: PluginID,
    value: any,
    temporary: boolean
  ) {
    this.dispatch(updatePluginSettings.of({ pluginID, value, temporary }));
    const plugin = this.enabledPlugins[pluginID];
    if (plugin) {
      plugin.settings = this.getPluginSettings(pluginID);
      plugin.afterConfigChange();
      Calc.controller.updateViews();
    }
    this.pillboxMenus?.updateMenuView();
  }

  getAllPluginSettings() {
    return this.view.state.field(pluginSettings).settings;
  }

  getPluginSettings(pluginID: PluginID) {
    return this.getAllPluginSettings()[pluginID];
  }

  /** Tests only */
  setAllPluginSettings(settings: IDToPluginSettings) {
    for (const [key, value] of Object.entries(settings)) {
      this.updatePluginSettings(key as PluginID, value, false);
    }
  }

  commitStateChange(allowUndo: boolean) {
    Calc.controller.updateTheComputedWorld();
    if (allowUndo) {
      Calc.controller.commitUndoRedoSynchronously({ type: "dsm-blank" });
    }
    Calc.controller.updateViews();
  }

  insertElement = insertElement;
  replaceElement = replaceElement;
}
