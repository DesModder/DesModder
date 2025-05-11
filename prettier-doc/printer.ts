import { DT } from "./doc-types";
import _stringWidth from "string-width";
import { fill, indent, hardline } from "./builders";
import { isArray, propagateBreaks } from "./utils";
import type { Align, Doc } from "./doc";

const notAsciiRegex = /[^\x20-\x7F]/;
function stringWidth(text: string) {
  if (!text) {
    return 0;
  }

  // shortcut to avoid needless string `RegExp`s, replacements, and allocations within `string-width`
  if (!notAsciiRegex.test(text)) {
    return text.length;
  }

  return _stringWidth(text);
}

interface Options {
  /**
   * Specify the line length that the printer will wrap on.
   * @default 80
   */
  printWidth: number;
  /**
   * Specify the number of spaces per indentation-level.
   * @default 2
   */
  tabWidth: number;
  /**
   * Indent lines with tabs instead of spaces
   * @default false
   */
  useTabs: boolean;
  parentParser?: string | undefined;
  __embeddedInHtml?: boolean | undefined;
}

type Mode = typeof MODE_BREAK | typeof MODE_FLAT;
type IndentPart =
  | { type: "indent" | "dedent" }
  | { type: "stringAlign"; n: string }
  | { type: "numberAlign"; n: number };
interface Indent {
  value: string;
  length: number;
  queue: IndentPart[];
  root?: Indent;
}
interface Command {
  ind: Indent;
  doc: Doc;
  mode: Mode;
}

type GroupModeMap = Record<symbol, Mode>;

const MODE_BREAK = Symbol("MODE_BREAK");
const MODE_FLAT = Symbol("MODE_FLAT");
const CURSOR_PLACEHOLDER = Symbol("cursor");

function rootIndent(): Indent {
  return { value: "", length: 0, queue: [] };
}

function makeIndent(ind: Indent, options: Options) {
  return generateInd(ind, { type: "indent" }, options);
}

function makeAlign(
  indent: Indent,
  widthOrDoc: Align["n"],
  options: Options
): Indent {
  if (widthOrDoc === Number.NEGATIVE_INFINITY) {
    return indent.root ?? rootIndent();
  }

  if (typeof widthOrDoc === "number" && widthOrDoc < 0) {
    return generateInd(indent, { type: "dedent" }, options);
  }

  if (!widthOrDoc) {
    return indent;
  }

  if (typeof widthOrDoc === "number") {
    return generateInd(indent, { type: "numberAlign", n: widthOrDoc }, options);
  }

  if (typeof widthOrDoc === "string") {
    return generateInd(indent, { type: "stringAlign", n: widthOrDoc }, options);
  }

  widthOrDoc satisfies { type: "root" };

  return { ...indent, root: indent };
}

function generateInd(ind: Indent, newPart: IndentPart, options: Options) {
  const queue =
    newPart.type === "dedent"
      ? ind.queue.slice(0, -1)
      : [...ind.queue, newPart];

  let value = "";
  let length = 0;
  let lastTabs = 0;
  let lastSpaces = 0;

  for (const part of queue) {
    switch (part.type) {
      case DT.Indent:
        flush();
        if (options.useTabs) {
          addTabs(1);
        } else {
          addSpaces(options.tabWidth);
        }
        break;
      case "stringAlign":
        flush();
        value += part.n;
        length += part.n.length;
        break;
      case "numberAlign":
        lastTabs += 1;
        lastSpaces += part.n;
        break;
      /* istanbul ignore next */
      default:
        throw new Error(`Unexpected type '${part.type}'`);
    }
  }

  flushSpaces();

  return { ...ind, value, length, queue };

  function addTabs(count: number) {
    value += "\t".repeat(count);
    length += options.tabWidth * count;
  }

  function addSpaces(count: number) {
    value += " ".repeat(count);
    length += count;
  }

  function flush() {
    if (options.useTabs) {
      flushTabs();
    } else {
      flushSpaces();
    }
  }

  function flushTabs() {
    if (lastTabs > 0) {
      addTabs(lastTabs);
    }
    resetLast();
  }

  function flushSpaces() {
    if (lastSpaces > 0) {
      addSpaces(lastSpaces);
    }
    resetLast();
  }

  function resetLast() {
    lastTabs = 0;
    lastSpaces = 0;
  }
}

