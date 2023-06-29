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
  return (
    tryGetMathquilIdentFromWithinSubscript(mq) ??
    tryGetMathquillIdentFromAfterSubscript(mq) ??
    tryGetMathquillIdentFromBeforeSubscript(mq) ??
    tryGetMathquillIdentFromVariableOnly(mq)
  );
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
