import { literalline, join } from "./builders";
import { Concat, Doc, DocCommand, Fill, Group } from "./doc";

export function isConcat(doc: Doc): doc is Doc[] | Concat {
  return (
    Array.isArray(doc) || (typeof doc !== "string" && doc?.type === "concat")
  );
}

export function isType<T extends DocCommand["type"]>(
  doc: Doc,
  type: T
): doc is DocCommand & { type: T } {
  return !!doc && (doc as any).type === type;
}

export function getDocParts(doc: Doc[] | Concat | Fill): Doc[] {
  if (Array.isArray(doc)) {
    return doc;
  }

  return doc.parts;
}

// Using a unique object to compare by reference.
const traverseDocOnExitStackMarker = {} as any as Doc;

function traverseDoc(
  doc: Doc,
  onEnter?: (doc: Doc) => undefined | boolean,
  onExit?: (doc: Doc) => void,
  shouldTraverseConditionalGroups?: boolean
) {
  const docsStack = [doc];

  while (docsStack.length > 0) {
    const doc = docsStack.pop()!;

    if (doc === traverseDocOnExitStackMarker) {
      onExit?.(docsStack.pop()!);
      continue;
    }

    if (onExit) {
      docsStack.push(doc, traverseDocOnExitStackMarker);
    }

    if (
      // Should Recurse
      !onEnter ||
      onEnter(doc) !== false
    ) {
      // When there are multiple parts to process,
      // the parts need to be pushed onto the stack in reverse order,
      // so that they are processed in the original order
      // when the stack is popped.
      if (isConcat(doc) || (typeof doc !== "string" && doc.type === "fill")) {
        const parts = getDocParts(doc);
        for (let ic = parts.length, i = ic - 1; i >= 0; --i) {
          docsStack.push(parts[i]);
        }
      } else if (typeof doc !== "string" && doc.type === "if-break") {
        if (doc.flatContents) {
          docsStack.push(doc.flatContents);
        }
        if (doc.breakContents) {
          docsStack.push(doc.breakContents);
        }
      } else if (
        typeof doc !== "string" &&
        doc.type === "group" &&
        doc.expandedStates
      ) {
        if (shouldTraverseConditionalGroups) {
          for (let ic = doc.expandedStates.length, i = ic - 1; i >= 0; --i) {
            docsStack.push(doc.expandedStates[i]);
          }
        } else {
          docsStack.push(doc.contents);
        }
      } else if (typeof doc !== "string" && "contents" in doc && doc.contents) {
        docsStack.push(doc.contents);
      }
    }
  }
}

function mapDoc<T = Doc>(doc: Doc, cb: (doc: Doc) => T): T {
  // Within a doc tree, the same subtrees can be found multiple times.
  // E.g., often this happens in conditional groups.
  // As an optimization (those subtrees can be huge) and to maintain the
  // reference structure of the tree, the mapping results are cached in
  // a map and reused.
  const mapped = new Map();

  return rec(doc);

  function rec(doc: Doc) {
    if (mapped.has(doc)) {
      return mapped.get(doc);
    }
    const result = process(doc);
    mapped.set(doc, result);
    return result;
  }

  function process(doc: Doc): T {
    if (Array.isArray(doc)) {
      return cb(doc.map(rec));
    }

    if (typeof doc === "string") return cb(doc);

    if (doc.type === "concat" || doc.type === "fill") {
      const parts = doc.parts.map(rec);
      return cb({ ...doc, parts });
    }

    if (doc.type === "if-break") {
      const breakContents = doc.breakContents && rec(doc.breakContents);
      const flatContents = doc.flatContents && rec(doc.flatContents);
      return cb({ ...doc, breakContents, flatContents });
    }

    if (doc.type === "group" && doc.expandedStates) {
      const expandedStates = doc.expandedStates.map(rec);
      const contents = expandedStates[0];
      return cb({ ...doc, contents, expandedStates });
    }

    if ("contents" in doc && doc.contents) {
      const contents = rec(doc.contents);
      return cb({ ...doc, contents });
    }

    return cb(doc);
  }
}

