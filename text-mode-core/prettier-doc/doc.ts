export type DocCommand =
  | Align
  | BreakParent
  | Concat
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
  type: "align";
  contents: Doc;
  n: number | string | { type: "root" };
}

export interface BreakParent {
  type: "break-parent";
}

// TODO-prettier: update removes Concat
export interface Concat {
  type: "concat";
  parts: Doc[];
}

export interface Cursor {
  type: "cursor";
  placeholder: symbol;
}

export interface Fill {
  type: "fill";
  parts: Doc[];
}

export interface Group {
  type: "group";
  id?: symbol;
  contents: Doc;
  break: boolean | "propagated";
  expandedStates?: Doc[];
}

export interface HardlineWithoutBreakParent extends Line {
  hard: true;
}

export interface IfBreak {
  type: "if-break";
  breakContents: Doc;
  flatContents: Doc;
  groupId?: symbol;
}

export interface Indent {
  type: "indent";
  contents: Doc;
}

export interface IndentIfBreak {
  type: "indent-if-break";
  contents: Doc;
  groupId: symbol;
  negate?: boolean;
}

export interface Label {
  type: "label";
  label: unknown;
  contents: Doc;
}

export interface Line {
  type: "line";
  soft?: boolean | undefined;
  hard?: boolean | undefined;
  literal?: boolean | undefined;
}

export interface LineSuffix {
  type: "line-suffix";
  contents: Doc;
}

export interface LineSuffixBoundary {
  type: "line-suffix-boundary";
}

export interface LiterallineWithoutBreakParent extends Line {
  hard: true;
  literal: true;
}

export interface Softline extends Line {
  soft: true;
}

export interface Trim {
  type: "trim";
}
