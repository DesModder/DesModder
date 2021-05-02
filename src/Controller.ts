import { plugins, pluginList, PluginID } from "./plugins";
import View from "./View";
import { MenuFunc } from "./components/Menu";

interface PillboxButton {
  id: string;
  tooltip: string;
  iconClass: string;
  // popup should return a JSX element. Not sure of type
  popup: (desmodderController: Controller) => unknown;
}

export default class Controller {
  pluginsEnabled: { [key in PluginID]: boolean };
  view: View | null = null;
  expandedPlugin: PluginID | null = null;
  pluginSettings: {
    [plugin in PluginID]: { [key: string]: boolean };
  };

  // array of IDs
  pillboxButtonsOrder: string[] = ["main-menu"];
  // map button ID to setup
  pillboxButtons: {
    [id: string]: PillboxButton;
  } = {
    "main-menu": {
      id: "main-menu",
      tooltip: "DesModder Menu",
      iconClass: "dcg-icon-settings",
      popup: MenuFunc,
    },
  };
  // string if open, null if none are open
  pillboxMenuOpen: string | null = null;

  constructor() {
    this.pluginSettings = Object.fromEntries(
      pluginList.map((plugin) => [plugin.id, {}] as const)
    );
    this.pluginsEnabled = Object.fromEntries(
      pluginList.map((plugin) => [plugin.id, false] as const)
    );
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
    for (const plugin of pluginList) {
      this.applyDefaultConfig(plugin.id);
      if (plugin.enabledByDefault) {
        this.enablePlugin(plugin.id);
      }
      this.view && this.view.updateMenuView();
    }
    // here want to load config + enabled plugins from local storage + header
  }

  updateMenuView() {
    this.view?.updateMenuView();
  }

  addPillboxButton(info: PillboxButton) {
    this.pillboxButtons[info.id] = info;
    this.pillboxButtonsOrder.push(info.id);
    this.updateMenuView();
  }

  removePillboxButton(id: string) {
    this.pillboxButtonsOrder.splice(this.pillboxButtonsOrder.indexOf(id), 1);
    delete this.pillboxButtons[id];
    if (this.pillboxMenuOpen === id) {
      this.pillboxMenuOpen = null;
    }
    this.updateMenuView();
  }

  toggleMenu(id: string) {
    this.pillboxMenuOpen = this.pillboxMenuOpen === null ? id : null;
    this.updateMenuView();
  }

  closeMenu() {
    this.pillboxMenuOpen = null;
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
