import { format } from "../i18n/i18n-core";
import "./PillboxContainer.less";
import { If, Tooltip, For, Switch } from "./desmosComponents";
import { Component, jsx } from "DCGView";
import { Calc } from "globals/window";
import Controller from "main/Controller";
import { jquery, keys } from "utils/depUtils";

export default class PillboxContainer extends Component<{
  controller: Controller;
}> {
  controller!: Controller;

  init() {
    this.controller = this.props.controller();
  }

  template() {
    return (
      <div>
        <For each={() => this.controller.pillboxButtonsOrder} key={(id) => id}>
          <div class="dsm-pillbox-buttons">
            {(id: string) => (
              <Tooltip
                tooltip={() =>
                  format(this.controller.pillboxButtons[id].tooltip)
                }
                gravity="w"
              >
                <div
                  class="dcg-btn-flat-gray dcg-settings-pillbox dcg-action-settings dsm-action-menu"
                  role="button"
                  onTap={() => this.onTapMenuButton(id)}
                  // TODO: manageFocus?
                  style={{
                    background: Calc.controller.getPillboxBackgroundColor(),
                  }}
                >
                  <i
                    class={() =>
                      this.controller.pillboxButtons[id].iconClass ?? ""
                    }
                  />
                </div>
              </Tooltip>
            )}
          </div>
        </For>
        <If predicate={() => this.controller.pillboxMenuOpen !== null}>
          {() => (
            <div
              class="dcg-settings-container dsm-menu-container dcg-left dcg-popover dcg-constrained-height-popover"
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
      </div>
    );
  }

  getPopoverPosition() {
    let index = this.controller.pillboxButtonsOrder.indexOf(
      this.controller.pillboxMenuOpen as string
    );
    if (Calc.settings.settingsMenu) {
      index += 1;
    }
    // for index=0, this would correspond to the wrench menu,
    // which is positioned at top=2, right=38.
    let top = 2;
    let right = 38;
    // scale linearly past index=0
    if (Calc.settings.graphpaper) {
      top += 43 * index;
    } else {
      right += 43 * index;
    }
    return {
      top: top.toString() + "px",
      right: right.toString() + "px",
      bottom: 0,
    };
  }

  onTapMenuButton(id: string) {
    this.controller.toggleMenu(id);
  }

  didMountContainer() {
    if (Calc.controller.isGraphSettingsOpen()) {
      Calc.controller.dispatch({
        type: "close-graph-settings",
      });
    }
    jquery(document).on(
      "dcg-tapstart.menu-view wheel.menu-view",
      (e: Event) => {
        if (this.eventShouldCloseMenu(e)) {
          this.controller.closeMenu();
        }
      }
    );
    jquery(document).on("keydown.menu-view", (e: KeyboardEvent) => {
      if (keys.lookup(e) === "Esc") {
        this.controller.closeMenu();
      }
    });
  }

  didUnmountContainer() {
    jquery(document).off(".menu-view");
  }

  eventShouldCloseMenu(e: Event) {
    // this.node refers to the generated node from DCGView
    const el = jquery(e.target);
    return (
      !el.closest(
        "_domNode" in this._element
          ? this._element._domNode
          : this._element._element._domNode
      ).length && !el.closest(".dsm-action-menu").length
    );
  }
}
