import DCGView from "DCGView";
import { mergeClass, MaybeClassDict } from "utils";
import "./Button.less";

export default class Button extends DCGView.Class<{
  color: "blue" | "green" | "red" | "light-gray";
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
              ["dcg-btn-" + this.props.color()]: true,
              "desmodder-btn-disabled":
                (this.props.disabled && this.props.disabled()) || false,
              "desmodder-btn": true,
            },
            this.props.class && this.props.class()
          )
        }
        onTap={(e: Event) =>
          !(this.props.disabled && this.props.disabled()) && this.props.onTap(e)
        }
      >
        {this.children}
      </span>
    );
  }
}
