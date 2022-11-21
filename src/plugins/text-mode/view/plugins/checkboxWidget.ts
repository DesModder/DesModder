import { syntaxTree } from "@codemirror/language";
import {
  WidgetType,
  EditorView,
  Decoration,
  ViewUpdate,
  ViewPlugin,
  DecorationSet,
} from "@codemirror/view";

/**
 * Checkbox widget, modified from
 * https://codemirror.net/examples/decoration/#boolean-toggle-widgets
 */

class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean) {
    super();
  }

  eq(other: CheckboxWidget) {
    return other.checked === this.checked;
  }

  toDOM() {
    const wrap = document.createElement("span");
    wrap.setAttribute("aria-hidden", "true");
    wrap.className = "cm-boolean-toggle";
    const box = wrap.appendChild(document.createElement("input"));
    box.type = "checkbox";
    box.checked = this.checked;
    return wrap;
  }

  /**
   * Tell the editor to not ignore events that happen in the widget.
   * This is necessary to allow an editor-wide event handler (mousedown below,
   * the one that calls `toggleBoolean`) to handle interaction with it.
   */
  ignoreEvent() {
    return false;
  }
}

/**
 * Get checkboxes from a given view
 */
function checkboxes(view: EditorView) {
  const widgets: ReturnType<Decoration["range"]>[] = [];
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.name === "Identifier") {
          const text = view.state.doc.sliceString(node.from, node.to);
          // TODO: handle LHS true like `true = 7`. Maybe just disallow it;
          // prevent redefinition of variables?
          if (text !== "true" && text !== "false") return;
          const isTrue = text === "true";
          const deco = Decoration.widget({
            widget: new CheckboxWidget(isTrue),
            side: -1,
          });
          widgets.push(deco.range(node.from));
        }
      },
    });
  }
  return Decoration.set(widgets);
}

export const checkboxPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = checkboxes(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged)
        this.decorations = checkboxes(update.view);
    }
  },
  {
    decorations: (v) => v.decorations,

    eventHandlers: {
      mousedown: (e, view) => {
        const target = e.target as HTMLElement;
        if (
          target.nodeName === "INPUT" &&
          target.parentElement!.classList.contains("cm-boolean-toggle")
        ) {
          e.preventDefault();
          return toggleBoolean(view, view.posAtDOM(target));
        }
      },
    },
  }
);

function toggleBoolean(view: EditorView, pos: number) {
  const after = view.state.doc.sliceString(pos, pos + 5);
  let change;
  if (after === "false") change = { from: pos, to: pos + 5, insert: "true" };
  else if (after.startsWith("true"))
    change = { from: pos, to: pos + 4, insert: "false" };
  else return false;
  view.dispatch({ changes: change });
  return true;
}