function findInDoc<T = Doc>(doc: Doc, fn: (doc: Doc) => T, defaultValue: T): T {
  let result = defaultValue;
  let hasStopped = false;
  function findInDocOnEnterFn(doc: Doc) {
    const maybeResult = fn(doc);
    if (maybeResult !== undefined) {
      hasStopped = true;
      result = maybeResult;
    }
    if (hasStopped) {
      return false;
    }
  }
  traverseDoc(doc, findInDocOnEnterFn);
  return result;
}

function willBreakFn(doc: Doc) {
  if (isType(doc, "group") && doc.break) {
    return true;
  }
  if (isType(doc, "line") && doc.hard) {
    return true;
  }
  if (isType(doc, "break-parent")) {
    return true;
  }
}

function willBreak(doc: Doc) {
  return findInDoc(doc, willBreakFn, false);
}

function breakParentGroup(groupStack: Group[]) {
  if (groupStack.length > 0) {
    const parentGroup = groupStack.at(-1)!;
    // Breaks are not propagated through conditional groups because
    // the user is expected to manually handle what breaks.
    if (!parentGroup.expandedStates && !parentGroup.break) {
      // An alternative truthy value allows to distinguish propagated group breaks
      // and not to print them as `group(..., { break: true })` in `--debug-print-doc`.
      parentGroup.break = "propagated";
    }
  }
  return null;
}

function propagateBreaks(doc: Doc) {
  const alreadyVisitedSet = new Set();
  const groupStack: Group[] = [];
  function propagateBreaksOnEnterFn(doc: Doc) {
    if (isType(doc, "break-parent")) {
      breakParentGroup(groupStack);
    }
    if (isType(doc, "group")) {
      groupStack.push(doc);
      if (alreadyVisitedSet.has(doc)) {
        return false;
      }
      alreadyVisitedSet.add(doc);
    }
  }
  function propagateBreaksOnExitFn(doc: Doc) {
    if ((doc as DocCommand).type === "group") {
      const group = groupStack.pop()!;
      if (group.break) {
        breakParentGroup(groupStack);
      }
    }
  }
  traverseDoc(
    doc,
    propagateBreaksOnEnterFn,
    propagateBreaksOnExitFn,
    /* shouldTraverseConditionalGroups */ true
  );
}

function removeLinesFn(doc: Doc) {
  doc = doc as DocCommand;
  // Force this doc into flat mode by statically converting all
  // lines into spaces (or soft lines into nothing). Hard lines
  // should still output because there's too great of a chance
  // of breaking existing assumptions otherwise.
  if (doc.type === "line" && !doc.hard) {
    return doc.soft ? "" : " ";
  }

  if (doc.type === "if-break") {
    return doc.flatContents || "";
  }

  return doc;
}

function removeLines(doc: Doc) {
  return mapDoc(doc, removeLinesFn);
}

const isHardline = (doc: Doc, nextDoc: Doc) =>
  isType(doc, "line") && doc.hard && isType(nextDoc, "break-parent");

function stripDocTrailingHardlineFromDoc(doc: Doc): Doc {
  if (!doc) {
    return doc;
  }

  if (isConcat(doc) || isType(doc, "fill")) {
    const parts = getDocParts(doc);

    while (parts.length > 1 && isHardline(parts.at(-2)!, parts.at(-1)!)) {
      parts.length -= 2;
    }

    if (parts.length > 0) {
      const lastPart = stripDocTrailingHardlineFromDoc(parts.at(-1)!);
      parts[parts.length - 1] = lastPart;
    }
    return Array.isArray(doc) ? parts : { ...doc, parts };
  }

  if (typeof doc === "string") return doc;

  switch (doc.type) {
    case "align":
    case "indent":
    case "indent-if-break":
    case "group":
    case "line-suffix":
    case "label": {
      const contents = stripDocTrailingHardlineFromDoc(doc.contents);
      return { ...doc, contents };
    }
    case "if-break": {
      const breakContents = stripDocTrailingHardlineFromDoc(doc.breakContents);
      const flatContents = stripDocTrailingHardlineFromDoc(doc.flatContents);
      return { ...doc, breakContents, flatContents };
    }
  }

  return doc;
}

function stripTrailingHardline(doc: Doc) {
  // HACK remove ending hardline, original PR: #1984
  return stripDocTrailingHardlineFromDoc(cleanDoc(doc));
}

