import { plugins, pluginList, PluginID } from "plugins";
import View from "./View";
import { MenuFunc } from "components/Menu";
import { listenToMessageDown, postMessageUp } from "utils/messages";
import { arraysEqual, OptionalProperties } from "utils/utils";
import { Calc } from "globals/window";
import GraphMetadata from "./metadata/interface";
import { getMetadata, setMetadata } from "./metadata/manage";

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
  graphMetadata: GraphMetadata = {};
  metadataChangeSuppressed: boolean = false;

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
    // default values
    this.pluginSettings = Object.fromEntries(
      pluginList.map(
        (plugin) => [plugin.id, this.getDefaultConfig(plugin.id)] as const
      )
    );
    this.pluginsEnabled = Object.fromEntries(
      pluginList.map((plugin) => [plugin.id, plugin.enabledByDefault] as const)
    );
  }

  getDefaultConfig(id: PluginID) {
    const out: { [key: string]: boolean } = {};
    const config = plugins[id].config;
    if (config !== undefined) {
      for (const configItem of config) {
        out[configItem.key] = configItem.default;
      }
    }
    return out;
  }

  applyStoredEnabled(storedEnabled: { [id: string]: boolean }) {
    for (const { id } of pluginList) {
      const stored = storedEnabled[id];
      if (stored !== undefined) {
        this.pluginsEnabled[id] = stored;
      }
    }
  }

  applyStoredSettings(storedSettings: {
    [id: string]: { [key: string]: boolean };
  }) {
    for (const { id } of pluginList) {
      const stored = storedSettings[id];
      if (stored !== undefined) {
        for (const key in this.pluginSettings[id]) {
          const storedValue = stored[key];
          if (storedValue !== undefined) {
            this.pluginSettings[id][key] = storedValue;
          }
        }
      }
    }
  }

  init(view: View) {
    // async
    let numFulfilled = 0;
    listenToMessageDown((message) => {
      if (message.type === "apply-plugin-settings") {
        this.applyStoredSettings(message.value);
      } else if (message.type === "apply-plugins-enabled") {
        this.applyStoredEnabled(message.value);
      } else {
        return;
      }
      // I'm not sure if the messages are guaranteed to be in the expected
      // order. Doesn't matter except for making sure we only
      // enable once
      numFulfilled += 1;
      if (numFulfilled === 2) {
        this.view = view;
        for (const { id } of pluginList) {
          if (this.pluginsEnabled[id]) {
            this._enablePlugin(id, true);
          }
        }
        this.view.updateMenuView();
        // cancel listener
        return true;
      }
    });
    // fire GET after starting listener in case it gets resolved before the listener begins
    postMessageUp({
      type: "get-initial-data",
    });
    // metadata stuff
    Calc.observeEvent("change.dsm-main-controller", () =>
      this.checkForMetadataChange()
    );
    this.checkForMetadataChange();
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
    this.pillboxMenuOpen = this.pillboxMenuOpen === id ? null : id;
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

  setPluginEnabled(i: PluginID, isEnabled: boolean) {
    this.pluginsEnabled[i] = isEnabled;
    postMessageUp({
      type: "set-plugins-enabled",
      value: this.pluginsEnabled,
    });
  }

  warnReload() {
    // TODO: proper UI, maybe similar to the "Opened graph '...'. Press Ctrl+Z to undo. <a>Undo</a>"
    // or equivalently (but within the calculator-api): "New graph created. Press Ctrl+Z to undo. <a>Undo</a>"
    // `location.reload()` allows reload directly from page JS
    alert("You must reload the page (Ctrl+R) for that change to take effect.");
  }

  disablePlugin(i: PluginID) {
    const plugin = plugins[i];
    if (plugin !== undefined) {
      if (this.pluginsEnabled[i]) {
        if (plugin.onDisable) {
          plugin.onDisable();
        } else {
          this.warnReload();
        }
        this.setPluginEnabled(i, false);
        this.updateMenuView();
      }
    }
  }

  _enablePlugin(id: PluginID, isReload: boolean) {
    const plugin = plugins[id];
    if (plugin !== undefined) {
      if (plugin.enableRequiresReload && !isReload) {
        this.warnReload();
      } else {
        plugin.onEnable(this.pluginSettings[id]);
      }
      this.setPluginEnabled(id, true);
      this.updateMenuView();
    }
  }

  enablePlugin(id: PluginID) {
    if (!this.pluginsEnabled[id]) {
      this.setPluginEnabled(id, true);
      this._enablePlugin(id, false);
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
    postMessageUp({
      type: "set-plugin-settings",
      value: this.pluginSettings,
    });
    if (doCallback && this.pluginsEnabled[pluginID]) {
      const onConfigChange = plugins[pluginID]?.onConfigChange;
      if (onConfigChange !== undefined) {
        onConfigChange(changes);
      }
    }
    this.updateMenuView();
  }

  checkForMetadataChange() {
    if (this.metadataChangeSuppressed) return;
    this.graphMetadata = getMetadata();
  }

  updateMetadata(obj: OptionalProperties<GraphMetadata>) {
    setMetadata({
      ...this.graphMetadata,
      ...obj,
    });
    Calc.controller.updateViews();
  }

  pinExpression(id: string) {
    const pinnedExpressions = this.graphMetadata.pinnedExpressions ?? [];
    const newPinnedExpressions = pinnedExpressions.concat(
      pinnedExpressions.includes(id) ? [] : [id]
    );
    this.updateMetadata({
      pinnedExpressions: newPinnedExpressions,
    });
  }

  unpinExpression(id: string) {
    this.updateMetadata({
      pinnedExpressions: (this.graphMetadata.pinnedExpressions ?? []).filter(
        (e) => e !== id
      ),
    });
  }

  isPinned(id: string) {
    return (
      this.pluginsEnabled["pin-expressions"] &&
      !Calc.controller.getExpressionSearchOpen() &&
      (this.graphMetadata.pinnedExpressions ?? []).includes(id)
    );
  }
}
