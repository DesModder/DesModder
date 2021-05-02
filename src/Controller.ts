import { plugins, pluginList, PluginID } from "./plugins";
import View from "./View";

export default class Controller {
  menuViewModel = {
    isOpen: false,
  };
  pluginsEnabled: { [key in PluginID]: boolean };
  view: View | null = null;
  expandedPlugin: PluginID | null = null;
  pluginSettings: {
    [plugin in PluginID]: { [key: string]: boolean };
  };

  constructor() {
    this.pluginSettings = Object.fromEntries(
      pluginList.map((plugin) => [plugin.id, {}] as const)
    );
    this.pluginsEnabled = Object.fromEntries(
      pluginList.map((plugin) => [plugin.id, false] as const)
    );
    for (const plugin of pluginList) {
      this.applyDefaultConfig(plugin.id);
      if (plugin.enabledByDefault) {
        this.enablePlugin(plugin.id);
      }
      this.view && this.view.updateMenuView();
    }
  }

  applyDefaultConfig(id: PluginID) {
    const config = plugins[id].config;
    if (config !== undefined) {
      for (const configItem of config) {
        this.pluginSettings[id][configItem.key] = configItem.default;
      }
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
    this.view?.updateMenuView();
  }

  toggleMenu() {
    this.menuViewModel.isOpen = !this.menuViewModel.isOpen;
    this.updateMenuView();
  }

  closeMenu() {
    this.menuViewModel.isOpen = false;
    this.updateMenuView();
  }

  getPlugin(id: PluginID) {
    return plugins[id];
  }

  getPluginsList() {
    return pluginList;
  }

  disablePlugin(i: PluginID) {
    const plugin = plugins[i];
    if (plugin !== undefined) {
      if (this.pluginsEnabled[i] && plugin.onDisable) {
        plugin.onDisable();
        this.pluginsEnabled[i] = false;
        this.updateMenuView();
      }
    }
  }

  enablePlugin(i: PluginID) {
    const plugin = plugins[i];
    if (!this.pluginsEnabled[i] && plugin !== undefined) {
      plugin.onEnable(this.pluginSettings[i]);
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
    const plugin = plugins[i];
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

  setPluginSetting(
    pluginID: PluginID,
    key: string,
    value: boolean,
    doCallback: boolean = true
  ) {
    const pluginSettings = this.pluginSettings[pluginID];
    if (pluginSettings === undefined) return;
    const proposedChanges = {
      [key]: value,
    };
    const manageConfigChange = plugins[pluginID]?.manageConfigChange;
    const changes =
      manageConfigChange !== undefined
        ? manageConfigChange(pluginSettings, proposedChanges)
        : proposedChanges;
    Object.assign(pluginSettings, changes);
    if (doCallback && this.pluginsEnabled[pluginID]) {
      const onConfigChange = plugins[pluginID]?.onConfigChange;
      if (onConfigChange !== undefined) {
        onConfigChange(changes);
      }
    }
    this.updateMenuView();
  }
}
