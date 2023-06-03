import { PillboxController } from "..";
import "./PillboxContainer.less";
import { Component, jsx } from "DCGView";
import { If, Tooltip, For } from "components/desmosComponents";
import { Calc } from "globals/window";
import { format } from "i18n/i18n-core";

export default class PillboxContainer extends Component<{
  controller: PillboxController;
  horizontal: boolean;
}> {
  controller!: PillboxController;
  horizontal!: boolean;

  init() {
    this.controller = this.props.controller();
    this.horizontal = this.props.horizontal();
  }

  template() {
    return (
      <If
        predicate={() =>
          this.horizontal === this.controller.showHorizontalPillboxMenu()
        }
      >
        {() => this.templateTrue()}
      </If>
    );
  }

  templateTrue() {
    return (
      <div class="dsm-pillbox-and-popover">
        <For each={() => this.controller.pillboxButtonsOrder} key={(id) => id}>
          <div
            class={{
              "dsm-pillbox-buttons": true,
              "dsm-horizontal-pillbox": this.horizontal,
            }}
          >
            {(id: string) => (
              <Tooltip
                tooltip={() =>
                  format(this.controller.pillboxButtons[id].tooltip)
                }
                gravity={() => (this.horizontal ? "s" : "w")}
              >
                <div
                  class={() =>
                    this.horizontal
                      ? "dcg-icon-btn"
                      : "dcg-btn-flat-gray dcg-settings-pillbox dcg-action-settings dsm-action-menu"
                  }
                  role="button"
                  onTap={() => this.onTapMenuButton(id)}
                  // TODO: manageFocus?
                  style={() =>
                    this.horizontal
                      ? {}
                      : {
                          background:
                            Calc.controller.getPillboxBackgroundColor(),
                        }
                  }
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
          {() => this.controller.pillboxMenuView(false)}
        </If>
      </div>
    );
  }

  onTapMenuButton(id: string) {
    this.controller.toggleMenu(id);
  }
}