// Trim `Tab(U+0009)` and `Space(U+0020)` at the end of line
function trim(out: (string | typeof CURSOR_PLACEHOLDER)[]) {
  let trimCount = 0;
  let cursorCount = 0;
  let outIndex = out.length;

  // eslint-disable-next-line no-labels
  outer: while (outIndex--) {
    const last = out[outIndex];

    if (last === CURSOR_PLACEHOLDER) {
      cursorCount++;
      continue;
    }

    // Not using a regexp here because regexps for trimming off trailing
    // characters are known to have performance issues.
    for (let charIndex = last.length - 1; charIndex >= 0; charIndex--) {
      const char = last[charIndex];
      if (char === " " || char === "\t") {
        trimCount++;
      } else {
        out[outIndex] = last.slice(0, charIndex + 1);
        // eslint-disable-next-line no-labels
        break outer;
      }
    }
  }

  if (trimCount > 0 || cursorCount > 0) {
    out.length = outIndex + 1;

    while (cursorCount-- > 0) {
      out.push(CURSOR_PLACEHOLDER);
    }
  }

  return trimCount;
}

function fits(
  next: Command,
  restCommands: Command[],
  width: number,
  hasLineSuffix: boolean,
  groupModeMap: GroupModeMap,
  mustBeFlat?: boolean
): boolean {
  if (width === Number.POSITIVE_INFINITY) {
    return true;
  }

  let restIdx = restCommands.length;

  const cmds: Array<Omit<Command, "ind">> = [next];
  // `out` is only used for width counting because `trim` requires to look
  // backwards for space characters.
  const out = [];
  while (width >= 0) {
    if (cmds.length === 0) {
      if (restIdx === 0) {
        return true;
      }
      cmds.push(restCommands[--restIdx]);
      continue;
    }

    const { mode, doc } = cmds.pop()!;

    if (typeof doc === "string") {
      out.push(doc);
      width -= stringWidth(doc);
    } else if (isArray(doc) || doc.type === DT.Fill) {
      const parts = isArray(doc) ? doc : doc.parts;
      for (let i = parts.length - 1; i >= 0; i--) {
        cmds.push({ mode, doc: parts[i] });
      }
    } else {
      switch (doc.type) {
        case DT.Indent:
        case DT.Align:
        case DT.IndentIfBreak:
        case DT.Label:
          cmds.push({ mode, doc: doc.contents });
          break;

        case DT.Trim:
          width += trim(out);
          break;

        case DT.Group: {
          if (mustBeFlat && doc.break) {
            return false;
          }
          const groupMode = doc.break ? MODE_BREAK : mode;
          // The most expanded state takes up the least space on the current line.
          const contents =
            doc.expandedStates && groupMode === MODE_BREAK
              ? doc.expandedStates.at(-1)!
              : doc.contents;
          cmds.push({ mode: groupMode, doc: contents });
          break;
        }

        case DT.IfBreak: {
          const groupMode = doc.groupId
            ? groupModeMap[doc.groupId] || MODE_FLAT
            : mode;
          const contents =
            groupMode === MODE_BREAK ? doc.breakContents : doc.flatContents;
          if (contents) {
            cmds.push({ mode, doc: contents });
          }
          break;
        }

        case DT.Line:
          if (mode === MODE_BREAK || doc.hard) {
            return true;
          }
          if (!doc.soft) {
            out.push(" ");
            width--;
          }
          break;

        case DT.LineSuffix:
          hasLineSuffix = true;
          break;

        case DT.LineSuffixBoundary:
          if (hasLineSuffix) {
            return false;
          }
          break;
      }
    }
  }
  return false;
}

interface PrintedDoc {
  formatted: string;
  cursorNodeStart?: number | undefined;
  cursorNodeText?: string | undefined;
}

