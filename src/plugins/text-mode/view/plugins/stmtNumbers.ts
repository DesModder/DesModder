import { analysisStateField } from "../../LanguageServer";
import { Folder, Program, Table } from "../../down/TextAST";
import { statementIndexContainingLine } from "../statementIntersection";
import { EditorState, Extension } from "@codemirror/state";
import {
  EditorView,
  GutterMarker,
  ViewUpdate,
  gutter,
  gutters,
  lineNumberMarkers,
} from "@codemirror/view";

export function stmtNumbers(): Extension {
  return [gutters(), stmtNumberGutter];
}

const stmtNumberGutter = gutter({
  class: "cm-lineNumbers",
  renderEmptyElements: false,
  markers(view: EditorView) {
    return view.state.facet(lineNumberMarkers);
  },
  lineMarker(view, line, others) {
    if (others.some((m) => m.toDOM)) return null;
    const analysis = view.state.field(analysisStateField);
    const num = statementIndexContainingLine(analysis, line) ?? "";
    return new NumberMarker(num.toString());
  },
  widgetMarker: () => null,
  initialSpacer(view: EditorView) {
    return new NumberMarker(maxNumber(view.state));
  },
  updateSpacer(spacer: GutterMarker, update: ViewUpdate) {
    const max = maxNumber(update.view.state);
    return max === (spacer as NumberMarker).number
      ? spacer
      : new NumberMarker(max);
  },
});

function maxNumber(state: EditorState) {
  const analysis = state.field(analysisStateField);
  function _maxNumber(stmt: Folder | Table | Program): number {
    const children = stmt.type === "Table" ? stmt.columns : stmt.children;
    const last = children[children.length - 1];
    if (!last) return stmt.type === "Program" ? 1 : stmt.index;
    if (last.type === "Folder" || last.type === "Table")
      return _maxNumber(last);
    else return last.index;
  }
  return maxLineNumber(_maxNumber(analysis.program)).toString();
}

class NumberMarker extends GutterMarker {
  constructor(readonly number: string) {
    super();
  }

  eq(other: NumberMarker) {
    return this.number === other.number;
  }

  toDOM() {
    return document.createTextNode(this.number);
  }
}

function maxLineNumber(lines: number) {
  let last = 9;
  while (last < lines) last = last * 10 + 9;
  return last;
}
