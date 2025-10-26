import { insertElement, replaceElement } from "./preload/replaceElement";
import window, { DispatchedEvent, type Calc } from "#globals";
import {
  plugins,
  pluginList,
  PluginID,
  GenericSettings,
  TransparentPlugins,
  IDToPluginSettings,
  PluginInstance,
} from "./plugins";
import { postMessageUp, mapToRecord, recordToMap } from "#utils/messages.ts";

export default class DSM extends TransparentPlugins {
  cc = this.calc.controller;
  /**
   * pluginsEnabled keeps track of what plugins the user wants enabled,
   * regardless of forceDisabled settings.
   */
  private readonly pluginsEnabled: Map<PluginID, boolean>;
  private readonly forceDisabled: Set<string>;
  readonly pluginSettings = Object.fromEntries(
    pluginList.map(
      (plugin) => [plugin.id, getDefaultConfig(plugin.id)] as const
    )
  ) as IDToPluginSettings;

  private readonly vanillaHandleAction: (evt: DispatchedEvent) => void;
  private readonly vanillaUpdateTheComputedWorld: () => void;
  private readonly afterDestroy?: () => void;

  constructor(
    public calc: Calc,
    opts: {
      /** Called after destroying the DSM (but before destroying the Calc). */
      afterDestroy?: () => void;
    } = {}
  ) {
    super();
    this.afterDestroy = opts.afterDestroy;
    if (calc._dsmConnected)
      throw new Error(
        "Cannot bind DesModder controller (DSM) twice to one calc instance."
      );
    calc._dsmConnected = true;
    // default values
    this.forceDisabled = window.DesModderPreload!.pluginsForceDisabled;
    if (calc.controller.is3dProduct()) this.forceDisabled.add("GLesmos");
    this.pluginsEnabled = new Map(
      pluginList.map((plugin) => [plugin.id, plugin.enabledByDefault] as const)
    );
    // Setup handler override
    this.vanillaHandleAction = this.cc.handleDispatchedAction.bind(this.cc);
    this.cc.handleDispatchedAction = this.handleDispatchedAction.bind(this);
    this.vanillaUpdateTheComputedWorld = this.cc.updateTheComputedWorld.bind(
      this.cc
    );
    this.cc.updateTheComputedWorld = this.updateTheComputedWorld.bind(this);
  }

  enabledPluginsSorted() {
    const enabledPluginIDs = Object.keys(this.enabledPlugins) as PluginID[];
    enabledPluginIDs.sort();
    const plugins: [PluginID, PluginInstance][] = [];
    for (const id of enabledPluginIDs) {
      plugins.push([id, this.enabledPlugins[id]!]);
    }
    return plugins;
  }

  handleDispatchedAction(evt: DispatchedEvent) {
    for (const [_id, plugin] of this.enabledPluginsSorted()) {
      const keepGoing = plugin?.handleDispatchedAction?.(evt);
      if (keepGoing === "abort-later-handlers") return;
    }
    this.vanillaHandleAction(evt);
    for (const [_id, plugin] of this.enabledPluginsSorted()) {
      plugin?.afterHandleDispatchedAction?.(evt);
    }
  }

  updateTheComputedWorld() {
    for (const [_id, plugin] of this.enabledPluginsSorted()) {
      plugin?.beforeUpdateTheComputedWorld?.();
    }
    this.vanillaUpdateTheComputedWorld();
    for (const [_id, plugin] of this.enabledPluginsSorted()) {
      plugin?.afterUpdateTheComputedWorld?.();
    }
  }

  applyStoredEnabled(storedEnabled: Map<PluginID, boolean | undefined>) {
    for (const { id } of pluginList) {
      const stored = storedEnabled.get(id);
      if (stored !== undefined) {
        this.pluginsEnabled.set(id, stored);
      }
    }
  }

