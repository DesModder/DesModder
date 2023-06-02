import { DCGView, MountedComponent } from "../DCGView";
import { PillboxContainer } from "../components";
import ExpressionActionButton from "../components/ExpressionActionButton";
import PillboxMenu from "../components/PillboxMenu";
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
import window, { Calc } from "globals/window";
import { plugins, pluginList, PluginID, GenericSettings } from "plugins";
import { postMessageUp, mapToRecord, recordToMap } from "utils/messages";

interface PillboxButton {
  id: string;
  tooltip: string;
  iconClass: string;
  pinned?: boolean;
  // popup should return a JSX element. Not sure of type
  popup: (c: MainController) => unknown;
}

export default class MainController {
  /**
   * pluginsEnabled keeps track of what plugins the user wants enabled,
   * regardless of forceDisabled settings.
   */
  private readonly pluginsEnabled: Map<PluginID, boolean>;
  private readonly forceDisabled: Set<string>;
  expandedPlugin: string | null = null;
  private expandedCategory: string | null = null;
  pluginSettings: Map<PluginID, GenericSettings>;

  /** Note that `enabledPlugins[key]` is truthy if and only if `key` is of
   * an enabled plugins. Otherwise, `enabledPlugins[key]` is undefined */
  enabledPlugins: typeof window.DSM = {};

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
  extraMountedComponents = new Map<HTMLElement, MountedComponent>();

  constructor() {
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
    Calc.controller.dispatcher.register((e) => {
      if (e.type === "toggle-graph-settings") {
        this.pillboxMenuPinned = false;
        this.closeMenu();
      }
    });
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
    this.updateMenuView();
    // metadata stuff
    Calc.observeEvent("change.dsm-main-controller", () => {
      this.checkForMetadataChange();
    });
    this.checkForMetadataChange();
    // The graph loaded before DesModder loaded, so DesModder was not available to
    // return true when asked isGlesmosMode. Refresh those expressions now
    this.enabledPlugins.glesmos?.checkGLesmos();
  }

  pillboxButtonsView(horizontal: boolean) {
    return DCGView.createElement(PillboxContainer as any, {
      controller: () => this,
      horizontal: DCGView.const(horizontal),
    });
  }

  pillboxMenuView(horizontal: boolean) {
    return DCGView.createElement("div", {
      didMount: (div: HTMLElement) => {
        this.extraMountedComponents.set(
          div,
          DCGView.mountToNode(PillboxMenu, div, {
            controller: () => this,
            horizontal: DCGView.const(horizontal),
          })
        );
      },
      willUnmount: (div: HTMLElement) => {
        this.extraMountedComponents.delete(div);
        DCGView.unmountFromNode(div);
      },
    });
  }

  updateExtraComponents() {
    this.extraMountedComponents.forEach((view) => view.update());
  }

  updateMenuView() {
    this.updateExtraComponents();
    Calc.controller.updateViews();
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

  isSomePillboxMenuOpen() {
    return this.pillboxMenuOpen !== null;
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

  showHorizontalPillboxMenu() {
    // Constant threshold, independent of this.controller.pillboxButtonsOrder.length
    // Maybe want to tweak the threshold if a fourth possible pillbox button is
    // added, or figure out a better layout at that point because it's starting
    // to be a lot of pillbox threshold.
    return (
      !Calc.settings.graphpaper ||
      (Calc.controller.isGeoUIActive() &&
        Calc.controller.computeMajorLayout().grapher.width > 500)
    );
  }

  setPluginEnabled(id: PluginID, isEnabled: boolean) {
    if (isEnabled && this.isPluginForceDisabled(id)) return;
    const same = isEnabled === this.pluginsEnabled.get(id);
    this.pluginsEnabled.set(id, isEnabled);
    if (id === "GLesmos") {
      // Need to refresh glesmos expressions
      this.enabledPlugins.glesmos?.checkGLesmos();
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
      if (this.isPluginEnabled(id)) {
        plugin.onDisable(this);
        this.pluginsEnabled.delete(id);
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete this.enabledPlugins[plugin.key];
        this.setPluginEnabled(id, false);
        this.updateMenuView();
        plugin.afterDisable?.();
      }
    }
  }

  _enablePlugin(id: PluginID) {
    const plugin = plugins.get(id);
    if (plugin !== undefined) {
      const res = plugin.onEnable(this, this.pluginSettings.get(id));
      this.enabledPlugins[plugin.key] = res ?? {};
      this.setPluginEnabled(id, true);
      this.updateMenuView();
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

  isPluginForceDisabled(id: PluginID) {
    return this.forceDisabled.has(id);
  }

  isPluginEnabled(id: PluginID) {
    return (
      !this.isPluginForceDisabled(id) && (this.pluginsEnabled.get(id) ?? false)
    );
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
    this.enabledPlugins.pinExpressions?.applyPinnedStyle();
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
    this.enabledPlugins.pinExpressions?.applyPinnedStyle();
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
