import { WidgetType } from "@codemirror/view";
import { EditorView, Decoration } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { ViewUpdate, ViewPlugin, DecorationSet } from "@codemirror/view";
import { jsx } from "utils/utils";
import { SyntaxNode } from "@lezer/common";
import "./lineStyleWidget.less";

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
          >
            <i class={"dcg-icon-line-" + styleName.toLowerCase()} />
          </span>
        ))}
      </span>
    );
  }

  /**
   * Tell the editor to not ignore events that happen in the widget.
   * This is necessary to allow an editor-wide event handler (mousedown below,
   * the one that calls `toggleString`) to handle interaction with it.
   */
  ignoreEvent() {
    return false;
  }
}

/**
 * Get widget locations from a given view
 */
function lineStyles(view: EditorView) {
  let widgets: ReturnType<Decoration["range"]>[] = [];
  for (let { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.name == "MappingEntry") {
          // const text = view.state.doc.sliceString(node.from, node.to);
          // // TODO: handle LHS true like `true = 7`. Maybe just disallow it;
          // // prevent redefinition of variables?
          // if (text !== "true" && text !== "false") return;
          // let isTrue = text == "true";
          const path = stylePath(view, node.node);
          if (path === ".lines.style") {
            const value = node.node.getChild(":")!.nextSibling;
            if (value?.name === "String") {
              const deco = Decoration.widget({
                widget: new LineStyleWidget(
                  JSON.parse(view.state.doc.sliceString(value.from, value.to))
                ),
                side: -1,
              });
              widgets.push(deco.range(value.from));
            }
          }
        }
      },
    });
  }
  return Decoration.set(widgets);
}

function stylePath(view: EditorView, node: SyntaxNode): string {
  return node.name === "StyleMapping"
    ? stylePath(view, node.parent!)
    : node.name === "MappingEntry"
    ? stylePath(view, node.parent!) +
      "." +
      view.state.doc.sliceString(node.firstChild!.from, node.firstChild!.to)
    : "";
}

export const lineStylePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = lineStyles(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged)
        this.decorations = lineStyles(update.view);
    }
  },
  {
    decorations: (v) => v.decorations,

    eventHandlers: {
      mousedown: (e, view) => {
        let target = e.target as HTMLElement;
        const option = target.closest(
          ".dcg-toggle-option"
        ) as HTMLElement | null;
        const toggle = target.closest(".dcg-toggle") as HTMLElement | null;
        if (option && toggle) {
          toggleString(
            view,
            view.posAtDOM(target),
            toggle.dataset.selected!,
            option.dataset.style!
          );
        }
      },
    },
  }
);

function toggleString(view: EditorView, pos: number, from: string, to: string) {
  let after = view.state.doc.sliceString(pos + 1, pos + from.length + 1);
  if (after === from) {
    view.dispatch({
      changes: {
        from: pos + 1,
        to: pos + from.length + 1,
        insert: to,
      },
    });
    return true;
  }
  return false;
}
