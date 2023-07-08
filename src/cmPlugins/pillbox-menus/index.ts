import MainController from "../../MainController";
import { Inserter } from "../../plugins/PluginController";
import { CMPlugin } from "../CMPlugin";
import { MenuFunc } from "./components/Menu";
import PillboxContainer from "./components/PillboxContainer";
import PillboxMenu from "./components/PillboxMenu";
import { pillboxButton } from "./pillboxButtons";
import { EditorView, ViewPlugin } from "@codemirror/view";
import { DCGView } from "DCGView";
import { Calc } from "globals/window";
import { PluginID, ConfigItem, getPlugin } from "plugins";

export default class PillboxMenus extends CMPlugin {
  static id = "pillbox-menus" as const;
  expandedPlugin: PluginID | null = null;
  private expandedCategory: string | null = null;
  static enabledByDefault = false;

  // string if open, null if none are open
  pillboxMenuOpen: string | null = null;
  pillboxMenuPinned: boolean = false;

  constructor(view: EditorView, dsm: MainController) {
    super(view, dsm);
    Calc.controller.dispatcher.register((e) => {
      if (e.type === "toggle-graph-settings") {
        this.pillboxMenuPinned = false;
        this.closeMenu();
      }
    });
  }

  destroy() {
    throw new Error(
      "Programming Error: core plugin Pillbox Menus should not be disableable"
    );
  }

  update() {
    this.updateMenuView();
  }

  pillboxButtonsView(horizontal: boolean): Inserter {
    return () =>
      DCGView.createElement(PillboxContainer as any, {
        controller: () => this,
        horizontal: DCGView.const(horizontal),
      });
  }

  pillboxMenuView(horizontal: boolean): Inserter {
    if (this.pillboxMenuOpen === null) return undefined;
    return () =>
      DCGView.createElement(PillboxMenu as any, {
        controller: () => this,
        horizontal: DCGView.const(horizontal),
      });
  }

  updateMenuView() {
    Calc.controller.updateViews();
  }

  private getPillboxButtons() {
    return this.view.state.facet(pillboxButton);
  }

  getPillboxButtonsOrder() {
    return this.getPillboxButtons().map((x) => x.id);
  }

  /** Assumes `id` is an id of some plugin. Linear search, so accidentally quadratic. */
  getPillboxButton(id: string) {
    return this.getPillboxButtons().find((x) => x.id === id)!;
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

  getDefaultSetting(key: string) {
    return (
      this.expandedPlugin &&
      (
        getPlugin(this.expandedPlugin)?.config as ConfigItem[] | undefined
      )?.find((e) => e.key === key)?.default
    );
  }

  canResetSetting(key: string) {
    if (!this.expandedPlugin) return false;
    const defaultValue = this.getDefaultSetting(key);
    return (
      defaultValue !== undefined &&
      this.dsm.getPluginSettings(this.expandedPlugin)?.[key] !== defaultValue
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

export function pillboxMenus(dsm: MainController) {
  return ViewPlugin.define((view) => new PillboxMenus(view, dsm), {
    provide: () => [
      pillboxButton.of({
        id: "main-menu",
        tooltip: "menu-desmodder-tooltip",
        iconClass: "dsm-icon-desmodder",
        popup: MenuFunc,
      }),
    ],
  });
}
