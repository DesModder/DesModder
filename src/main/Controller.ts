import { List } from "../utils/depUtils";
import View from "./View";
import GraphMetadata, {
  Expression as MetadataExpression,
} from "./metadata/interface";
import {
  getMetadata,
  setMetadata,
  getBlankMetadata,
  changeExprInMetadata,
} from "./metadata/manage";
import { MenuFunc } from "components/Menu";
import { ItemModel } from "globals/models";
import window, { Calc } from "globals/window";
import { format } from "i18n/i18n-core";
import { plugins, pluginList, PluginID, GenericSettings } from "plugins";
import {
  listenToMessageDown,
  postMessageUp,
  mapToRecord,
  recordToMap,
} from "utils/messages";
import { OptionalProperties } from "utils/utils";

interface PillboxButton {
  id: string;
  tooltip: string;
  iconClass: string;
  pinned?: boolean;
  // popup should return a JSX element. Not sure of type
  popup: (desmodderController: Controller) => unknown;
}

export default class Controller {
  pluginsEnabled: Map<PluginID, boolean>;
  forceDisabled: Set<string>;
  view: View | null = null;
  expandedPlugin: string | null = null;
  private expandedCategory: string | null = null;
  pluginSettings: Map<PluginID, GenericSettings>;

  exposedPlugins: Record<PluginID, any> = {};

  graphMetadata: GraphMetadata = getBlankMetadata();

  // array of IDs
  pillboxButtonsOrder: string[] = ["main-menu"];
  // map button ID to setup
  pillboxButtons: Record<string, PillboxButton> = {
    "main-menu": {
      id: "main-menu",
      tooltip: "menu-desmodder-tooltip",
      iconClass: "dsm-icon-desmodder",
      popup: MenuFunc,
    },
  };

  // string if open, null if none are open
  pillboxMenuOpen: string | null = null;

  pillboxMenuPinned: boolean = false;

