import { DT } from "./doc-types";

export type DocCommand =
  | Align
  | BreakParent
  | Cursor
  | Fill
  | Group
  | IfBreak
  | Indent
  | IndentIfBreak
  | Label
  | Line
  | LineSuffix
  | LineSuffixBoundary
  | Trim;
export type Doc = string | Doc[] | DocCommand;

export interface Align {
  type: DT.Align;
  contents: Doc;
  n: number | string | { type: "root" };
}

export interface BreakParent {
  type: DT.BreakParent;
}

export interface Cursor {
  type: DT.Cursor;
}

export interface Fill {
  type: DT.Fill;
  parts: Doc[];
}

export interface Group {
  type: DT.Group;
  id?: symbol;
  contents: Doc;
  break: boolean | "propagated";
  expandedStates?: Doc[];
}

export interface HardlineWithoutBreakParent extends Line {
  hard: true;
}

export interface IfBreak {
  type: DT.IfBreak;
  breakContents: Doc;
  flatContents: Doc;
  groupId?: symbol;
}

export interface Indent {
  type: DT.Indent;
  contents: Doc;
}

export interface IndentIfBreak {
  type: DT.IndentIfBreak;
  contents: Doc;
  groupId: symbol;
  negate?: boolean;
}

export interface Label {
  type: DT.Label;
  label: unknown;
  contents: Doc;
}

export interface Line {
  type: DT.Line;
  soft?: boolean | undefined;
  hard?: boolean | undefined;
  literal?: boolean | undefined;
}

export interface LineSuffix {
  type: DT.LineSuffix;
  contents: Doc;
}

export interface LineSuffixBoundary {
  type: DT.LineSuffixBoundary;
}

export interface LiterallineWithoutBreakParent extends Line {
  hard: true;
  literal: true;
}

export interface Softline extends Line {
  soft: true;
}

export interface Trim {
  type: DT.Trim;
}