function cleanDocFn(doc: Doc) {
  if (typeof doc === "string" || Array.isArray(doc)) return doc;

  switch (doc.type) {
    case "fill":
      if (doc.parts.every((part) => part === "")) {
        return "";
      }
      break;
    case "group":
      if (!doc.contents && !doc.id && !doc.break && !doc.expandedStates) {
        return "";
      }
      // Remove nested only group
      if (
        isType(doc.contents, "group") &&
        doc.contents.id === doc.id &&
        doc.contents.break === doc.break &&
        doc.contents.expandedStates === doc.expandedStates
      ) {
        return doc.contents;
      }
      break;
    case "align":
    case "indent":
    case "indent-if-break":
    case "line-suffix":
      if (!("contents" in doc) || !doc.contents) {
        return "";
      }
      break;
    case "if-break":
      if (!doc.flatContents && !doc.breakContents) {
        return "";
      }
      break;
  }

  if (!isConcat(doc)) {
    return doc;
  }

  const parts: Doc[] = [];
  for (const part of getDocParts(doc)) {
    if (!part) {
      continue;
    }
    const [currentPart, ...restParts] = isConcat(part)
      ? getDocParts(part)
      : [part];
    const last = parts.at(-1);
    if (typeof currentPart === "string" && typeof last === "string") {
      parts[parts.length - 1] = last + currentPart;
    } else {
      parts.push(currentPart);
    }
    parts.push(...restParts);
  }

  if (parts.length === 0) {
    return "";
  }

  if (parts.length === 1) {
    return parts[0];
  }
  return Array.isArray(doc) ? parts : { ...doc, parts };
}
// A safer version of `normalizeDoc`
// - `normalizeDoc` concat strings and flat "concat" in `fill`, while `cleanDoc` don't
// - On `concat` object, `normalizeDoc` always return object with `parts`, `cleanDoc` may return strings
// - `cleanDoc` also remove nested `group`s and empty `fill`/`align`/`indent`/`line-suffix`/`if-break` if possible
function cleanDoc(doc: Doc): Doc {
  return mapDoc(doc, (currentDoc) => cleanDocFn(currentDoc));
}

function normalizeParts(parts: Doc[]): Doc {
  const newParts: Doc[] = [];

  const restParts = parts.filter(Boolean);
  while (restParts.length > 0) {
    const part = restParts.shift();

    if (!part) {
      continue;
    }

    if (isConcat(part)) {
      restParts.unshift(...getDocParts(part));
      continue;
    }

    const last = newParts.at(-1);
    if (
      newParts.length > 0 &&
      typeof last === "string" &&
      typeof part === "string"
    ) {
      newParts[newParts.length - 1] = last + part;
      continue;
    }

    newParts.push(part);
  }

  return newParts;
}

function normalizeDoc(doc: Doc) {
  return mapDoc(doc, (currentDoc) => {
    if (Array.isArray(currentDoc)) {
      return normalizeParts(currentDoc);
    }
    if (
      typeof currentDoc === "string" ||
      !("parts" in currentDoc) ||
      !currentDoc.parts
    ) {
      return currentDoc;
    }
    return {
      ...currentDoc,
      parts: normalizeParts(currentDoc.parts),
    };
  });
}

function replaceEndOfLine(doc: Doc) {
  return mapDoc(doc, (currentDoc) =>
    typeof currentDoc === "string" && currentDoc.includes("\n")
      ? replaceTextEndOfLine(currentDoc)
      : currentDoc
  );
}

// This function need return array
// TODO: remove `.parts` when we remove `docBuilders.concat()`
function replaceTextEndOfLine(text: string, replacement = literalline) {
  return join(replacement, text.split("\n")).parts;
}

function canBreakFn(doc: Doc) {
  return isType(doc, "line");
}

function canBreak(doc: Doc) {
  return findInDoc(doc, canBreakFn, false);
}

export default {
  isConcat,
  getDocParts,
  willBreak,
  traverseDoc,
  findInDoc,
  mapDoc,
  propagateBreaks,
  removeLines,
  stripTrailingHardline,
  normalizeParts,
  normalizeDoc,
  cleanDoc,
  replaceTextEndOfLine,
  replaceEndOfLine,
  canBreak,
};
