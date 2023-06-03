import MainController from "../../main/Controller";
import { PluginController } from "../PluginController";
import { MenuFunc } from "./components/Menu";
import PillboxContainer from "./components/PillboxContainer";
import PillboxMenu from "./components/PillboxMenu";
import { DCGView, MountedComponent } from "DCGView";
import { Calc } from "globals/window";
import { plugins, Plugin, PluginID } from "plugins";

export class PillboxController extends PluginController {
  expandedPlugin: string | null = null;
  private expandedCategory: string | null = null;

  constructor(mainController: MainController) {
    super(mainController);
    Calc.controller.dispatcher.register((e) => {
      if (e.type === "toggle-graph-settings") {
        this.pillboxMenuPinned = false;
        this.closeMenu();
      }
    });
  }

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
      this.controller.pluginSettings.get(this.expandedPlugin)?.[key] !==
        defaultValue
    );
  }

  resetSetting(key: string) {
    this.expandedPlugin &&
      this.canResetSetting(key) &&
      this.controller.setPluginSetting(
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
  popup: (c: PillboxController) => unknown;
}

const pillboxMenus: Plugin = {
  id: "pillbox-menus",
  key: "pillboxMenus",
  onEnable: (c) => {
    return new PillboxController(c);
  },
  onDisable: null,
  enabledByDefault: true,
} as const;
export default pillboxMenus;
