import { DT } from "./doc-types";
import type { Align, Cursor, Doc } from "./doc";

export function assertDoc(val: unknown): asserts val is Doc {
  if (typeof val === "string") {
    return;
  }

  if (Array.isArray(val)) {
    for (const doc of val) {
      assertDoc(doc);
    }
    return;
  }

  if (val && typeof (val as any).type === "string") {
    return;
  }

  /* istanbul ignore next */
  throw new Error("Value " + JSON.stringify(val) + " is not a valid document");
}

export interface GroupOptions {
  shouldBreak?: boolean | undefined;
  id?: symbol | undefined;
  expandedStates?: Doc[];
}

export function indent(contents: Doc): Doc {
  if (process.env.NODE_ENV !== "production") {
    assertDoc(contents);
  }

  return { type: DT.Indent, contents };
}

export function align(widthOrString: Align["n"], contents: Doc): Doc {
  if (process.env.NODE_ENV !== "production") {
    assertDoc(contents);
  }

  return { type: DT.Align, contents, n: widthOrString };
}

export function group(contents: Doc, opts: GroupOptions = {}): Doc {
  if (process.env.NODE_ENV !== "production") {
    assertDoc(contents);
  }

  return {
    type: DT.Group,
    id: opts.id,
    contents,
    break: Boolean(opts.shouldBreak),
    expandedStates: opts.expandedStates,
  };
}

export function dedentToRoot(contents: Doc): Doc {
  return align(Number.NEGATIVE_INFINITY, contents);
}

export function markAsRoot(contents: Doc): Doc {
  return align({ type: "root" }, contents);
}

export function dedent(contents: Doc): Doc {
  return align(-1, contents);
}

export function conditionalGroup(states: Doc[], opts: GroupOptions): Doc {
  return group(states[0], { ...opts, expandedStates: states });
}

export function fill(parts: Doc[]): Doc {
  if (process.env.NODE_ENV !== "production") {
    for (const part of parts) {
      assertDoc(part);
    }
  }

  return { type: DT.Fill, parts };
}

export function ifBreak(
  breakContents: Doc,
  flatContents: Doc,
  opts: { groupId?: symbol | undefined } = {}
): Doc {
  if (process.env.NODE_ENV !== "production") {
    if (breakContents) {
      assertDoc(breakContents);
    }
    if (flatContents) {
      assertDoc(flatContents);
    }
  }

  return {
    type: DT.IfBreak,
    breakContents,
    flatContents,
    groupId: opts.groupId,
  };
}

export function indentIfBreak(
  contents: Doc,
  opts: { groupId: symbol; negate?: boolean }
): Doc {
  return {
    type: DT.IndentIfBreak,
    contents,
    groupId: opts.groupId,
    negate: opts.negate,
  };
}

export function lineSuffix(contents: Doc) {
  if (process.env.NODE_ENV !== "production") {
    assertDoc(contents);
  }
  return { type: DT.LineSuffix, contents };
}

export const lineSuffixBoundary: Doc = { type: DT.LineSuffixBoundary };
export const breakParent: Doc = { type: DT.BreakParent };
export const trim: Doc = { type: DT.Trim };

export const hardlineWithoutBreakParent: Doc = { type: DT.Line, hard: true };
export const literallineWithoutBreakParent: Doc = {
  type: DT.Line,
  hard: true,
  literal: true,
};

export const line: Doc = { type: DT.Line };
export const softline: Doc = { type: DT.Line, soft: true };
export const hardline: Doc = [hardlineWithoutBreakParent, breakParent];
export const literalline: Doc = [literallineWithoutBreakParent, breakParent];

export const cursor: Cursor = {
  type: DT.Cursor,
};

export function join(sep: Doc, arr: Doc[]): Doc {
  const res = [];

  for (let i = 0; i < arr.length; i++) {
    if (i !== 0) {
      res.push(sep);
    }

    res.push(arr[i]);
  }

  return res;
}

export function addAlignmentToDoc(doc: Doc, size: number, tabWidth: number) {
  let aligned = doc;
  if (size > 0) {
    // Use indent to add tabs for all the levels of tabs we need
    for (let i = 0; i < Math.floor(size / tabWidth); ++i) {
      aligned = indent(aligned);
    }
    // Use align for all the spaces that are needed
    aligned = align(size % tabWidth, aligned);
    // size is absolute from 0 and not relative to the current
    // indentation, so we use -Infinity to reset the indentation to 0
    aligned = align(Number.NEGATIVE_INFINITY, aligned);
  }
  return aligned;
}

/**
 * Mark a doc with an arbitrary truthy value. This doesn't affect how the doc is printed, but can be useful for heuristics based on doc introspection.
 * @param label If falsy, the `contents` doc is returned as is.
 */
export function label(label: string, contents: Doc): Doc {
  return label ? { type: DT.Label, label, contents } : contents;
}
