import { ProgramAnalysis, analysisStateField } from "../../LanguageServer";
import {
  Folder,
  Positioned,
  Program,
  Statement,
  Table,
} from "../../down/TextAST";
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

function statementIndexContainingLine(analysis: ProgramAnalysis, b: BlockInfo) {
  const stmts = statementsIntersecting(analysis.program, b.from, b.to);
  for (const stmt of stmts) {
    if (b.from < stmt.pos.to) {
      if (b.to < stmt.pos.from) return undefined;
      if (b.from <= stmt.pos.from) return stmt.index;
      if (stmt.type !== "Folder") return undefined;
    }
  }
}

function statementsIntersecting(p: Program, from: number, to: number = from) {
  function* _statementsIntersecting(s: Statement[]): Iterable<Statement> {
    const fromIndex = binarySearchLastBefore(s, from) ?? 0;
    const toIndex = binarySearchFirstAfter(s, to) ?? s.length - 1;
    if (fromIndex === undefined) return [];
    for (let i = fromIndex; i <= toIndex; i++) {
      const stmt = s[i];
      yield stmt;
      if (stmt.type === "Folder") yield* _statementsIntersecting(stmt.children);
      if (stmt.type === "Table") yield* _statementsIntersecting(stmt.columns);
    }
  }
  return _statementsIntersecting(p.children);
}

/** Return index of last element starting at or before pos, or undefined if pos
 * is before the start of the first element.
 * Assumes every element has a position, and s[i].to <= s[j].from if i < j */
function binarySearchLastBefore(s: Positioned[], pos: number) {
  let lo = 0;
  let hi = s.length - 1;
  if (pos < s[lo].pos.from) return undefined;
  if (s[hi].pos.from <= pos) return hi;
  // invariant: s[lo].from <= pos, and pos < s[hi].from
  while (true) {
    const m = (hi + lo) >> 1;
    if (m === lo) return lo;
    if (pos < s[m].pos.from) hi = m;
    else lo = m;
  }
}

/** Return index of first element ending at or after pos, or undefined if pos
 * is after the end of the last element.
 * Assumes every element has a position, and s[i].to <= s[j].from if i < j */
function binarySearchFirstAfter(s: Positioned[], pos: number) {
  let lo = 0;
  let hi = s.length - 1;
  if (pos <= s[lo].pos.to) return lo;
  if (s[hi].pos.to < pos) return undefined;
  // invariant: s[lo].to < pos, and pos <= s[hi].to
  while (true) {
    const m = (hi + lo) >> 1;
    if (m === lo) return hi;
    if (s[m].pos.to < pos) lo = m;
    else hi = m;
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
