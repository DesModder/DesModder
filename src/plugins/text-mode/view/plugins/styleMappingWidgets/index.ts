import { WidgetType } from "@codemirror/view";
import { EditorView, Decoration } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { ViewUpdate, ViewPlugin, DecorationSet } from "@codemirror/view";
import { SyntaxNode } from "@lezer/common";
import inlineToggleWidget from "./inlineToggleWidget";
import imageWidget from "./imageWidget";

const widgetSpecs: StyleMappingWidgetSpec[] = [inlineToggleWidget, imageWidget];

interface StyleMappingWidgetSpec {
  paths: string[];
  widget: new (value: string, path: string) => WidgetType;
}

export const styleMappingPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = getWidgets(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged)
        this.decorations = getWidgets(update.view);
    }
  },
  { decorations: (v) => v.decorations }
);

export function toggleString(
  view: EditorView,
  pos: number,
  from: string,
  to: string
) {
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

/**
 * Get widget locations from a given view
 */
export function getWidgets(view: EditorView) {
  let widgets: ReturnType<Decoration["range"]>[] = [];
  for (let { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.name == "MappingEntry") {
          const path = stylePath(view, node.node);

          for (const spec of widgetSpecs) {
            if (spec.paths.includes(path)) {
              const value = node.node.getChild(":")!.nextSibling;
              if (value?.name === "String") {
                const deco = Decoration.widget({
                  widget: new spec.widget(
                    JSON.parse(
                      view.state.doc.sliceString(value.from, value.to)
                    ),
                    path
                  ),
                  side: -1,
                });
                widgets.push(deco.range(value.from));
              }
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
