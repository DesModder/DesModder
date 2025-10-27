import { analysisStateField, tmPlugin } from "../../LanguageServer";
import { statementsIntersecting } from "../statementIntersection";
import "./footerWidget.less";
import { EditorState, RangeSet } from "@codemirror/state";
import { EditorView, Decoration, WidgetType } from "@codemirror/view";
import { DCGView } from "#DCGView";
import { ExpressionFooterView } from "#components";
import { ExpressionModel } from "#globals";

function getFooters(state: EditorState) {
  const { program } = state.field(analysisStateField);
  const decorations = [];
  const { from, to } = program.pos;
  const tm = state.facet(tmPlugin);
  for (const stmt of statementsIntersecting(program, from, to)) {
    const model = tm.cc.getItemModel(stmt.id);
    if (stmt.type === "ExprStatement" && model?.type === "expression") {
      const widget = Decoration.widget({
        widget: new FooterWidget(model),
        side: 1,
        block: true,
      });
      decorations.push(widget.range(state.doc.lineAt(stmt.pos.to).to));
    }
  }
  return RangeSet.of(decorations);
}

export function footerPlugin() {
  return [
    EditorView.decorations.compute([analysisStateField], getFooters),
    EditorView.updateListener.of((view) => {
      let width = 0;
      view.state.facet(EditorView.scrollMargins).forEach((x) => {
        const rect = x(view.view);
        width += (rect?.left ?? 0) + (rect?.right ?? 0);
      });
      const container = document.querySelector(".dsm-text-editor-container");
      if (!container) return;
      (container as HTMLElement).style.setProperty(
        "--dsm-tm-gutter-width",
        width.toFixed(1) + "px"
      );
    }),
  ];
}

// Compare to StyleCircleMarker. Similar mount/div handling
// If a third similar thing appears, consider some shared logic
class FooterWidget extends WidgetType {
  unsub: (() => void) | undefined;
  div: HTMLElement | undefined;

  constructor(readonly model: ExpressionModel) {
    super();
  }

  eq(other: FooterWidget) {
    // TODO-incremental: We need to be stricter than this. This should really
    // be like GUID or full object equality this.model === other.model.
    // But the GUID gets updated every setState(), and the model objects
    // are fairly complicated.
    const a = this.model;
    const b = other.model;
    // Comparing a === getItemModel(a.id) overwrites the widget too often.
    // This is probably not good since it relies on the order of Codemirror
    // running the eq() call, but it seems to be a=old, b=new.
    return a.id === b.id && b === a.controller.getItemModel(b.id);
  }

  toDOM() {
    this.div = document.createElement("div");
    this.div.classList.add("dsm-tm-footer-wrapper");
    const view = DCGView.mountToNode(ExpressionFooterView, this.div, {
      model: DCGView.const(this.model),
      controller: DCGView.const(this.model.controller),
      isFirstRender: () => false,
    });
    this.unsub = this.model.controller.subscribeToChanges(() => view.update());
    return this.div;
  }

  destroy() {
    this.unsub?.();
    if (this.div) DCGView.unmountFromNode(this.div);
  }
}
