import { ExpressionAug } from "../../../text-mode-core";
import { latexStringToIdentifierString } from "./view";
import { MathQuillField } from "#components";
import { MqNodeViaDom } from "../../mathquill/mq-node";
import { getCursorHead, MqCursorViaDom } from "../../mathquill/mq-cursor";

export function mapAugAST(
  node: ExpressionAug["latex"],
  callback: (node: ExpressionAug["latex"]) => void
) {
  function map(x: any) {
    if (Array.isArray(x)) {
      for (const child of x) {
        map(child);
      }
      return;
    }

    if (typeof x === "object") {
      if (typeof x.type === "string") {
        callback(x);

        for (const [_, v] of Object.entries(x)) {
          map(v);
        }
      }
    }
  }

  map(node);
}

export function getController(mq: MathQuillField) {
  return mq.__controller;
}

export function mqKeystroke(mq: MathQuillField, keystroke: string) {
  mq.keystroke(keystroke);
}

export function isIdentStr(str: string) {
  return latexStringToIdentifierString(str) !== undefined;
}

export interface TryFindMQIdentResult {
  goToEndOfIdent: () => void;
  deleteIdent: () => void;
  ident: string;
  type: string;
}

/** is an MQ node a subscript group? */
function isSubscriptGroup(node: MqNodeViaDom) {
  return node.domNode.classList.contains("dcg-mq-sub");
}

/** If `node` is a sup-sub, return its sub if any. */
function subscriptOfSupsub(node: MqNodeViaDom) {
  if (!node.domNode.classList.contains("dcg-mq-supsub")) return undefined;
  for (const child of node.children()) {
    if (isSubscriptGroup(child)) return child;
  }
  return undefined;
}

/** Return true if `node` is a sup-sub that has a sub. */
function isSupSubContainingSub(node: MqNodeViaDom) {
  return subscriptOfSupsub(node) !== undefined;
}

/**
 * If `node` is a SupSub containing only a subscript,
 * return the contents of the subscript.
 * Otherwise return undefined.
 */
function getSubscriptInside(node: MqNodeViaDom): string | undefined {
  const ltx = node.latex();
  if (!ltx) {
    return undefined;
  }
  if (ltx === "_{ }") {
    return "";
  }
  if (ltx.startsWith("_{") && ltx.endsWith("}")) {
    return ltx.slice(2, -1);
  }
  return undefined;
}

/** is an MQ node an operator name? */
function isOperatorName(node: MqNodeViaDom) {
  return node.domNode.classList.contains("dcg-mq-operator-name");
}

/** is an MQ node a digit? */
function isDigit(node: MqNodeViaDom) {
  return node.domNode.classList.contains("dcg-mq-digit");
}

/** is an MQ node the start of an operator name */
function isStartingOperatorName(node: MqNodeViaDom) {
  return isOperatorName(node) && node.latex().startsWith("\\");
}

/** is an MQ node a variable name */
function isVarName(node: MqNodeViaDom) {
  return node.domNode.tagName.toUpperCase() === "VAR" && !isOperatorName(node);
}

function isIdentifierSegment(node: MqNodeViaDom) {
  return isSupSubContainingSub(node) || isOperatorName(node) || isVarName(node);
}

// identifiers are composed of the following structure:
// (operatorname* | varname) subscript?

function rawTryGetMathquillIdent(
  node: MqNodeViaDom | undefined,
  cursor: MqCursorViaDom | undefined
) {
  const isInSubscript = !!cursor && isSubscriptGroup(cursor.parentGroup());

  let goToEnd = 0;

  if (isInSubscript) {
    let newNode = cursor?.nodeAfter();
    while (newNode) {
      goToEnd++;
      newNode = newNode?.nextSibling();
    }
    // node will be the dcg-mq-supsub
    node = cursor?.parentGroup().parent();
  }

  return finalGetMathquillIdent(node, goToEnd, isInSubscript);
}

function getMathquillIdentLatex(node: MqNodeViaDom | undefined) {
  return finalGetMathquillIdent(node, 0, false)?.ident;
}

/**
 * Node can be the dcg-mq-supsub, not a letter inside the subscript.
 * Or, the node can be a single letter outside a subscript.
 */
function finalGetMathquillIdent(
  node: MqNodeViaDom | undefined,
  goToEnd: number,
  isInSubscript: boolean
) {
  const latexSegments: (string | undefined)[] = [];

  // Move before a subscript
  while (node && !isStartingOperatorName(node) && !isVarName(node)) {
    if (!isIdentifierSegment(node)) return;
    node = node.prevSibling();
    goToEnd--;
  }
  if (!node) return;

  let backspaces = 1;

  // get starting variable name
  if (isVarName(node)) {
    latexSegments.push(node.latex?.());
    node = node.nextSibling();
    goToEnd++;
    backspaces++;

    // try to get sequence of operatorname characters.
  } else if (isStartingOperatorName(node)) {
    while (node && isOperatorName(node)) {
      latexSegments.push(node.latex?.());
      node = node.nextSibling();
      goToEnd++;
      backspaces++;
    }
  }

  let hasSubscript = false;

  // get optional subscript
  const subscript = node && subscriptOfSupsub(node);
  if (subscript) {
    const subLatex = subscript.latex();
    latexSegments.push(`_{${subLatex}}`);

    backspaces += subLatex.length - 1;

    hasSubscript = true;

    if (isInSubscript) goToEnd++;
  }

  const identString = latexSegments
    .filter((e) => e)
    .join("")
    .replace("_{}", "")
    .trim();

  if (!hasSubscript) {
    goToEnd = 0;
    backspaces = 1;
  } else {
    backspaces = Math.max(backspaces, 2);
  }

  return {
    ident: identString,
    type: "",
    goToEnd,
    backspaces,
  };
}

