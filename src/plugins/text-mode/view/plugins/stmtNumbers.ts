import { Folder, Program, Table } from "../../../../../text-mode-core/TextAST";
import { analysisStateField } from "../../LanguageServer";
import { debugModeStateField } from "../editor";
import { statementsIntersecting } from "../statementIntersection";
import { EditorState, Extension, RangeSet } from "@codemirror/state";
import {
  EditorView,
  GutterMarker,
  ViewUpdate,
  gutter,
  gutters,
} from "@codemirror/view";

export function stmtNumbers(): Extension {
  return [gutters(), stmtNumberGutter];
}

const stmtNumberGutter = gutter({
  class: "cm-lineNumbers",
  renderEmptyElements: false,
  markers(view: EditorView) {
    const program = view.state.field(analysisStateField).program;
    const { from, to } = view.viewport;
    const ranges = [];
    let last = -1;
    const debugMode = view.state.field(debugModeStateField);
    for (const stmt of statementsIntersecting(program, from, to)) {
      const pos = view.lineBlockAt(stmt.pos.from).from;
      if (pos > last) {
        last = pos;
        const label = debugMode ? stmt.id : stmt.index.toString();
        ranges.push(new NumberMarker(label).range(pos));
      }
    }
    return RangeSet.of(ranges);
  },
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
  if (state.field(debugModeStateField)) {
    const numDigits = Object.keys(analysis.mapIDstmt).reduce(
      (a, b) => Math.max(a, b.length),
      1
    );
    return "9".repeat(numDigits);
  }
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
