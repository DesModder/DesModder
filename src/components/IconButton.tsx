import "./IconButton.less";
import { Component, jsx } from "#DCGView";
import { mergeClass, MaybeClassDict } from "#utils/utils.ts";

export default class IconButton extends Component<{
  iconClass: string;
  btnClass?: MaybeClassDict;
  onTap: (e: Event) => void;
  disabled?: boolean;
  small?: boolean;
}> {
  template() {
    return (
      <span
        role="button"
        class={() =>
          mergeClass(
            {
              "dsm-btn-icon": true,
              "dsm-btn-icon-disabled": this.props.disabled?.() ?? false,
              "dsm-btn-icon-small": this.props.small?.() ?? false,
            },
            this.props.btnClass?.()
          )
        }
        onTap={(e: Event) => !this.props.disabled?.() && this.props.onTap(e)}
      >
        <i class={() => this.props.iconClass()}></i>
      </span>
    );
  }
}
