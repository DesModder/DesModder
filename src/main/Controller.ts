import { DCGView } from "../DCGView";
import ExpressionActionButton from "../components/ExpressionActionButton";
import GraphMetadata, {
  Expression as MetadataExpression,
} from "./metadata/interface";
import {
  getMetadata,
  setMetadata,
  getBlankMetadata,
  changeExprInMetadata,
} from "./metadata/manage";
import window, { Calc } from "globals/window";
import {
  plugins,
  pluginList,
  PluginID,
  GenericSettings,
  TransparentPlugins,
} from "plugins";
import { postMessageUp, mapToRecord, recordToMap } from "utils/messages";

export default class MainController extends TransparentPlugins {
  /**
   * pluginsEnabled keeps track of what plugins the user wants enabled,
   * regardless of forceDisabled settings.
   */
  private readonly pluginsEnabled: Map<PluginID, boolean>;
  private readonly forceDisabled: Set<string>;
  pluginSettings: Map<PluginID, GenericSettings>;

  graphMetadata: GraphMetadata = getBlankMetadata();

  constructor() {
    super();
    // default values
    this.pluginSettings = new Map(
      pluginList.map(
        (plugin) => [plugin.id, this.getDefaultConfig(plugin.id)] as const
      )
    );
    this.forceDisabled = window.DesModderPreload!.pluginsForceDisabled;
    if (Calc.controller.isGeometry()) this.forceDisabled.add("text-mode");
    this.pluginsEnabled = new Map(
      pluginList.map((plugin) => [plugin.id, plugin.enabledByDefault] as const)
    );
  }

  getDefaultConfig(id: PluginID) {
    const out: GenericSettings = {};
    const config = plugins.get(id)?.config;
    if (config !== undefined) {
      for (const configItem of config) {
        out[configItem.key] = configItem.default;
      }
    }
    return out;
  }

  applyStoredEnabled(storedEnabled: Map<PluginID, boolean>) {
    for (const { id } of pluginList) {
      const stored = storedEnabled.get(id);
      if (stored !== undefined && id !== "GLesmos") {
        this.pluginsEnabled.set(id, stored);
      }
    }
  }

  applyStoredSettings(storedSettings: Map<PluginID, GenericSettings>) {
    for (const { id } of pluginList) {
      const stored = storedSettings.get(id);
      if (stored !== undefined) {
        const settings = this.pluginSettings.get(id);
        for (const key in settings) {
          const storedValue = stored[key];
          if (storedValue !== undefined) {
            settings[key] = storedValue;
          }
        }
      }
    }
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
    // metadata stuff
    Calc.observeEvent("change.dsm-main-controller", () => {
      this.checkForMetadataChange();
    });
    this.checkForMetadataChange();
    // The graph loaded before DesModder loaded, so DesModder was not available to
    // return true when asked isGlesmosMode. Refresh those expressions now
    this.glesmos?.checkGLesmos();
  }

  setPluginEnabled(id: PluginID, isEnabled: boolean) {
    if (isEnabled && this.isPluginForceDisabled(id)) return;
    const same = isEnabled === this.pluginsEnabled.get(id);
    this.pluginsEnabled.set(id, isEnabled);
    if (id === "GLesmos") {
      // Need to refresh glesmos expressions
      this.glesmos?.checkGLesmos();
    }
    if (!same)
      postMessageUp({
        type: "set-plugins-enabled",
        value: mapToRecord(this.pluginsEnabled),
      });
  }

  disablePlugin(id: PluginID) {
    const plugin = plugins.get(id);
    if (plugin && this.isPluginToggleable(id)) {
      if (plugin.onDisable && this.isPluginEnabled(id)) {
        plugin.onDisable(this);
        this.pluginsEnabled.delete(id);
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete this.enabledPlugins[plugin.id];
        this.setPluginEnabled(id, false);
        this.pillboxMenus?.updateMenuView();
        plugin.afterDisable?.();
      }
    }
  }

