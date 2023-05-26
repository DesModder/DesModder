import { format } from "../i18n/i18n-core";
import { Tooltip } from "./desmosComponents";
import { Component, jsx } from "DCGView";

export default class ExpressionActionButton extends Component<{
  tooltip: string;
  buttonClass: string;
  iconClass: string;
  onTap: () => void;
}> {
  template() {
    return (
      <Tooltip tooltip={format(this.props.tooltip())} gravity="s">
        <span
          class={
            this.props.buttonClass() +
            " dsm-stay-edit-list-mode dcg-exp-action-button"
          }
          handleEvent="true"
          role="button"
          tabindex="0"
          onTap={() => this.props.onTap()}
        >
          <i class={this.props.iconClass() + " dsm-stay-edit-list-mode"}></i>
        </span>
      </Tooltip>
    );
  }
}
