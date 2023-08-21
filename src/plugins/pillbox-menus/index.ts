import { If } from "../../components";
import { facetSourcesSpec, facetsSpec } from "../../dataflow";
import { Inserter } from "../../preload/replaceElement";
import { PluginController } from "../PluginController";
import { MenuFunc } from "./components/Menu";
import PillboxContainer from "./components/PillboxContainer";
import PillboxMenu from "./components/PillboxMenu";
import { DCGView } from "DCGView";
import { Calc } from "globals/window";
import { plugins, PluginID, ConfigItem } from "plugins";

declare module "dataflow" {
  interface Facets {
    pillboxButtons: {
      input: PillboxButton;
      output: readonly PillboxButton[];
    };
  }
  interface Computed {
    pillboxButtonsView: Inserter<{ horizontal: boolean }>;
    pillboxMenuView: Inserter<{ horizontal: boolean }>;
  }
}

export default class PillboxMenus extends PluginController<undefined> {
  static id = "pillbox-menus" as const;
  static enabledByDefault = true;
  expandedPlugin: PluginID | null = null;
  private expandedCategory: string | null = null;

  facets = facetsSpec({
    pillboxButtons: {
      combine: (buttons) => buttons,
    },
  });

  facetSources = facetSourcesSpec({
    pillboxButtons: {
      precedence: "highest",
      value: {
        id: "main-menu",
        tooltip: "menu-desmodder-tooltip",
        iconClass: "dsm-icon-desmodder",
        popup: MenuFunc,
      },
    },
  });

  computed = facetSourcesSpec({
    pillboxButtonsView: {
      deps: ["pillboxButtons"],
      compute: ({ pillboxButtons }) => {
        return ({ horizontal }) =>
          DCGView.createElement(PillboxContainer, {
            pm: DCGView.const(this),
            horizontal: DCGView.const(horizontal),
            buttons: DCGView.const(pillboxButtons),
          });
      },
    },
    pillboxMenuView: {
      deps: ["pillboxButtons"],
      compute: ({ pillboxButtons }) => {
        return ({ horizontal }) =>
          (DCGView.createElement as any)(
            If,
            { predicate: () => !!this.pillboxMenuOpen },
            () =>
              DCGView.createElement(PillboxMenu, {
                pm: DCGView.const(this),
                horizontal: DCGView.const(horizontal),
                buttons: DCGView.const(pillboxButtons),
              })
          );
      },
    },
  });

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

export interface PillboxButton {
  id: string;
  tooltip: string;
  iconClass: string;
  pinned?: boolean;
  // popup should return a JSX element. Not sure of type
  popup: (c: PillboxMenus) => unknown;
}
