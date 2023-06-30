import PillboxMenus from "..";
import "./PillboxMenu.less";
import { Component, jsx } from "DCGView";
import { If, Switch } from "components/desmosComponents";
import { Calc } from "globals/window";
import { jquery, keys } from "utils/depUtils";

export default class PillboxMenu extends Component<{
  controller: PillboxMenus;
  horizontal: boolean;
}> {
  controller!: PillboxMenus;
  horizontal!: boolean;

  init() {
    this.controller = this.props.controller();
    this.horizontal = this.props.horizontal();
  }

  template() {
    return (
      <If
        predicate={() =>
          this.controller.pillboxMenuOpen !== null &&
          this.controller.showHorizontalPillboxMenu() === this.horizontal
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
              ...this.getPopoverPosition(),
            })}
          >
            <Switch key={() => this.controller.pillboxMenuOpen}>
              {() =>
                this.controller.pillboxButtons[
                  this.controller.pillboxMenuOpen as string
                ]?.popup?.(this.controller)
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
      this.controller.closeMenu();
    }
  }

  didMountContainer() {
    if (Calc.controller.isGraphSettingsOpen()) {
      Calc.controller.dispatch({
        type: "close-graph-settings",
      });
    }
    jquery(document).on(
      `dcg-tapstart${this.suffix()} wheel${this.suffix()}`,
      (e: Event) => {
        if (this.eventShouldCloseMenu(e)) {
          this.controller.closeMenu();
        }
      }
    );
    document.addEventListener("keydown", this.onKeydown);
  }

  didUnmountContainer() {
    jquery(document).off(this.suffix());
    document.removeEventListener("keydown", this.onKeydown);
  }

  index() {
    let index = this.controller.pillboxButtonsOrder.indexOf(
      this.controller.pillboxMenuOpen as string
    );
    if (
      Calc.settings.settingsMenu &&
      (!Calc.controller.isGeometry() ||
        this.horizontal !== Calc.controller.isNarrowGeometryHeader())
    )
      index += 1;
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
