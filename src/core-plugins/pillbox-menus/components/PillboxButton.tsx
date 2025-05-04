import PillboxMenus from "..";
import { Component, jsx } from "#DCGView";
import { Tooltip } from "#components";
import { format } from "#i18n";
import PillboxMenu from "./PillboxMenu";

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
        <Tooltip
          tooltip={() => format(this.pm.pillboxButtons[id].tooltip)}
          gravity={() => (this.horizontal ? "s" : "w")}
        >
          <div
            class={() =>
              this.horizontal
                ? "dcg-icon-btn"
                : "dcg-btn-flat-gray dcg-settings-pillbox dcg-action-settings dcg-pillbox-btn-interior dsm-action-menu"
            }
            data-buttonId={id}
            role="button"
            onTap={() => this.onTapMenuButton(id)}
            // TODO: manageFocus?
          >
            <i class={() => this.pm.pillboxButtons[id].iconClass ?? ""} />
          </div>
        </Tooltip>
        {
          <PillboxMenu
            pm={this.pm}
            horizontal={this.horizontal}
            buttonId={this.props.buttonId()}
          />
        }
      </div>
    );
  }

  onTapMenuButton(id: string) {
    this.pm.toggleMenu(id);
  }
}
