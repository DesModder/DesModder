import { Inserter, PluginController } from "../../plugins/PluginController";
import { MenuFunc } from "./components/Menu";
import { DCGView } from "#DCGView";
import { plugins, PluginID, ConfigItem } from "#plugins/index.ts";
import { createElementWrapped } from "../../preload/replaceElement";
import { PillboxButton } from "./components/PillboxButton";
import { PillboxContainer } from "./components/PillboxContainer";

export default class PillboxMenus extends PluginController<undefined> {
  static id = "pillbox-menus" as const;
  static enabledByDefault = true;
  static isCore = true;
  expandedPlugin: PluginID | null = null;
  private expandedCategory: string | null = null;
  private dispatcherID?: string;

  afterEnable() {
    this.dispatcherID = this.cc.dispatcher.register((e) => {
      if (e.type === "toggle-graph-settings") {
        this.pillboxMenuPinned = false;
        this.closeMenu();
      }
    });
  }

  afterDisable() {
    if (this.dispatcherID) this.cc.dispatcher.unregister(this.dispatcherID);
  }

  // array of IDs
  pillboxButtonsOrder: string[] = ["main-menu"];
  // map button ID to setup
  pillboxButtons: Record<string, PillboxButtonSpec> = {
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

  pushToPillboxList(list: { push: (buttonId: string) => void }) {
    for (const buttonId of this.pillboxButtonsOrder) {
      list.push("dsm-" + buttonId);
    }
  }

  pillboxContainerView(horizontal: boolean): Inserter {
    return () =>
      createElementWrapped(PillboxContainer, {
        pm: () => this,
        horizontal: DCGView.const(horizontal),
      });
  }

  pillboxButtonView(buttonId: string, horizontal: boolean): Inserter {
    return () =>
      createElementWrapped(PillboxButton, {
        pm: () => this,
        buttonId: DCGView.const(buttonId),
        horizontal: DCGView.const(horizontal),
      });
  }

  updateMenuView() {
    this.cc.dispatch({ type: "tick" });
  }

  addPillboxButton(info: PillboxButtonSpec) {
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
    if (
      this.pillboxMenuOpen &&
      this.cc.geometryGettingStartedMessageState !== "hidden"
    ) {
      this.cc.geometryGettingStartedMessageState = "hidden";
      this.cc.dispatch({ type: "tick" });
    }
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
    return !this.calc.settings.graphpaper;
  }

  getDefaultSetting(key: string) {
    return (
      this.expandedPlugin &&
      (
        plugins.get(this.expandedPlugin)?.config as ConfigItem[] | undefined
      )?.find((e) => e.key === key)?.default
    );
  }

  canResetSetting(key: string) {
    if (!this.expandedPlugin) return false;
    const defaultValue = this.getDefaultSetting(key);
    return (
      defaultValue !== undefined &&
      this.dsm.pluginSettings[this.expandedPlugin]?.[key] !== defaultValue
    );
  }

  resetSetting(key: string) {
    this.expandedPlugin &&
      this.canResetSetting(key) &&
      this.dsm.setPluginSetting(
        this.expandedPlugin,
        key,
        this.getDefaultSetting(key)!
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
}

interface PillboxButtonSpec {
  id: string;
  tooltip: string;
  iconClass: string;
  pinned?: boolean;
  // popup should return a JSX element. Not sure of type
  popup: (c: PillboxMenus) => unknown;
}
