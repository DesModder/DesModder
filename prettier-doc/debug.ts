import { DT } from "./doc-types";
import { isArray, isType } from "./utils";
import type { Doc } from "./doc";

function flattenDoc(doc: Doc): Doc {
  if (isArray(doc)) {
    const res = [];
    for (const part of doc) {
      if (isArray(part)) {
        res.push(...(flattenDoc(part) as Doc[]));
      } else {
        const flattened = flattenDoc(part);
        if (flattened !== "") {
          res.push(flattened);
        }
      }
    }

    return res;
  }

  if (typeof doc === "string") return doc;

  if (doc.type === DT.IfBreak) {
    return {
      ...doc,
      breakContents: flattenDoc(doc.breakContents),
      flatContents: flattenDoc(doc.flatContents),
    };
  }

  if (doc.type === DT.Group) {
    return {
      ...doc,
      contents: flattenDoc(doc.contents),
      expandedStates: doc.expandedStates?.map(flattenDoc),
    };
  }

  if (doc.type === DT.Fill) {
    return { type: DT.Fill, parts: doc.parts.map(flattenDoc) };
  }

  if ("contents" in doc && doc.contents) {
    return { ...doc, contents: flattenDoc(doc.contents) };
  }

  return doc;
}

export function printDocToDebug(doc: Doc) {
  const printedSymbols: Record<symbol, string> = Object.create(null);
  const usedKeysForSymbols = new Set<string>();
  return printDoc(flattenDoc(doc));

  function printDoc(doc: Doc, index: number = 0, parentParts?: Doc[]): string {
    if (typeof doc === "string") {
      return JSON.stringify(doc);
    }

    if (isArray(doc)) {
      const printed = doc.map(printDoc).filter(Boolean);
      return printed.length === 1 ? printed[0] : `[${printed.join(", ")}]`;
    }

    if (doc.type === DT.Line) {
      const withBreakParent =
        Array.isArray(parentParts) &&
        isType(parentParts[index + 1], DT.BreakParent);
      if (doc.literal) {
        return withBreakParent
          ? "literalline"
          : "literallineWithoutBreakParent";
      }
      if (doc.hard) {
        return withBreakParent ? "hardline" : "hardlineWithoutBreakParent";
      }
      if (doc.soft) {
        return "softline";
      }
      return DT.Line;
    }

    if (doc.type === DT.BreakParent) {
      let prev;
      const afterHardline =
        Array.isArray(parentParts) &&
        isType((prev = parentParts[index - 1]), DT.Line) &&
        prev.hard;
      return afterHardline ? "undefined" : "breakParent";
    }

    if (doc.type === DT.Trim) {
      return DT.Trim;
    }

    if (doc.type === DT.Indent) {
      return "indent(" + printDoc(doc.contents) + ")";
    }

    if (doc.type === DT.Align) {
      return doc.n === Number.NEGATIVE_INFINITY
        ? "dedentToRoot(" + printDoc(doc.contents) + ")"
        : typeof doc.n === "number" && doc.n < 0
          ? "dedent(" + printDoc(doc.contents) + ")"
          : typeof doc.n !== "string" &&
              typeof doc.n !== "number" &&
              doc.n.type === "root"
            ? "markAsRoot(" + printDoc(doc.contents) + ")"
            : "align(" +
              JSON.stringify(doc.n) +
              ", " +
              printDoc(doc.contents) +
              ")";
    }

    if (doc.type === DT.IfBreak) {
      return (
        "ifBreak(" +
        printDoc(doc.breakContents) +
        (doc.flatContents ? ", " + printDoc(doc.flatContents) : "") +
        (doc.groupId
          ? (!doc.flatContents ? ', ""' : "") +
            `, { groupId: ${printGroupId(doc.groupId)} }`
          : "") +
        ")"
      );
    }

    if (doc.type === DT.IndentIfBreak) {
      const optionsParts = [];

      if (doc.negate) {
        optionsParts.push("negate: true");
      }

      if (doc.groupId) {
        optionsParts.push(`groupId: ${printGroupId(doc.groupId)}`);
      }

      const options =
        optionsParts.length > 0 ? `, { ${optionsParts.join(", ")} }` : "";

      return `indentIfBreak(${printDoc(doc.contents)}${options})`;
    }

    if (doc.type === DT.Group) {
      const optionsParts = [];

      if (doc.break && doc.break !== "propagated") {
        optionsParts.push("shouldBreak: true");
      }

      if (doc.id) {
        optionsParts.push(`id: ${printGroupId(doc.id)}`);
      }

      const options =
        optionsParts.length > 0 ? `, { ${optionsParts.join(", ")} }` : "";

      if (doc.expandedStates) {
        return `conditionalGroup([${doc.expandedStates
          .map((part) => printDoc(part))
          .join(",")}]${options})`;
      }

      return `group(${printDoc(doc.contents)}${options})`;
    }

    if (doc.type === DT.Fill) {
      return `fill([${doc.parts.map((part) => printDoc(part)).join(", ")}])`;
    }

    if (doc.type === DT.LineSuffix) {
      return "lineSuffix(" + printDoc(doc.contents) + ")";
    }

    if (doc.type === DT.LineSuffixBoundary) {
      return "lineSuffixBoundary";
    }

    if (doc.type === DT.Label) {
      return `label(${JSON.stringify(doc.label)}, ${printDoc(doc.contents)})`;
    }

    throw new Error("Unknown doc type " + doc.type);
  }

  function printGroupId(id: string | symbol): string {
    if (typeof id !== "symbol") {
      return JSON.stringify(String(id));
    }

    if (id in printedSymbols) {
      return printedSymbols[id];
    }

    const prefix = id.description ?? "symbol";
    for (let counter = 0; ; counter++) {
      const key = prefix + (counter > 0 ? ` #${counter}` : "");
      if (!usedKeysForSymbols.has(key)) {
        usedKeysForSymbols.add(key);
        return (printedSymbols[id] = `Symbol.for(${JSON.stringify(key)})`);
      }
    }
  }
}