  constructor() {
    // default values
    this.pluginSettings = new Map(
      pluginList.map(
        (plugin) => [plugin.id, this.getDefaultConfig(plugin.id)] as const
      )
    );
    this.forceDisabled = window.DesModderForceDisabled!;
    delete window.DesModderForceDisabled;
    this.pluginsEnabled = new Map(
      pluginList.map((plugin) => {
        const enabled =
          plugin.enabledByDefault && !this.forceDisabled.has(plugin.id);
        return [plugin.id, enabled] as const;
      })
    );
    Calc.controller.dispatcher.register((e) => {
      if (e.type === "toggle-graph-settings") {
        this.pillboxMenuPinned = false;
        this.closeMenu();
      }
    });
    // Provide an access point to translations for replacements
    // But not as a method, so it can't be used in TS
    (this as any).format = (key: string, args?: any) => {
      // eslint-disable-next-line rulesdir/no-format-in-ts
      return format(key, args);
    };
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
      if (stored && this.isPluginForceDisabled(id)) continue;
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

  init(view: View) {
    // async
    let numFulfilled = 0;
    listenToMessageDown((message) => {
      if (message.type === "apply-plugin-settings") {
        this.applyStoredSettings(recordToMap(message.value));
      } else if (message.type === "apply-plugins-enabled") {
        this.applyStoredEnabled(recordToMap(message.value));
      } else {
        return false;
      }
      // I'm not sure if the messages are guaranteed to be in the expected
      // order. Doesn't matter except for making sure we only
      // enable once
      numFulfilled += 1;
      if (numFulfilled === 2) {
        this.view = view;
        for (const { id } of pluginList) {
          if (this.pluginsEnabled.get(id)) {
            this._enablePlugin(id, true);
          }
        }
        this.view.updateMenuView();
        // cancel listener
        return true;
      }
      return false;
    });
    // fire GET after starting listener in case it gets resolved before the listener begins
    postMessageUp({
      type: "get-initial-data",
    });
    // metadata stuff
    Calc.observeEvent("change.dsm-main-controller", () => {
      this.checkForMetadataChange();
    });
    this.checkForMetadataChange();
    if (this.pluginsEnabled.get("GLesmos")) {
      // The graph loaded before DesModder loaded, so DesModder was not available to
      // return true when asked isGlesmosMode. Refresh those expressions now
      this.checkGLesmos();
    }
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
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete this.pillboxButtons[id];
    if (this.pillboxMenuOpen === id) {
      this.pillboxMenuOpen = null;
    }
    this.updateMenuView();
  }

  toggleMenu(id: string) {
    this.pillboxMenuOpen = this.pillboxMenuOpen === id ? null : id;
    this.pillboxMenuPinned = false;
    this.updateMenuView();
  }

  closeMenu() {
    if (this.pillboxMenuPinned) return;
    this.pillboxMenuOpen = null;
    this.updateMenuView();
  }

  toggleMenuPinned() {
    this.pillboxMenuPinned = !this.pillboxMenuPinned;
    this.updateMenuView();
  }

  getPlugin(id: PluginID) {
    return plugins.get(id);
  }

  getPluginsList() {
    return pluginList;
  }

  setPluginEnabled(id: PluginID, isEnabled: boolean) {
    if (isEnabled && this.isPluginForceDisabled(id)) return;
    this.pluginsEnabled.set(id, isEnabled);
    if (id === "GLesmos") {
      // Need to refresh glesmos expressions
      this.checkGLesmos();
    }
    postMessageUp({
      type: "set-plugins-enabled",
      value: mapToRecord(this.pluginsEnabled),
    });
  }

  warnReload() {
    // TODO: proper UI, maybe similar to the "Opened graph '...'. Press Ctrl+Z to undo. <a>Undo</a>"
    // or equivalently (but within the calculator-api): "New graph created. Press Ctrl+Z to undo. <a>Undo</a>"
    // `location.reload()` allows reload directly from page JS
    alert("You must reload the page (Ctrl+R) for that change to take effect.");
  }

  disablePlugin(id: PluginID) {
    const plugin = plugins.get(id);
    if (plugin && this.isPluginToggleable(id)) {
      if (this.pluginsEnabled.get(id)) {
        if (plugin.onDisable) {
          plugin.onDisable();
          this.pluginsEnabled.delete(id);
        } else {
          this.warnReload();
        }
        this.setPluginEnabled(id, false);
        this.updateMenuView();
        plugin.afterDisable?.();
      }
    }
  }

  _enablePlugin(id: PluginID, isReload: boolean) {
    const plugin = plugins.get(id);
    if (plugin !== undefined) {
      if (plugin.enableRequiresReload && !isReload) {
        this.warnReload();
      } else {
        const res = plugin.onEnable(this.pluginSettings.get(id));
        if (res !== undefined) {
          this.exposedPlugins[id] = res;
        }
      }
      this.setPluginEnabled(id, true);
      this.updateMenuView();
    }
  }

  enablePlugin(id: PluginID) {
    if (this.isPluginToggleable(id) && !this.pluginsEnabled.get(id)) {
      this.setPluginEnabled(id, true);
      this._enablePlugin(id, false);
    }
  }

  togglePlugin(id: PluginID) {
    if (this.pluginsEnabled.get(id)) {
      this.disablePlugin(id);
    } else {
      this.enablePlugin(id);
    }
  }

  isPluginForceDisabled(id: PluginID) {
    return this.forceDisabled.has(id);
  }

  isPluginEnabled(id: PluginID) {
    return this.pluginsEnabled.get(id) ?? false;
  }

  isPluginToggleable(id: PluginID) {
    return !this.isPluginForceDisabled(id);
  }

  togglePluginExpanded(i: PluginID) {
    if (this.expandedPlugin === i) {
      this.expandedPlugin = null;
    } else {
      this.expandedPlugin = i;
    }
    this.updateMenuView();
  }

  toggleCategoryExpanded(category: string) {
    if (this.expandedCategory === category) {
      this.expandedCategory = null;
    } else {
      this.expandedCategory = category;
    }
    this.updateMenuView();
  }

  isCategoryExpanded(category: string) {
    return this.expandedCategory === category;
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
    const proposedChanges = {
      [key]: value,
    };
    const manageConfigChange = plugins.get(pluginID)?.manageConfigChange;
    const changes =
      manageConfigChange !== undefined
        ? manageConfigChange(pluginSettings, proposedChanges)
        : proposedChanges;
    Object.assign(pluginSettings, changes);
    if (!temporary)
      postMessageUp({
        type: "set-plugin-settings",
        value: mapToRecord(this.pluginSettings),
      });
    if (this.pluginsEnabled.get(pluginID)) {
      const onConfigChange = plugins.get(pluginID)?.onConfigChange;
      if (onConfigChange !== undefined) {
        onConfigChange(changes, pluginSettings);
      }
    }
    this.updateMenuView();
  }

  getDefaultSetting(key: string) {
    return (
      this.expandedPlugin &&
      plugins.get(this.expandedPlugin)?.config?.find((e) => e.key === key)
        ?.default
    );
  }

  canResetSetting(key: string) {
    if (!this.expandedPlugin) return false;
    const defaultValue = this.getDefaultSetting(key);
    return (
      defaultValue !== undefined &&
      this.pluginSettings.get(this.expandedPlugin)?.[key] !== defaultValue
    );
  }

  resetSetting(key: string) {
    this.expandedPlugin &&
      this.canResetSetting(key) &&
      this.setPluginSetting(
        this.expandedPlugin,
        key,
        this.getDefaultSetting(key)!
      );
  }

  checkForMetadataChange() {
    const newMetadata = getMetadata();
    if (!this.pluginsEnabled.get("GLesmos")) {
      if (
        Object.entries(newMetadata.expressions).some(
          ([id, e]) => e.glesmos && !this.graphMetadata.expressions[id]?.glesmos
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
    this.applyPinnedStyle();
  }

  _updateExprMetadata(id: string, obj: OptionalProperties<MetadataExpression>) {
    changeExprInMetadata(this.graphMetadata, id, obj);
    setMetadata(this.graphMetadata);
  }

  duplicateMetadata(toID: string, fromID: string) {
    this._updateExprMetadata(toID, this.getDsmItemModel(fromID));
  }

  updateExprMetadata(id: string, obj: OptionalProperties<MetadataExpression>) {
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
    this.applyPinnedStyle();
    this.commitStateChange(false);
  }

  getDsmItemModel(id: string) {
    return this.graphMetadata.expressions[id];
  }

  pinExpression(id: string) {
    if (Calc.controller.getItemModel(id)?.type !== "folder")
      this.updateExprMetadata(id, {
        pinned: true,
      });
  }

  unpinExpression(id: string) {
    this.updateExprMetadata(id, {
      pinned: false,
    });
  }

  isExpressionPinned(id: string) {
    return (
      this.pluginsEnabled.get("pin-expressions") &&
      !Calc.controller.getExpressionSearchOpen() &&
      Calc.controller.getItemModel(id)?.type !== "folder" &&
      this.graphMetadata.expressions[id]?.pinned
    );
  }

  hideError(id: string) {
    if (!this.isPluginEnabled("hide-errors")) return;
    this.updateExprMetadata(id, {
      errorHidden: true,
    });
  }

  toggleErrorHidden(id: string) {
    if (!this.isPluginEnabled("hide-errors")) return;
    this.updateExprMetadata(id, {
      errorHidden: !this.isErrorHidden(id),
    });
  }

  isErrorHidden(id: string) {
    if (!this.isPluginEnabled("hide-errors")) return false;
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
      currExpr.folderId = undefined;
    }

    // Replace the folder with text that has the same title
    const T = Calc.controller.createItemModel({
      id: Calc.controller.generateId(),
      type: "text",
      text: folderModel.title,
    });
    Calc.controller._toplevelReplaceItemAt(folderIndex, T, true);

    this.commitStateChange(true);
  }

  folderMerge(folderIndex: number) {
    const folderModel = Calc.controller.getItemModelByIndex(folderIndex);
    const folderId = folderModel?.id;

    // type cast beacuse Desmos has not yet updated types for authorFeatures
    const skipAuthors = !(Calc.settings as any).authorFeatures;

    let newIndex = folderIndex;
    let currIndex = folderIndex;
    let currExpr: ItemModel | undefined;
    // we might want to delete the folder heading immediately after this folder
    // at most one; keep track if we've seen any expressions since the end of
    // this folder, so we only delete a folder with no expressions in between
    let movedAny = false;
    // Keep track of if we've deleted a folder
    let toDeleteFolderID = "";
    // Place all expressions until the next folder into this folder
    while (true) {
      newIndex++;
      currIndex++;
      currExpr = Calc.controller.getItemModelByIndex(currIndex);
      if (currExpr === undefined) break;
      // If authorFeatures is disabled, skip secret folders
      if (skipAuthors) {
        while (currExpr?.type === "folder" && currExpr.secret) {
          const secretID = currExpr.id;
          do {
            currIndex++;
            currExpr = Calc.controller.getItemModelByIndex(currIndex);
          } while (
            currExpr &&
            currExpr.type !== "folder" &&
            currExpr.folderId === secretID
          );
        }
        if (currExpr === undefined) break;
      }
      if (currExpr.type === "folder") {
        if (!movedAny) {
          // This is a folder immediately after the end of our starting folder
          // Mark it to delete, and move on.
          newIndex--;
          movedAny = true;
          toDeleteFolderID = currExpr.id;
        } else break;
      } else if (currExpr.folderId !== folderId) {
        if (toDeleteFolderID && !currExpr.folderId) break;
        movedAny = true;
        // Actually move the item into place
        currExpr.folderId = folderId;
        List.moveItemsTo(Calc.controller.listModel, currIndex, newIndex, 1);
      }
    }
    if (toDeleteFolderID)
      List.removeItemById(Calc.controller.listModel, toDeleteFolderID);

    this.commitStateChange(true);
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

    this.commitStateChange(true);
  }

  checkGLesmos() {
    const glesmosIDs = Object.keys(this.graphMetadata.expressions).filter(
      (id) => this.graphMetadata.expressions[id].glesmos
    );
    if (glesmosIDs.length > 0) {
      glesmosIDs.map((id) => this.toggleExpr(id));
      this.killWorker();
    }
  }

  canBeGLesmos(id: string) {
    let model;
    return (
      this.pluginsEnabled.get("GLesmos") &&
      (model = Calc.controller.getItemModel(id)) &&
      model.type === "expression" &&
      model.formula &&
      model.formula.expression_type === "IMPLICIT"
    );
  }

  isGlesmosMode(id: string) {
    if (!this.pluginsEnabled.get("GLesmos")) return false;
    this.checkForMetadataChange();
    return this.graphMetadata.expressions[id]?.glesmos ?? false;
  }

  toggleGlesmos(id: string) {
    this.updateExprMetadata(id, {
      glesmos: !this.isGlesmosMode(id),
    });
    this.forceWorkerUpdate(id);
  }

  forceWorkerUpdate(id: string) {
    // force the worker to revisit the expression
    this.toggleExpr(id);
    this.killWorker();
  }

  /** Returns boolean or undefined (representing "worker has not told me yet") */
  isInequality(id: string) {
    const model = Calc.controller.getItemModel(id);
    if (model?.type !== "expression") return false;
    return model.formula?.is_inequality;
  }

  isGLesmosLinesConfirmed(id: string) {
    this.checkForMetadataChange();
    return this.graphMetadata.expressions[id]?.glesmosLinesConfirmed ?? false;
  }

  toggleGLesmosLinesConfirmed(id: string) {
    this.updateExprMetadata(id, {
      glesmosLinesConfirmed: !this.isGLesmosLinesConfirmed(id),
    });
    this.forceWorkerUpdate(id);
  }

  /**
   * Force the worker to revisit this expression by toggling it hidden then
   * un-hidden
   */
  toggleExpr(id: string) {
    Calc.controller.dispatch({
      type: "toggle-item-hidden",
      id,
    });
    Calc.controller.dispatch({
      type: "toggle-item-hidden",
      id,
    });
  }

  killWorker() {
    Calc.controller.evaluator.workerPoolConnection.killWorker();
  }

  toggleTextMode() {
    this.exposedPlugins["text-mode"].toggleTextMode();
  }

  inTextMode() {
    return (
      this.isPluginEnabled("text-mode") &&
      this.exposedPlugins["text-mode"]?.inTextMode
    );
  }
}
