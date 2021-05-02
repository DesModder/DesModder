import DCGView from "DCGView";
import { If, Tooltip, For } from "./desmosComponents";
import { jquery, keys } from "utils";
import Controller from "Controller";
import { Calc } from "globals/window";

export default class PillboxContainer extends DCGView.Class<{
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
          <div>
            {(id: string) => (
              <Tooltip
                tooltip={() =>
                  this.controller.pillboxButtons[id]?.tooltip ?? ""
                }
                gravity="w"
              >
                <div
                  class="dcg-btn-flat-gray dcg-settings-pillbox dcg-action-settings desmodder-action-menu"
                  role="button"
                  onTap={() => this.onTapMenuButton(id)}
                  // TODO: manageFocus?
                  style={{
                    background: Calc.controller.getPillboxBackgroundColor(),
                  }}
                >
                  <i
                    class={() =>
                      this.controller.pillboxButtons[id]?.iconClass ?? ""
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
              class="dcg-settings-container desmodder-menu-container dcg-left dcg-popover dcg-constrained-height-popover"
              didMount={() => this.didMountContainer()}
              didUnmount={() => this.didUnmountContainer()}
              style={() => ({
                position: "absolute",
                top: `46px`,
                right: "38px",
                "line-height": "1em",
              })}
            >
              {this.controller.pillboxButtons[
                this.controller.pillboxMenuOpen as string
              ]?.popup?.(this.controller)}
              <div class="dcg-arrow" />
            </div>
          )}
        </If>
      </div>
    );
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
      ).length && !el.closest(".desmodder-action-menu").length
    );
  }
}
