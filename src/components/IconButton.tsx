import { Component, jsx } from "DCGView";
import { mergeClass, MaybeClassDict } from "utils/utils";
import { Tooltip } from "./desmosComponents";
import "./IconButton.less";

export default class IconButton extends Component<{
  iconClass: string;
  class?: MaybeClassDict;
  onTap(e: Event): void;
  disabled?: boolean;
}> {
  template() {
    return (
      <span
        role="button"
        class={() =>
          mergeClass(
            {
              "dsm-btn-icon-disabled": this.props.disabled?.() || false,
              "dsm-btn-icon": true,
            },
            this.props.class?.()
          )
        }
        onTap={(e: Event) => !this.props.disabled?.() && this.props.onTap(e)}
      >
        <i class={() => this.props.iconClass()}></i>
      </span>
    );
  }
}
