import { analysisStateField } from "../../LanguageServer";
import { statementsIntersecting } from "../statementIntersection";
import StyleCircle from "./StyleCircle";
import { RangeSet, Extension } from "@codemirror/state";
import { GutterMarker, gutter, gutters } from "@codemirror/view";
import { DCGView } from "DCGView";
import { ItemModel } from "globals/models";
import { Calc } from "globals/window";

export function styleCircles(): Extension {
  return [gutters(), styleCircleGutter];
}

const styleCircleGutter = gutter({
  renderEmptyElements: false,
  markers(view) {
    const program = view.state.field(analysisStateField).program;
    const { from, to } = view.viewport;
    const ranges = [];
    let last = -1;
    for (const stmt of statementsIntersecting(program, from, to)) {
      const model = Calc.controller.getItemModel(stmt.id);
      if (model?.type === "expression" || model?.type === "image") {
        const pos = view.lineBlockAt(stmt.pos.from).from;
        if (pos > last) {
          last = pos;
          ranges.push(new StyleCircleMarker(stmt.id, model).range(pos));
        }
      }
    }
    return RangeSet.of(ranges);
    // if (others.some((m) => m.toDOM)) return null;
    // const analysis = view.state.field(analysisStateField);
    // const id = statementContainingLine(analysis, line)?.id;
    // return id ? new StyleCircleMarker(id) : null;
  },
  // TODO intelligence
  lineMarkerChange: () => true,
});

class StyleCircleMarker extends GutterMarker {
  constructor(readonly id: string, readonly model: ItemModel) {
    super();
  }

  eq(_other: StyleCircleMarker) {
    return false;
  }

  toDOM() {
    const div = document.createElement("div");
    DCGView.mountToNode(StyleCircle, div, {
      id: DCGView.const(this.id),
      model: DCGView.const(this.model),
    });
    return div;
  }
}
