import { WidgetType } from "@codemirror/view";
import { jsx } from "utils/utils";
import "./inlineToggle.less";

class LineStyleWidget extends WidgetType {
  constructor(readonly value: string) {
    super();
  }

  eq(other: LineStyleWidget) {
    return other.value == this.value;
  }

  toDOM() {
    return (
      <span
        class="dcg-toggle dsm-inline-toggle dcg-line-style-toggle"
        role="radiogroup"
        data-selected={this.value}
      >
        {["SOLID", "DASHED", "DOTTED"].map((styleName) => (
          <span
            class={{
              "dcg-toggle-option": true,
              "dcg-selected-toggle": this.value === styleName,
            }}
            role="radio"
            tabindex="0"
            data-style={styleName}
            ontap
          >
            <i class={"dcg-icon-line-" + styleName.toLowerCase()} />
          </span>
        ))}
      </span>
    );
  }

  /**
   * Tell the editor to not ignore events that happen in the widget. This is
   * necessary to allow the eventHandler on the index to handle the event
   */
  ignoreEvent() {
    return false;
  }
}

const styleMappingWidget = {
  path: ".lines.style",
  widget: LineStyleWidget,
};

export default styleMappingWidget;
