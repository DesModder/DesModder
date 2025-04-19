import PillboxMenus from "..";
import "./PillboxMenu.less";
import { Component, jsx } from "#DCGView";
import { If, Switch } from "#components";
import { keys } from "#utils/depUtils.ts";

export default class PillboxMenu extends Component<{
  pm: PillboxMenus;
  horizontal: boolean;
}> {
  pm!: PillboxMenus;
  horizontal!: boolean;

  init() {
    this.pm = this.props.pm();
    this.horizontal = this.props.horizontal();
  }

  template() {
    return (
      <If
        predicate={() =>
          this.pm.pillboxMenuOpen !== null &&
          this.pm.showHorizontalPillboxMenu() === this.horizontal
        }
      >
        {() => (
          <div
            class={() => ({
              "dcg-settings-container": !this.horizontal,
              "dcg-geometry-settings-container": this.horizontal,
              "dsm-menu-container": true,
              "dcg-left": !this.horizontal,
              "dcg-popover": true,
              "dcg-constrained-height-popover": true,
            })}
            didMount={() => this.didMountContainer()}
            didUnmount={() => this.didUnmountContainer()}
            style={() => ({
              position: "absolute",
              "min-width": "min-content",
              ...this.getPopoverPosition(),
            })}
          >
            <Switch key={() => this.pm.pillboxMenuOpen}>
              {() =>
                this.pm.pillboxButtons[this.pm.pillboxMenuOpen!]?.popup?.(
                  this.pm
                )
              }
            </Switch>
            <div class="dcg-arrow" />
          </div>
        )}
      </If>
    );
  }

  suffix() {
    return ".dsm-menu-view" + (this.horizontal ? "-horizontal" : "");
  }

  onKeydown = this._onKeydown.bind(this);
  _onKeydown(e: KeyboardEvent) {
    if (keys.lookup(e) === "Esc") {
      e.stopImmediatePropagation();
      this.pm.closeMenu();
    }
  }

  generalEventHandler = this._generalEventHandler.bind(this);
  _generalEventHandler(e: Event) {
    if (e.type === "keydown") {
      const ek = e as KeyboardEvent;
      if (ek.key !== "Enter" && ek.key !== " ") return;
    }
    if (this.eventShouldCloseMenu(e)) {
      this.pm.closeMenu();
    }
  }

  generalEventNames = [
    "keydown",
    "mousedown",
    "pointerdown",
    "touchstart",
    "wheel",
  ];

  didMountContainer() {
    if (this.pm.cc.isGraphSettingsOpen()) {
      // don't dispatch during tick
      setTimeout(() => {
        this.pm.cc.dispatch({
          type: "close-graph-settings",
        });
      });
    }
    this.generalEventNames.forEach((name) =>
      document.addEventListener(name, this.generalEventHandler)
    );
    document.addEventListener("keydown", this.onKeydown);
  }

  didUnmountContainer() {
    this.generalEventNames.forEach((name) =>
      document.removeEventListener(name, this.generalEventHandler)
    );
    document.removeEventListener("keydown", this.onKeydown);
  }

  index() {
    let index = this.pm.pillboxButtonsOrder.indexOf(this.pm.pillboxMenuOpen!);
    if (this.pm.cc.graphSettings.config.settingsMenu) index += 1;
    return index;
  }

  getPopoverPosition() {
    const index = this.index();
    return this.horizontal
      ? {
          top: "50px",
          "--dsm-popover-arrow-right": `${8 + 39 * index}px`,
        }
      : {
          top: `${2 + 43 * index}px`,
          right: "38px",
          bottom: 0,
        };
  }

  eventShouldCloseMenu(e: Event) {
    // this.node refers to the generated node from DCGView
    const el = e.target;
    if (!(el instanceof Element)) return false;
    return (
      !el.closest(".dsm-menu-container") &&
      !el.closest(".dsm-pillbox-and-popover") &&
      !el.closest(".dsm-action-menu")
    );
  }
}
