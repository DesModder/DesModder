import { isPlugin, Plugin, PluginID } from "./plugins";
import View from "./View";

export default class Controller {
  menuViewModel = {
    isOpen: false,
  };
  // pluginsEnabled should be a Map
  pluginsEnabled: { [key: number]: boolean } = {};
  view: View | null = null;
  plugins: Plugin[] = [];
  expandedPlugin: PluginID | null = null;
  pluginSettings: Map<PluginID, { [key: string]: boolean }> = new Map();

  applyDefaultConfig(i: PluginID) {
    const config = (this.plugins[i] as Plugin).config;
    if (config !== undefined) {
      const defaultSettings: { [key: string]: boolean } = {};
      for (const configItem of config) {
        defaultSettings[configItem.key] = configItem.default;
      }
      this.pluginSettings.set(i, defaultSettings);
    }
  }

  _registerPlugin(plugin: Plugin) {
    this.plugins.push(plugin);
    const pluginID: PluginID = this.plugins.length - 1;
    this.applyDefaultConfig(pluginID);
    if (plugin.enabledByDefault) {
      this.enablePlugin(pluginID);
    }
    this.view && this.view.updateMenuView();
    return pluginID;
  }

  registerPlugin(plugin: any): PluginID | undefined {
    if (isPlugin(plugin)) {
      return this._registerPlugin(plugin);
    }
  }

  init(view: View) {
    this.view = view;
    // here want to load config + enabled plugins from local storage + header
  }

  getMenuViewModel() {
    return this.menuViewModel;
  }

  updateMenuView() {
    this.view!.updateMenuView();
  }

  toggleMenu() {
    this.menuViewModel.isOpen = !this.menuViewModel.isOpen;
    this.updateMenuView();
  }

  closeMenu() {
    this.menuViewModel.isOpen = false;
    this.updateMenuView();
  }

  getPlugins() {
    return this.plugins;
  }

  disablePlugin(i: number) {
    const plugin = this.plugins[i];
    if (plugin !== undefined) {
      if (this.pluginsEnabled[i] && plugin.onDisable) {
        plugin.onDisable();
        this.pluginsEnabled[i] = false;
        this.updateMenuView();
      }
    }
  }

  enablePlugin(i: PluginID) {
    const plugin = this.plugins[i];
    if (!this.pluginsEnabled[i] && plugin !== undefined) {
      plugin.onEnable(this.pluginSettings.get(i));
      this.pluginsEnabled[i] = true;
      this.updateMenuView();
    }
  }

  togglePlugin(i: PluginID) {
    if (this.pluginsEnabled[i]) {
      this.disablePlugin(i);
    } else {
      this.enablePlugin(i);
    }
  }

  isPluginEnabled(i: PluginID) {
    return this.pluginsEnabled[i] ?? false;
  }

  canTogglePlugin(i: PluginID) {
    const plugin = this.plugins[i];
    return !(
      plugin !== undefined &&
      this.pluginsEnabled[i] &&
      !("onDisable" in plugin)
    );
  }

  togglePluginExpanded(i: PluginID) {
    if (this.expandedPlugin === i) {
      this.expandedPlugin = null;
    } else {
      this.expandedPlugin = i;
    }
    this.updateMenuView();
  }

  setPluginSetting(pluginID: PluginID, key: string, value: boolean) {
    const pluginSettings = this.pluginSettings.get(pluginID);
    if (pluginSettings === undefined) return;
    pluginSettings[key] = value;
    if (this.pluginsEnabled[pluginID]) {
      const onConfigChange = this.plugins[pluginID]?.onConfigChange;
      if (onConfigChange !== undefined) {
        onConfigChange(key, value);
      }
    }
    this.updateMenuView();
  }
}
