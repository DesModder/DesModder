import "./Button.less";
import { Component, jsx } from "DCGView";
import { mergeClass, MaybeClassDict } from "utils/utils";

export default class Button extends Component<{
  color: "primary" | "red" | "light-gray";
  class?: MaybeClassDict;
  onTap: (e: Event) => void;
  disabled?: boolean;
}> {
  template() {
    return (
      <span
        role="button"
        class={() =>
          mergeClass(
            {
              ["dcg-btn-" + this.props.color()]: true,
              "dsm-btn-disabled": this.props.disabled?.() ?? false,
              "dsm-btn": true,
            },
            this.props.class?.()
          )
        }
        onTap={(e: Event) => !this.props.disabled?.() && this.props.onTap(e)}
      >
        {this.children}
      </span>
    );
  }
}