function tryGetMathquillIdent(
  mq: MathQuillField
): TryFindMQIdentResult | undefined {
  const cursor = getCursorHead(mq);
  const v = rawTryGetMathquillIdent(cursor?.nodeBefore(), cursor);
  if (!v) return;
  const ident = latexStringToIdentifierString(v.ident);
  if (!ident) return;
  return {
    ident,
    type: v.type,
    goToEndOfIdent: () => {
      for (let i = 0; i < v.goToEnd; i++) {
        mq.keystroke("Right");
      }
    },
    deleteIdent: () => {
      for (let i = 0; i < v.backspaces; i++) {
        mq.keystroke("Backspace");
      }
    },
  };
}

export function getMathquillIdentifierAtCursorPosition(
  mq: MathQuillField
): TryFindMQIdentResult | undefined {
  return tryGetMathquillIdent(mq);
}

export interface PartialFunctionCall {
  ident: string;
  paramIndex: number;
}

export function getPartialFunctionCall(
  mq: MathQuillField
): PartialFunctionCall | undefined {
  const cursor: MqCursorViaDom | undefined = getCursorHead(mq);
  /**
   * If we haven't gone to any parents yet,
   * `nodeBeforeCursor` is the actual node left of the cursor, such as
   * "x" in `f(x<!>)`, where `<!>` is the cursor.
   * But if it's something like `f([x<!>])`, after the first iteration,
   * `nodeBeforeCursor` will be `[x]`, so it's really the node containing the cursor.
   */
  let nodeBeforeCursor = cursor?.nodeBefore();
  let parentGroup = cursor?.parentGroup();
  while (parentGroup) {
    // Check if it looks like a function call.
    const parentheses = parentGroup.parent();
    const nodeBeforeParentheses = parentheses?.prevSibling();

    const ltx = getMathquillIdentLatex(nodeBeforeParentheses);
    if (ltx && isIdentStr(ltx) && parentheses?.latex().startsWith("\\left(")) {
      // Count number of commas to left of cursor.
      let paramIndex = 0;
      let scanNode = nodeBeforeCursor;
      while (scanNode) {
        const ltx = scanNode.latex?.();
        if (ltx === ",") paramIndex++;
        scanNode = scanNode.prevSibling();
      }
      return {
        ident: latexStringToIdentifierString(ltx)!,
        paramIndex,
      };
    }

    // Else go to the parent.
    // cursor = cursor.parent?.parent;
    const parentNode = parentGroup.parent();
    parentGroup = parentNode?.parent();
    nodeBeforeCursor = parentNode;
  }
}

/**
 * E.g. cursor is after a sequence of letters like `ftest`, and `f_{test}`
 * is defined. Then return `f_test`.
 */
export function getCorrectableIdentifier(mq: MathQuillField): {
  ident: string;
  back: () => void;
} {
  const cursor = getCursorHead(mq);
  let node = cursor?.nodeBefore();

  const parentGroup = cursor?.parentGroup();
  const isInSubscript = parentGroup && isSubscriptGroup(parentGroup);

  // don't bother if you're in a subscript
  if (isInSubscript) {
    return { ident: "", back: () => {} };
  }

  const identifierSegments: string[] = [];
  const segmentGoBackLengths: number[] = [];

  while (node) {
    const subscriptInside = getSubscriptInside(node);
    const isSubscript = subscriptInside !== undefined;
    const isValid =
      isOperatorName(node) || isVarName(node) || isSubscript || isDigit(node);
    if (!isValid) break;

    const ltx = node.latex();
    if (ltx === undefined) break;
    const filteredLatex = ltx.replace(/[^a-zA-Z0-9]/g, "");
    // MathQuill considers "." to be a digit, so filter out that case.
    if (filteredLatex.length === 0) break;
    identifierSegments.push(filteredLatex);

    const goBack = isSubscript ? subscriptInside.length : 1;
    segmentGoBackLengths.push(goBack);

    node = node.prevSibling();
  }

  identifierSegments.reverse();

  // remove all leading numbers from the identifier
  while (identifierSegments[0]?.match(/^[0-9]+$/g)) {
    identifierSegments.splice(0, 1);
    segmentGoBackLengths.splice(0, 1);
  }

  let goBack = 0;
  for (const len of segmentGoBackLengths) {
    goBack += len;
  }

  const back = () => {
    for (let i = 0; i < goBack; i++) {
      mq.keystroke("Backspace");
    }
  };

  if (identifierSegments.length === 1) {
    return {
      ident: identifierSegments[0],
      back,
    };
  } else if (identifierSegments.length > 1) {
    return {
      ident: identifierSegments[0] + "_" + identifierSegments.slice(1).join(""),
      back,
    };
  } else {
    return { ident: "", back: () => {} };
  }
}
