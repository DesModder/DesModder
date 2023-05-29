import { analysisStateField } from "../../LanguageServer";
import { Folder, Program, Statement } from "../../down/TextAST";
import { EditorState, Extension } from "@codemirror/state";
import {
  BlockInfo,
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
    const num = statementIndexContainingLine(analysis.ast, line) ?? "";
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
  return maxLineNumber([...statements(analysis.ast)].length).toString();
}

// WARNING: quadratic algorithm since this gets called on each line.
function statementIndexContainingLine(p: Program, b: BlockInfo) {
  let i = 0;
  for (const stmt of statements(p)) {
    i++;
    if (!stmt.pos) continue;
    if (b.from < stmt.pos.to) {
      if (b.to < stmt.pos.from) return undefined;
      if (b.from <= stmt.pos.from) return i;
      if (stmt.type !== "Folder") return undefined;
    }
  }
}

function* statements(p: Program | Folder): Iterable<Statement> {
  for (const stmt of p.children) {
    yield stmt;
    if (stmt.type === "Folder") {
      yield* statements(stmt);
    }
  }
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