  _enablePlugin(id: PluginID) {
    const plugin = plugins.get(id);
    if (plugin !== undefined) {
      const res = plugin.onEnable(this, this.pluginSettings.get(id));
      this.enabledPlugins[plugin.id] = res ?? {};
      this.setPluginEnabled(id, true);
      this.pillboxMenus?.updateMenuView();
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

  isPluginEnabled(id: PluginID) {
    return (
      !this.isPluginForceDisabled(id) && (this.pluginsEnabled.get(id) ?? false)
    );
  }

  isPluginForceDisabled(id: PluginID) {
    return this.forceDisabled.has(id);
  }

  isPluginForceEnabled(id: PluginID) {
    return plugins.get(id)?.onDisable === null;
  }

  isPluginToggleable(id: PluginID) {
    return !this.isPluginForceDisabled(id) && !this.isPluginForceEnabled(id);
  }

  togglePluginSettingBoolean(pluginID: PluginID, key: string) {
    const pluginSettings = this.pluginSettings.get(pluginID);
    if (pluginSettings === undefined) return;
    this.setPluginSetting(pluginID, key, !pluginSettings[key]);
  }

  setPluginSetting(
    pluginID: PluginID,
    key: string,
    value: boolean | string,
    temporary: boolean = false
  ) {
    const pluginSettings = this.pluginSettings.get(pluginID);
    if (pluginSettings === undefined) return;
    pluginSettings[key] = value;
    if (!temporary)
      postMessageUp({
        type: "set-plugin-settings",
        value: mapToRecord(this.pluginSettings),
      });
    if (this.isPluginEnabled(pluginID)) {
      const onConfigChange = plugins.get(pluginID)?.onConfigChange;
      if (onConfigChange !== undefined) onConfigChange(pluginSettings);
    }
    this.pillboxMenus?.updateMenuView();
  }

  checkForMetadataChange() {
    const newMetadata = getMetadata();
    if (!this.isPluginEnabled("GLesmos")) {
      if (
        Object.entries(newMetadata.expressions).some(
          ([id, e]) =>
            e?.glesmos && !this.graphMetadata.expressions[id]?.glesmos
        )
      ) {
        // list of glesmos expressions changed
        Calc.controller._showToast({
          message:
            "Enable the GLesmos plugin to improve the performance of some implicits in this graph",
        });
      }
    }
    this.graphMetadata = newMetadata;
    this.pinExpressions?.applyPinnedStyle();
  }

  _updateExprMetadata(id: string, obj: Partial<MetadataExpression>) {
    changeExprInMetadata(this.graphMetadata, id, obj);
    setMetadata(this.graphMetadata);
  }

  duplicateMetadata(toID: string, fromID: string) {
    const model = this.getDsmItemModel(fromID);
    if (model) this._updateExprMetadata(toID, model);
  }

  updateExprMetadata(id: string, obj: Partial<MetadataExpression>) {
    this._updateExprMetadata(id, obj);
    this.finishUpdateMetadata();
  }

  commitStateChange(allowUndo: boolean) {
    Calc.controller.updateTheComputedWorld();
    if (allowUndo) {
      Calc.controller.commitUndoRedoSynchronously({ type: "dsm-blank" });
    }
    Calc.controller.updateViews();
  }

  finishUpdateMetadata() {
    this.pinExpressions?.applyPinnedStyle();
    this.commitStateChange(false);
  }

  getDsmItemModel(id: string) {
    return this.graphMetadata.expressions[id];
  }

  getDsmItemModels() {
    return Object.entries(this.graphMetadata.expressions).map(([id, v]) => ({
      ...v,
      id,
    }));
  }

  createAction(
    tooltip: string,
    buttonClass: string,
    iconClass: string,
    onTap: () => void
  ) {
    return () =>
      DCGView.createElement(ExpressionActionButton as any, {
        tooltip: DCGView.const(tooltip),
        buttonClass: DCGView.const(buttonClass),
        iconClass: DCGView.const(iconClass),
        onTap,
      });
  }
}
