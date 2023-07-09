import { toggleString } from ".";
import "./inlineToggleWidget.less";
import { EditorView, WidgetType } from "@codemirror/view";
import { jsx } from "utils/utils";

class InlineToggleWidget extends WidgetType {
  constructor(readonly value: string, readonly path: string) {
    super();
  }

  eq(other: InlineToggleWidget) {
    return other.value === this.value && other.path === this.path;
  }

  toDOM(view: EditorView) {
    const isPoints = this.path.includes("points");
    return (
      <span class="dcg-toggle dsm-inline-toggle" role="radiogroup">
        {(isPoints
          ? ["POINT", "OPEN", "CROSS"]
          : ["SOLID", "DASHED", "DOTTED"]
        ).map((styleName) => {
          const res = (
            <span
              class={{
                "dcg-toggle-option": true,
                "dcg-selected-toggle": this.value === styleName,
              }}
              role="radio"
              tabindex="0"
            >
              <i
                class={
                  "dcg-icon-" +
                  (isPoints ? "" : "line-") +
                  styleName.toLowerCase()
                }
              />
            </span>
          ) as HTMLSpanElement;
          res.addEventListener("click", () => {
            return toggleString(
              view,
              view.posAtDOM(res),
              this.value,
              styleName
            );
          });
          return res;
        })}
      </span>
    );
  }
}

export default {
  paths: [".points.style", ".lines.style"],
  Widget: InlineToggleWidget,
};