export function printDocToString(doc: Doc, options: Options): PrintedDoc {
  const groupModeMap: GroupModeMap = {};

  const width = options.printWidth;
  const newLine = "\n";
  let pos = 0;
  // cmds is basically a stack. We've turned a recursive call into a
  // while loop which is much faster. The while loop below adds new
  // cmds to the array instead of recursively calling `print`.
  const cmds: Command[] = [{ ind: rootIndent(), mode: MODE_BREAK, doc }];
  const out: (string | typeof CURSOR_PLACEHOLDER)[] = [];
  let shouldRemeasure = false;
  const lineSuffix: Command[] = [];
  let printedCursorCount = 0;

  propagateBreaks(doc);

  while (cmds.length > 0) {
    const { ind, mode, doc } = cmds.pop()!;

    if (typeof doc === "string") {
      const formatted = newLine !== "\n" ? doc.replace(/\n/g, newLine) : doc;
      out.push(formatted);
      // Plugins may print single string, should skip measure the width
      if (cmds.length > 0) {
        pos += stringWidth(formatted);
      }
    } else if (isArray(doc)) {
      for (let i = doc.length - 1; i >= 0; i--) {
        cmds.push({ ind, mode, doc: doc[i] });
      }
    } else {
      switch (doc.type) {
        case DT.Cursor:
          if (printedCursorCount >= 2) {
            throw new Error("There are too many 'cursor' in doc.");
          }
          out.push(CURSOR_PLACEHOLDER);
          printedCursorCount++;

          break;
        case DT.Indent:
          cmds.push({ ind: makeIndent(ind, options), mode, doc: doc.contents });

          break;
        case DT.Align:
          cmds.push({
            ind: makeAlign(ind, doc.n, options),
            mode,
            doc: doc.contents,
          });

          break;
        case DT.Trim:
          pos -= trim(out);

          break;
        case DT.Group:
          switch (mode) {
            case MODE_FLAT:
              if (!shouldRemeasure) {
                cmds.push({
                  ind,
                  mode: doc.break ? MODE_BREAK : MODE_FLAT,
                  doc: doc.contents,
                });

                break;
              }
            // fallthrough

            case MODE_BREAK: {
              shouldRemeasure = false;

              const next: Command = { ind, mode: MODE_FLAT, doc: doc.contents };
              const rem = width - pos;
              const hasLineSuffix = lineSuffix.length > 0;

              if (
                !doc.break &&
                fits(next, cmds, rem, hasLineSuffix, groupModeMap)
              ) {
                cmds.push(next);
              } else {
                // Expanded states are a rare case where a document
                // can manually provide multiple representations of
                // itself. It provides an array of documents
                // going from the least expanded (most flattened)
                // representation first to the most expanded. If a
                // group has these, we need to manually go through
                // these states and find the first one that fits.
                if (doc.expandedStates) {
                  const mostExpanded = doc.expandedStates.at(-1)!;

                  if (doc.break) {
                    cmds.push({ ind, mode: MODE_BREAK, doc: mostExpanded });

                    break;
                  } else {
                    for (let i = 1; i < doc.expandedStates.length + 1; i++) {
                      if (i >= doc.expandedStates.length) {
                        cmds.push({ ind, mode: MODE_BREAK, doc: mostExpanded });

                        break;
                      } else {
                        const state = doc.expandedStates[i];
                        const cmd: Command = {
                          ind,
                          mode: MODE_FLAT,
                          doc: state,
                        };

                        if (fits(cmd, cmds, rem, hasLineSuffix, groupModeMap)) {
                          cmds.push(cmd);

                          break;
                        }
                      }
                    }
                  }
                } else {
                  cmds.push({ ind, mode: MODE_BREAK, doc: doc.contents });
                }
              }

              break;
            }
          }

          if (doc.id) {
            groupModeMap[doc.id] = cmds.at(-1)!.mode;
          }
          break;
        // Fills each line with as much code as possible before moving to a new
        // line with the same indentation.
        //
        // Expects doc.parts to be an array of alternating content and
        // whitespace. The whitespace contains the linebreaks.
        //
        // For example:
        //   ["I", line, "love", line, "monkeys"]
        // or
        //   [{ type: group, ... }, softline, { type: group, ... }]
        //
        // It uses this parts structure to handle three main layout cases:
        // * The first two content items fit on the same line without
        //   breaking
        //   -> output the first content item and the whitespace "flat".
        // * Only the first content item fits on the line without breaking
        //   -> output the first content item "flat" and the whitespace with
        //   "break".
        // * Neither content item fits on the line without breaking
        //   -> output the first content item and the whitespace with "break".
        case DT.Fill: {
          const rem = width - pos;

          const { parts } = doc;
          if (parts.length === 0) {
            break;
          }

          const [content, whitespace] = parts;
          const contentFlatCmd: Command = {
            ind,
            mode: MODE_FLAT,
            doc: content,
          };
          const contentBreakCmd: Command = {
            ind,
            mode: MODE_BREAK,
            doc: content,
          };
          const contentFits = fits(
            contentFlatCmd,
            [],
            rem,
            lineSuffix.length > 0,
            groupModeMap,
            true
          );

          if (parts.length === 1) {
            if (contentFits) {
              cmds.push(contentFlatCmd);
            } else {
              cmds.push(contentBreakCmd);
            }
            break;
          }

          const whitespaceFlatCmd: Command = {
            ind,
            mode: MODE_FLAT,
            doc: whitespace,
          };
          const whitespaceBreakCmd: Command = {
            ind,
            mode: MODE_BREAK,
            doc: whitespace,
          };

          if (parts.length === 2) {
            if (contentFits) {
              cmds.push(whitespaceFlatCmd, contentFlatCmd);
            } else {
              cmds.push(whitespaceBreakCmd, contentBreakCmd);
            }
            break;
          }

          // At this point we've handled the first pair (context, separator)
          // and will create a new fill doc for the rest of the content.
          // Ideally we wouldn't mutate the array here but copying all the
          // elements to a new array would make this algorithm quadratic,
          // which is unusable for large arrays (e.g. large texts in JSX).
          parts.splice(0, 2);
          const remainingCmd: Command = { ind, mode, doc: fill(parts) };

          const [secondContent] = parts;

          const firstAndSecondContentFlatCmd: Command = {
            ind,
            mode: MODE_FLAT,
            doc: [content, whitespace, secondContent],
          };
          const firstAndSecondContentFits = fits(
            firstAndSecondContentFlatCmd,
            [],
            rem,
            lineSuffix.length > 0,
            groupModeMap,
            true
          );

          if (firstAndSecondContentFits) {
            cmds.push(remainingCmd, whitespaceFlatCmd, contentFlatCmd);
          } else if (contentFits) {
            cmds.push(remainingCmd, whitespaceBreakCmd, contentFlatCmd);
          } else {
            cmds.push(remainingCmd, whitespaceBreakCmd, contentBreakCmd);
          }
          break;
        }
        case DT.IfBreak:
        case DT.IndentIfBreak: {
          const groupMode = doc.groupId ? groupModeMap[doc.groupId] : mode;
          if (groupMode === MODE_BREAK) {
            const breakContents =
              doc.type === DT.IfBreak
                ? doc.breakContents
                : doc.negate
                  ? doc.contents
                  : indent(doc.contents);
            if (breakContents) {
              cmds.push({ ind, mode, doc: breakContents });
            }
          }
          if (groupMode === MODE_FLAT) {
            const flatContents =
              doc.type === DT.IfBreak
                ? doc.flatContents
                : doc.negate
                  ? indent(doc.contents)
                  : doc.contents;
            if (flatContents) {
              cmds.push({ ind, mode, doc: flatContents });
            }
          }

          break;
        }
        case DT.LineSuffix:
          lineSuffix.push({ ind, mode, doc: doc.contents });
          break;
        case DT.LineSuffixBoundary:
          if (lineSuffix.length > 0) {
            cmds.push({ ind, mode, doc: hardline });
          }
          break;
        case DT.Line:
          switch (mode) {
            case MODE_FLAT:
              if (!doc.hard) {
                if (!doc.soft) {
                  out.push(" ");

                  pos += 1;
                }

                break;
              } else {
                // This line was forced into the output even if we
                // were in flattened mode, so we need to tell the next
                // group that no matter what, it needs to remeasure
                // because the previous measurement didn't accurately
                // capture the entire expression (this is necessary
                // for nested groups)
                shouldRemeasure = true;
              }
            // fallthrough

            case MODE_BREAK:
              if (lineSuffix.length > 0) {
                cmds.push({ ind, mode, doc }, ...lineSuffix.reverse());
                lineSuffix.length = 0;
                break;
              }

              if (doc.literal) {
                if (ind.root) {
                  out.push(newLine, ind.root.value);
                  pos = ind.root.length;
                } else {
                  out.push(newLine);
                  pos = 0;
                }
              } else {
                pos -= trim(out);
                out.push(newLine + ind.value);
                pos = ind.length;
              }
              break;
          }
          break;
        case DT.Label:
          cmds.push({ ind, mode, doc: doc.contents });
          break;
        default:
      }
    }

    // Flush remaining line-suffix contents at the end of the document, in case
    // there is no new line after the line-suffix.
    if (cmds.length === 0 && lineSuffix.length > 0) {
      cmds.push(...lineSuffix.reverse());
      lineSuffix.length = 0;
    }
  }

  const cursorPlaceholderIndex = out.indexOf(CURSOR_PLACEHOLDER);
  if (cursorPlaceholderIndex !== -1) {
    const otherCursorPlaceholderIndex = out.indexOf(
      CURSOR_PLACEHOLDER,
      cursorPlaceholderIndex + 1
    );
    const beforeCursor = out.slice(0, cursorPlaceholderIndex).join("");
    const aroundCursor = out
      .slice(cursorPlaceholderIndex + 1, otherCursorPlaceholderIndex)
      .join("");
    const afterCursor = out.slice(otherCursorPlaceholderIndex + 1).join("");

    return {
      formatted: beforeCursor + aroundCursor + afterCursor,
      cursorNodeStart: beforeCursor.length,
      cursorNodeText: aroundCursor,
    };
  }

  return { formatted: out.join("") };
}
