import { Inserter, PluginController } from "../PluginController";
import { FacetSource } from "../dataflow";
import { MenuFunc } from "./components/Menu";
import PillboxContainer from "./components/PillboxContainer";
import PillboxMenu from "./components/PillboxMenu";
import { DCGView } from "DCGView";
import { Calc } from "globals/window";
import { plugins, PluginID, ConfigItem } from "plugins";

export default class PillboxMenus extends PluginController<undefined> {
  static id = "pillbox-menus" as const;
  static enabledByDefault = true;
  expandedPlugin: PluginID | null = null;
  private expandedCategory: string | null = null;

  facets = [
    {
      facetID: "pillbox-buttons",
      combine: (values: readonly PillboxButton[]): readonly PillboxButton[] => {
        return values;
      },
    },
  ];

  facetSources: FacetSource[] = [
    {
      facetID: "pillbox-buttons",
      deps: [],
      precedence: "highest",
      compute: () => ({
        id: "main-menu",
        tooltip: "menu-desmodder-tooltip",
        iconClass: "dsm-icon-desmodder",
        popup: MenuFunc,
      }),
    },
  ];

  afterEnable() {
    Calc.controller.dispatcher.register((e) => {
      if (e.type === "toggle-graph-settings") {
        this.pillboxMenuPinned = false;
        this.closeMenu();
      }
    });
  }

  // string if open, null if none are open
  pillboxMenuOpen: string | null = null;
  pillboxMenuPinned: boolean = false;

  beforeDisable() {
    throw new Error(
      "Programming Error: core plugin Pillbox Menus should not be disableable"
    );
  }

  private getPillboxButtons() {
    return this.dsm.getFacetValue("pillbox-buttons") as PillboxButton[];
  }

  getPillboxButtonsOrder() {
    return this.getPillboxButtons().map((x) => x.id);
  }

  /** Assumes `id` is an id of some menu. Linear search, so accidentally quadratic. */
  getPillboxButton(id: string) {
    return this.getPillboxButtons().find((x) => x.id === id)!;
  }

  pillboxButtonsView(horizontal: boolean): Inserter {
    return () =>
      DCGView.createElement(PillboxContainer, {
        pm: () => this,
        horizontal: DCGView.const(horizontal),
      });
  }

  pillboxMenuView(horizontal: boolean): Inserter {
    if (this.pillboxMenuOpen === null) return undefined;
    return () =>
      DCGView.createElement(PillboxMenu, {
        pm: () => this,
        horizontal: DCGView.const(horizontal),
      });
  }

  updateMenuView() {
    Calc.controller.updateViews();
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
    // Constant threshold, independent of this.pillboxButtonsOrder.length
    // Maybe want to tweak the threshold if a fourth possible pillbox button is
    // added, or figure out a better layout at that point because it's starting
    // to be a lot of pillbox threshold.
    return (
      !Calc.settings.graphpaper ||
      (Calc.controller.isGeoUIActive() &&
        Calc.controller.computeMajorLayout().grapher.width > 500)
    );
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

interface PillboxButton {
  id: string;
  tooltip: string;
  iconClass: string;
  pinned?: boolean;
  // popup should return a JSX element. Not sure of type
  popup: (c: PillboxMenus) => unknown;
}
