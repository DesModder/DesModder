import { MathQuillField } from "components";
import { ExpressionAug } from "plugins/text-mode/aug/AugState";

export function mapAugAST(
  node: ExpressionAug["latex"],
  callback: (node: ExpressionAug["latex"]) => void
) {
  function map(x: any) {
    if (Array.isArray(x)) {
      for (const child of x) {
        map(child);
      }
    }

    if (typeof x === "object") {
      if (typeof x.type === "string") callback(x);

      for (const [_, v] of Object.entries(x)) {
        map(v);
      }
    }
  }

  map(node);
}

export function getController(mq: MathQuillField) {
  return mq.__controller as MQController;
}

export function mqKeystroke(mq: MathQuillField, keystroke: string) {
  mq.keystroke(keystroke);
}

export interface MQController {
  cursor: MQCursor;
}

export interface MQCursor {
  parent?: MQCursor;
  latex?: () => string;
  [-1]: MQCursor | undefined;
  [1]: MQCursor | undefined;
  cursorElement?: HTMLElement;
  ctrlSeq?: string;
  _el?: HTMLElement;
}

export const identRegex = /([a-zA-Z]|\\[a-zA-Z]+) *(_\{[a-zA-Z0-9 ]*\})?/g;

export function isIdentStr(str: string) {
  const match = str.match(identRegex);
  if (!match) return false;
  return match[0].length === str.length;
}

export interface TryFindMQIdentResult {
  goToEndOfIdent: () => void;
  deleteIdent: () => void;
  ident: string;
  type: string;
}

// is an MQ node a subscript?
function isSubscript(cursor: MQCursor) {
  const ltx = cursor.latex?.();
  return ltx?.[0] === "_" && ltx[1] === "{" && ltx[ltx.length - 1] === "}";
}

// is an MQ node an operator name?
function isOperatorName(cursor: MQCursor) {
  return cursor._el?.classList.contains("dcg-mq-operator-name") ?? false;
}

// is an MQ node the start of an operator name?
function isStartingOperatorName(cursor: MQCursor) {
  return isOperatorName(cursor) && cursor.latex?.()?.[0] === "\\";
}

// is an MQ node a variable name
function isVarName(cursor: MQCursor) {
  return cursor._el?.tagName.toUpperCase() === "VAR" && !isOperatorName(cursor);
}

function isIdentifierSegment(cursor?: MQCursor): cursor is MQCursor {
  return (
    (cursor ?? false) &&
    (isSubscript(cursor as MQCursor) ||
      isOperatorName(cursor as MQCursor) ||
      isStartingOperatorName(cursor as MQCursor) ||
      isVarName(cursor as MQCursor))
  );
}

// identifiers are composed of the following structure:
// (operatorname* | varname) subscript?

function tryGetMathquillIdent(
  mq: MathQuillField
): TryFindMQIdentResult | undefined {
  const ctrlr = getController(mq);

  const latexSegments: (string | undefined)[] = [];

  let node = ctrlr.cursor[-1];

  const isInSubscript =
    ctrlr.cursor?.parent?._el?.classList.contains("dcg-mq-sub");

  let goToEnd = 0;

  if (isInSubscript) {
    node = ctrlr.cursor;
    goToEnd++;
    while (node?.[1]) {
      goToEnd++;
      node = node?.[1];
    }
    node = node?.parent?.parent;
  }

  while (node && !isStartingOperatorName(node) && !isVarName(node)) {
    if (!isIdentifierSegment(node)) return;
    node = node[-1];
    goToEnd--;
  }
  if (!node) return;

  let backspaces = 0;

  // get starting variable name
  if (isVarName(node)) {
    latexSegments.push(node.latex?.());
    node = node[1];
    goToEnd++;
    backspaces++;

    // try to get sequence of operatorname characters.
  } else if (isStartingOperatorName(node)) {
    while (node && isOperatorName(node)) {
      latexSegments.push(node.latex?.());
      node = node[1];
      goToEnd++;
      backspaces++;
    }
  }

  // get optional subscript
  if (node && isSubscript(node)) {
    latexSegments.push(node.latex?.());

    backspaces += (node.latex?.()?.length ?? 4) - 3;

    goToEnd++;
  }

  const identString = latexSegments.filter((e) => e).join("");

  if (identString.match(identRegex)) {
    return {
      ident: identString,
      type: "",
      goToEndOfIdent: () => {
        for (let i = 0; i < goToEnd; i++) {
          mq.keystroke("Right");
        }
      },
      deleteIdent: () => {
        for (let i = 0; i < backspaces; i++) {
          mq.keystroke("Backspace");
        }
      },
    };
  }
}

