import PillboxMenus from "..";
import "./PillboxContainer.less";
import { Component, jsx } from "#DCGView";
import { If, For } from "#components";
import { PillboxButton } from "./PillboxButton";

export class PillboxContainer extends Component<{
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
          this.horizontal === this.pm.showHorizontalPillboxMenu()
        }
      >
        {() => this.templateTrue()}
      </If>
    );
  }

  templateTrue() {
    return (
      <div
        class={{
          "dsm-pillbox-and-popover": true,
          "dsm-pillbox-buttons": true,
          "dsm-horizontal-pillbox": this.horizontal,
        }}
      >
        <For each={() => this.pm.pillboxButtonsOrder} key={(id) => id}>
          {(getId: () => string) => (
            <PillboxButton
              buttonId={getId()}
              pm={this.pm}
              horizontal={this.horizontal}
            />
          )}
        </For>
      </div>
    );
  }

  onTapMenuButton(id: string) {
    this.pm.toggleMenu(id);
  }
}
