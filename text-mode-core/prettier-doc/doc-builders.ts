import type { Align, Concat, Cursor, Doc } from "./doc";

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

/** @deprecated use `Doc[]` instead */
export function concat(parts: Doc[]): Concat {
  if (process.env.NODE_ENV !== "production") {
    for (const part of parts) {
      assertDoc(part);
    }
  }

  // We cannot do this until we change `printJSXElement` to not
  // access the internals of a document directly.
  // if(parts.length === 1) {
  //   // If it's a single document, no need to concat it.
  //   return parts[0];
  // }
  return { type: "concat", parts };
}

export function indent(contents: Doc): Doc {
  if (process.env.NODE_ENV !== "production") {
    assertDoc(contents);
  }

  return { type: "indent", contents };
}

export function align(widthOrString: Align["n"], contents: Doc): Doc {
  if (process.env.NODE_ENV !== "production") {
    assertDoc(contents);
  }

  return { type: "align", contents, n: widthOrString };
}

export function group(contents: Doc, opts: GroupOptions = {}): Doc {
  if (process.env.NODE_ENV !== "production") {
    assertDoc(contents);
  }

  return {
    type: "group",
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

  return { type: "fill", parts };
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
    type: "if-break",
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
    type: "indent-if-break",
    contents,
    groupId: opts.groupId,
    negate: opts.negate,
  };
}

export function lineSuffix(contents: Doc) {
  if (process.env.NODE_ENV !== "production") {
    assertDoc(contents);
  }
  return { type: "line-suffix", contents };
}

export const lineSuffixBoundary: Doc = { type: "line-suffix-boundary" };
export const breakParent: Doc = { type: "break-parent" };
export const trim: Doc = { type: "trim" };

export const hardlineWithoutBreakParent: Doc = { type: "line", hard: true };
export const literallineWithoutBreakParent: Doc = {
  type: "line",
  hard: true,
  literal: true,
};

export const line: Doc = { type: "line" };
export const softline: Doc = { type: "line", soft: true };
export const hardline: Doc = concat([hardlineWithoutBreakParent, breakParent]);
export const literalline: Doc = concat([
  literallineWithoutBreakParent,
  breakParent,
]);

export const cursor: Cursor = { type: "cursor", placeholder: Symbol("cursor") };

export function join(sep: Doc, arr: Doc[]): Concat {
  const res = [];

  for (let i = 0; i < arr.length; i++) {
    if (i !== 0) {
      res.push(sep);
    }

    res.push(arr[i]);
  }

  return concat(res);
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

export function label(label: string, contents: Doc): Doc {
  return { type: "label", label, contents };
}