function tryGetMathquilIdentFromWithinSubscript(
  mq: MathQuillField
): TryFindMQIdentResult | undefined {
  const ctrlr = getController(mq);

  const varName = ctrlr.cursor.parent?.parent?.[-1]?.latex?.();
  const subscript = ctrlr.cursor.parent?.parent?.latex?.();
  if (varName && subscript) {
    const candidate = varName + subscript;
    if (isIdentStr(candidate)) {
      return {
        goToEndOfIdent: () => {
          while (ctrlr.cursor[1]) {
            mqKeystroke(mq, "Right");
          }
          mqKeystroke(mq, "Right");
        },
        deleteIdent: () => {
          for (let i = 0; i < Math.max(candidate.length - 3, 2); i++) {
            mqKeystroke(mq, "Backspace");
          }
        },
        ident: candidate,
        type: "within-subscript",
      };
    }
  }
}

function tryGetMathquillIdentFromAfterSubscript(
  mq: MathQuillField
): TryFindMQIdentResult | undefined {
  const ctrlr = getController(mq);

  const varName = ctrlr.cursor?.[-1]?.[-1]?.latex?.();
  const subscript = ctrlr.cursor?.[-1]?.latex?.();
  if (varName && subscript) {
    const candidate = varName + subscript;
    if (isIdentStr(candidate)) {
      return {
        goToEndOfIdent: () => {},
        ident: candidate,
        deleteIdent: () => {
          for (let i = 0; i < Math.max(candidate.length - 3, 2); i++) {
            mqKeystroke(mq, "Backspace");
          }
        },
        type: "after-subscript",
      };
    }
  }
}

function tryGetMathquillIdentFromBeforeSubscript(
  mq: MathQuillField
): TryFindMQIdentResult | undefined {
  const ctrlr = getController(mq);

  const varName = ctrlr.cursor?.[-1]?.latex?.();
  const subscript = ctrlr.cursor?.[1]?.latex?.();
  if (varName && subscript) {
    const candidate = varName + subscript;
    if (isIdentStr(candidate)) {
      return {
        goToEndOfIdent: () => {
          mqKeystroke(mq, "Right");
        },
        ident: candidate,
        deleteIdent: () => {
          for (let i = 0; i < Math.max(candidate.length - 3, 2); i++) {
            mqKeystroke(mq, "Backspace");
          }
        },
        type: "before-subscript",
      };
    }
  }
}

function tryGetMathquillIdentFromVariableOnly(
  mq: MathQuillField
): TryFindMQIdentResult | undefined {
  const ctrlr = getController(mq);

  const varName = ctrlr.cursor?.[-1]?.latex?.();
  const potentiallyADot = ctrlr.cursor?.[-1]?.[-1]?.latex?.();

  // don't open intellisense for point member access
  if ((varName === "x" || varName === "y") && potentiallyADot === ".") return;

  if (varName) {
    if (isIdentStr(varName)) {
      return {
        goToEndOfIdent: () => {},
        ident: varName,
        deleteIdent: () => {
          mqKeystroke(mq, "Backspace");
        },
        type: "variable-only",
      };
    }
  }
}

export function getMathquillIdentifierAtCursorPosition(
  mq: MathQuillField
): TryFindMQIdentResult | undefined {
  // try to get an identifier from a mathquill input
  // at the cursor position in various different ways
  // pick the first one that succeeds
  // return (
  //   tryGetMathquilIdentFromWithinSubscript(mq) ??
  //   tryGetMathquillIdentFromAfterSubscript(mq) ??
  //   tryGetMathquillIdentFromBeforeSubscript(mq) ??
  //   tryGetMathquillIdentFromVariableOnly(mq)
  // );

  return tryGetMathquillIdent(mq);
}

export interface PartialFunctionCall {
  ident: string;
  paramIndex: number;
}

export function getPartialFunctionCall(
  mq: MathQuillField
): PartialFunctionCall | undefined {
  let cursor: MQCursor | undefined = getController(mq).cursor;
  let paramIndex = 0;
  while (cursor) {
    const ltx = cursor?.latex?.();
    if (ltx === ",") paramIndex++;
    if (cursor[-1]) {
      cursor = cursor[-1];
    } else {
      const oldCursor = cursor;
      cursor = cursor.parent?.parent?.[-1];
      const ltx = cursor?.latex?.();
      const ltx2 = cursor?.[-1]?.latex?.();
      if (ltx && isIdentStr(ltx) && cursor?.[1]?.ctrlSeq === "\\left(") {
        return { ident: ltx, paramIndex };
      } else if (ltx2 && ltx && isIdentStr(ltx2 + ltx)) {
        return { ident: ltx2 + ltx, paramIndex };
      }
      paramIndex = 0;
      cursor = oldCursor.parent;
    }
  }
}
