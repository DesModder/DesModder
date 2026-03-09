import PillboxMenus from "..";
import { Component, jsx } from "#DCGView";
import { DropdownPopoverWithAnchorShim, Switch } from "#components";
import { format } from "#i18n";

export class PillboxButton extends Component<{
  pm: PillboxMenus;
  buttonId: string;
  horizontal: boolean;
}> {
  pm!: PillboxMenus;
  horizontal!: boolean;

  init() {
    this.pm = this.props.pm();
    this.horizontal = this.props.horizontal();
  }

  template() {
    const id = this.props.buttonId();
    return (
      <div
        // TODO-jared: mess of classes.
        class={{
          "dsm-pillbox-buttons": true,
          "dsm-pillbox-and-popover": true,
        }}
      >
        <DropdownPopoverWithAnchorShim
          tooltip={() => format(this.pm.pillboxButtons[id].tooltip)}
          tooltipGravity={() => (this.horizontal ? "s" : "w")}
          anchor={() => (
            <div
              class={() =>
                this.horizontal
                  ? "dcg-icon-btn dcg-pillbox-element"
                  : "dcg-btn-flat-gray dcg-settings-pillbox dcg-action-settings dcg-pillbox-btn-interior dsm-action-menu dcg-pillbox-element"
              }
              data-buttonId={id}
              role="button"
              // TODO: manageFocus?
            >
              <i class={() => this.pm.pillboxButtons[id].iconClass ?? ""} />
            </div>
          )}
          orientation={() => "left"}
          popoverBody={() => (
            <Switch key={this.props.buttonId}>
              {() =>
                this.pm.pillboxButtons[this.props.buttonId()].popup(this.pm)
              }
            </Switch>
          )}
          controlled={() => ({
            setDropdownOpen: (isOpen) => {
              this.pm.toggleMenu(this.props.buttonId(), isOpen);
            },
            isOpen:
              this.pm.pillboxMenuOpen === this.props.buttonId() &&
              this.pm.showHorizontalPillboxMenu() === this.horizontal,
          })}
        />
      </div>
    );
  }
}
