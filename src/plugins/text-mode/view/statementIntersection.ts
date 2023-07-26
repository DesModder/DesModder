import { ProgramAnalysis } from "../../../../text-mode-core";
import {
  Positioned,
  Program,
  Statement,
} from "../../../../text-mode-core/TextAST";
import { BlockInfo } from "@codemirror/view";

export function statementContainingLine(
  analysis: ProgramAnalysis,
  b: BlockInfo
) {
  const stmts = statementsIntersecting(analysis.program, b.from, b.to);
  for (const stmt of stmts) {
    if (b.from <= stmt.pos.from) return stmt;
  }
}

export function statementsIntersecting(
  p: Program,
  from: number,
  to: number = from
) {
  function* _statementsIntersecting(s: Statement[]): Iterable<Statement> {
    const fromIndex = binarySearchFirstAfter(s, from);
    const toIndex = binarySearchLastBefore(s, to);
    if (fromIndex === undefined || toIndex === undefined) return [];
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
  if (hi < lo) return undefined;
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
  if (hi < lo) return undefined;
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
