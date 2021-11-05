import { plugins, pluginList, PluginID } from "plugins";
import View from "./View";
import { MenuFunc } from "components/Menu";
import { listenToMessageDown, postMessageUp } from "utils/messages";
import { OptionalProperties } from "utils/utils";
import { Calc, desmosRequire } from "globals/window";
import GraphMetadata, {
  Expression as MetadataExpression,
} from "./metadata/interface";
import {
  getMetadata,
  setMetadata,
  getBlankMetadata,
  changeExprInMetadata,
} from "./metadata/manage";
const AbstractItem = desmosRequire("graphing-calc/models/abstract-item");

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
  exposedPlugins: {
    [plugin in PluginID]?: any;
  } = {};
  graphMetadata: GraphMetadata = getBlankMetadata();
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
      iconClass: "dsm-icon-desmodder",
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
    if (this.isPluginToggleable(i)) {
      if (this.pluginsEnabled[i]) {
        if (plugin.onDisable) {
          plugin.onDisable();
          delete this.pluginsEnabled[i];
        } else {
          this.warnReload();
        }
        this.setPluginEnabled(i, false);
        this.updateMenuView();
        plugin.afterDisable?.();
      }
    }
  }

  _enablePlugin(id: PluginID, isReload: boolean) {
    const plugin = plugins[id];
    if (plugin !== undefined) {
      if (plugin.enableRequiresReload && !isReload) {
        this.warnReload();
      } else {
        const res = plugin.onEnable(this.pluginSettings[id]);
        if (res !== undefined) {
          this.exposedPlugins[id] = res;
        }
      }
      this.setPluginEnabled(id, true);
      this.updateMenuView();
    }
  }

  enablePlugin(id: PluginID) {
    if (this.isPluginToggleable(id) && !this.pluginsEnabled[id]) {
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

  isPluginToggleable(i: PluginID) {
    return !plugins[i].alwaysEnabled;
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
    this.applyPinnedStyle();
  }

  _updateExprMetadata(id: string, obj: OptionalProperties<MetadataExpression>) {
    changeExprInMetadata(this.graphMetadata, id, obj);
  }

  updateExprMetadata(id: string, obj: OptionalProperties<MetadataExpression>) {
    this._updateExprMetadata(id, obj);
    this.finishUpdateMetadata();
  }

  finishUpdateMetadata() {
    setMetadata(this.graphMetadata);
    this.applyPinnedStyle();
    Calc.controller.updateViews();
  }

  getDsmItemModel(id: string) {
    return this.graphMetadata.expressions[id];
  }

  pinExpression(id: string) {
    this.updateExprMetadata(id, {
      pinned: true,
    });
  }

  unpinExpression(id: string) {
    this.updateExprMetadata(id, {
      pinned: false,
    });
  }

  isPinned(id: string) {
    return (
      this.pluginsEnabled["pin-expressions"] &&
      !Calc.controller.getExpressionSearchOpen() &&
      this.graphMetadata.expressions[id]?.pinned
    );
  }

  hideError(id: string) {
    this.updateExprMetadata(id, {
      errorHidden: true,
    });
  }

  toggleErrorHidden(id: string) {
    this.updateExprMetadata(id, {
      errorHidden: !this.isErrorHidden(id),
    });
  }

  isErrorHidden(id: string) {
    return this.graphMetadata.expressions[id]?.errorHidden;
  }

  applyPinnedStyle() {
    const el = document.querySelector(".dcg-exppanel-container");
    const hasPinnedExpressions = Object.keys(
      this.graphMetadata.expressions
    ).some((id) => this.graphMetadata.expressions[id].pinned);
    el?.classList.toggle("dsm-has-pinned-expressions", hasPinnedExpressions);
  }

  folderDump(folderIndex: number) {
    const folderModel = Calc.controller.getItemModelByIndex(folderIndex);
    if (!folderModel || folderModel.type !== "folder") return;
    const folderId = folderModel?.id;

    // Remove folderId on all of the contents of the folder
    for (
      let currIndex = folderIndex + 1,
        currExpr = Calc.controller.getItemModelByIndex(currIndex);
      currExpr && currExpr.type !== "folder" && currExpr?.folderId === folderId;
      currIndex++, currExpr = Calc.controller.getItemModelByIndex(currIndex)
    ) {
      AbstractItem.setFolderId(currExpr, undefined);
    }

    // Replace the folder with text that has the same title
    const T = Calc.controller.createItemModel({
      id: Calc.controller.generateId(),
      type: "text",
      text: folderModel.title,
    });
    Calc.controller._toplevelReplaceItemAt(folderIndex, T, true);

    Calc.controller.updateViews();
  }

  folderMerge(folderIndex: number) {
    const folderModel = Calc.controller.getItemModelByIndex(folderIndex);
    const folderId = folderModel?.id;

    // Place all expressions until the next folder into this folder
    for (
      let currIndex = folderIndex + 1,
        currExpr = Calc.controller.getItemModelByIndex(currIndex);
      currExpr && currExpr.type !== "folder";
      currIndex++, currExpr = Calc.controller.getItemModelByIndex(currIndex)
    ) {
      AbstractItem.setFolderId(currExpr, folderId);
    }

    Calc.controller.updateViews();
  }

  noteEnclose(noteIndex: number) {
    // Replace this note with a folder, then folderMerge
    const noteModel = Calc.controller.getItemModelByIndex(noteIndex);
    if (!noteModel || noteModel.type !== "text") return;

    const T = Calc.controller.createItemModel({
      id: Calc.controller.generateId(),
      type: "folder",
      title: noteModel.text,
    });
    Calc.controller._toplevelReplaceItemAt(noteIndex, T, true);
    this.folderMerge(noteIndex);
  }

  isGlesmosMode(id: string) {
    return (
      this.pluginsEnabled["GLesmos"] &&
      this.graphMetadata.expressions[id]?.glesmos
      // TODO: reference canBeGLesmos
      /*
      canBeGLesmos(id: string) {
        const userData = this.context.statements[id].userData;
        const analysis = this.context.analysis[id];
        return (
          userData.type === "expression" &&
          userData.shouldGraph &&
          analysis.evaluationState.is_inequality &&
          analysis.evaluationState.is_graphable &&
          analysis.rawTree.type !== "Error" &&
          satisfiesType(analysis.rawTree, "BaseComparator") &&
          analysis.concreteTree.type === "IRExpression"
        );
      }*/
    );
  }

  toggleGlesmos(id: string) {
    this.updateExprMetadata(id, {
      glesmos: !this.isGlesmosMode(id),
    });
  }
}