  applyStoredSettings(
    storedSettings: Map<PluginID, GenericSettings | undefined>
  ) {
    for (const { id } of pluginList) {
      const stored = storedSettings.get(id);
      if (stored !== undefined) {
        const settings = this.pluginSettings[id];
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

    // Enable core plugins
    for (const { id } of pluginList) {
      if (plugins.get(id)?.isCore) this._enablePlugin(id);
    }
    // Then all the other plugins
    for (const { id } of pluginList) {
      if (plugins.get(id)?.isCore) continue;
      if (this.isPluginEnabled(id)) this._enablePlugin(id);
    }
    this.pillboxMenus?.updateMenuView();
    // The graph loaded before DesModder loaded, so DesModder was not available to
    // return true when asked isGlesmosMode. Refresh those expressions now
    this.glesmos?.checkGLesmos();

    const oldDestroy = this.cc.destroy.bind(this.cc);
    this.cc.destroy = () => {
      oldDestroy();
      this.destroy();
    };
  }

  destroy() {
    this.calc._dsmConnected = false;
    this.afterDestroy?.();
  }

  setPluginEnabled(id: PluginID, isEnabled: boolean) {
    if (isEnabled && this.isPluginForceDisabled(id)) return;
    const same = isEnabled === this.pluginsEnabled.get(id);
    this.pluginsEnabled.set(id, isEnabled);
    if (!same)
      postMessageUp({
        type: "set-plugins-enabled",
        value: mapToRecord(this.pluginsEnabled),
      });
  }

  disablePlugin(id: PluginID) {
    const plugin = plugins.get(id);
    if (plugin?.isCore) throw new Error(`Core plugin ${id} cannot be disabled`);
    if (plugin && this.isPluginToggleable(id)) {
      if (this.isPluginEnabled(id)) {
        const plugin = this.enabledPlugins[id];
        plugin?.beforeDisable();
        this.pluginsEnabled.delete(id);
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete this.enabledPlugins[id];
        this.setPluginEnabled(id, false);
        this.pillboxMenus?.updateMenuView();
        plugin?.afterDisable();
        this.cc.updateViews();
      }
    }
  }

  _enablePlugin(id: PluginID) {
    const Plugin = plugins.get(id);
    if (Plugin !== undefined) {
      const res = new Plugin(this, this.pluginSettings[id] as any as never);
      const ep = this.enabledPlugins as Record<PluginID, PluginInstance>;
      ep[Plugin.id] = res;
      (res as PluginInstance).settings = this.pluginSettings[id];
      this.setPluginEnabled(id, true);
      res.afterEnable();
      this.pillboxMenus?.updateMenuView();
      this.cc.updateViews();
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
    return (
      !this.isPluginForceDisabled(id) && (this.pluginsEnabled.get(id) ?? false)
    );
  }

  isPluginForceDisabled(id: PluginID) {
    return this.forceDisabled.has(id);
  }

  isPluginForceEnabled(id: PluginID) {
    return !!plugins.get(id)?.forceEnabled;
  }

  isPluginToggleable(id: PluginID) {
    return !this.isPluginForceDisabled(id) && !this.isPluginForceEnabled(id);
  }

  togglePluginSettingBoolean(pluginID: PluginID, key: string) {
    const pluginSettings = this.pluginSettings[pluginID];
    if (pluginSettings)
      this.setPluginSetting(pluginID, key, !(pluginSettings[key] as boolean));
  }

  postSetPluginSettingsMessage() {
    postMessageUp({
      type: "set-plugin-settings",
      value: this.pluginSettings,
    });
  }

  delaySetPluginSettings = false;
  isPluginSettingsUpToDate = true;

  enqueueSetPluginSettingsMessage() {
    // return early if setting the plugin settings is currently delayed.
    if (this.delaySetPluginSettings) {
      this.isPluginSettingsUpToDate = false;
      return;
    }

    // post a message to set the plugin settings
    this.postSetPluginSettingsMessage();
    this.delaySetPluginSettings = true;

    // after a second, mark the delay as over
    // and re-post the plugin settings if necessary
    setTimeout(() => {
      this.delaySetPluginSettings = false;
      if (!this.isPluginSettingsUpToDate) {
        this.postSetPluginSettingsMessage();
        this.isPluginSettingsUpToDate = true;
      }
    }, 1000);
  }

  setPluginSetting(
    pluginID: PluginID,
    key: string,
    value: boolean | string | number | string[],
    temporary: boolean = false
  ) {
    this.updatePluginSettings(pluginID, { [key]: value }, temporary);
  }

  private updatePluginSettings(
    pluginID: PluginID,
    value: any,
    temporary: boolean
  ) {
    const pluginSettings = this.pluginSettings[pluginID];
    if (!pluginSettings) return;
    Object.assign(pluginSettings, value);
    if (!temporary) this.enqueueSetPluginSettingsMessage();
    const plugin = this.enabledPlugins[pluginID];
    if (plugin) {
      plugin.settings = pluginSettings;
      plugin.afterConfigChange();
      this.cc.updateViews();
    }
    this.pillboxMenus?.updateMenuView();
  }

  /** Tests only */
  setAllPluginSettings(settings: IDToPluginSettings) {
    for (const [key, value] of Object.entries(settings)) {
      this.updatePluginSettings(key as PluginID, value, false);
    }
  }

  insertElement = insertElement;
  replaceElement = replaceElement;
}

function getDefaultConfig(id: PluginID) {
  const out: GenericSettings = {};
  const config = plugins.get(id)?.config;
  if (config !== undefined) {
    for (const configItem of config) {
      out[configItem.key] = configItem.default;
    }
  }
  return out;
}
