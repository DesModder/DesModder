import Aug from "./AugState";
import rawNeedsParens from "./augNeedsParens";
import { autoCommandNames } from "utils/depUtils";

export function latexTreeToString(e: Aug.Latex.AnyRootOrChild) {
  switch (e.type) {
    case "Equation":
    case "Assignment":
      return (
        childNodeToString(e.left, e) +
        "=" +
        childNodeToString(e.right, e, "top-level-eq")
      );
    case "FunctionDefinition":
      return (
        funcToString(e.symbol, e.argSymbols, e) +
        "=" +
        childNodeToString(e.definition, e, "top-level-eq")
      );
    case "Visualization":
      // Lower case handles "Stats" → "stats" etc
      return funcToString(e.callee, e.args, e);
    case "Regression":
      return (
        childNodeToString(e.left, e) + "\\sim " + childNodeToString(e.right, e)
      );
    default:
      return childNodeToString(e, null, "top");
  }
}

function childNodeToString(
  e: Aug.Latex.AnyChild,
  parent: Aug.Latex.AnyRootOrChild | null,
  path?: string | undefined
): string {
  const inner = childNodeToStringNoParen(e, path);
  if (rawNeedsParens(e, parent, path)) return wrapParen(inner);
  return inner;
}

function childNodeToStringNoParen(
  e: Aug.Latex.AnyChild,
  path: string | undefined
): string {
  switch (e.type) {
    case "Constant": {
      const res = e.value.toString();
      return res.includes("e") ? "(" + res.replace("e", "*10^{") + "})" : res;
    }
    case "Identifier":
      return identifierToString(e);
    case "FunctionCall":
      return funcToString(e.callee, e.args, e);
    case "Integral":
      return (
        `\\int_{${childNodeToString(e.start, e)}}` +
        `^{${childNodeToString(e.end, e)}}` +
        childNodeToString(e.integrand, e, "integrand") +
        "d" +
        identifierToString(e.differential)
      );
    case "Derivative":
      return (
        `\\frac{d}{d${identifierToString(e.variable)}}` +
        childNodeToString(e.arg, e)
      );
    case "Prime":
      return (
        identifierToString(e.arg.callee) +
        "'".repeat(e.order) +
        wrapParen(bareSeq(e.arg.args, e.arg))
      );
    case "List":
      return wrapBracket(bareSeq(e.args, e));
    case "Range":
      return wrapBracket(
        bareSeq(e.start, e, { alwaysBeforeComma: true }) +
          "..." +
          bareSeq(e.end, e)
      );
    case "ListAccess":
      return (
        childNodeToString(e.list, e, "list") +
        (e.index.type === "Range" || e.index.type === "List"
          ? childNodeToString(e.index, e)
          : wrapBracket(childNodeToString(e.index, e)))
      );
    case "DotAccess":
      return (
        childNodeToString(e.object, e, "object") +
        "." +
        childNodeToString(e.property, e)
      );
    case "OrderedPairAccess":
      return childNodeToString(e.point, e, "object") + "." + e.index;
    case "Seq":
      // needsParen handles wrapping in paren for parenWrapped
      return bareSeq(e.args, e);
    case "UpdateRule":
      return (
        identifierToString(e.variable) +
        "\\to " +
        childNodeToString(e.expression, e)
      );
    case "ListComprehension":
      return wrapBracket(
        childNodeToString(e.expr, e) +
          "\\operatorname{for}" +
          bareSeq(e.assignments, e)
      );
    case "Substitution":
      return (
        childNodeToString(e.body, e) +
        "\\operatorname{with}" +
        bareSeq(e.assignments, e)
      );
    case "Piecewise": {
      const piecewiseParts: string[] = [];
      let curr: Aug.Latex.AnyChild = e;
      while (curr.type === "Piecewise") {
        if (curr.condition === true) {
          curr = curr.consequent;
          break;
        }
        let part = childNodeToString(curr.condition, curr);
        if (!Aug.Latex.isConstant(curr.consequent, 1)) {
          part +=
            ":" +
            childNodeToString(
              curr.consequent,
              curr,
              beforeComma(
                curr.alternate.type === "Piecewise" ||
                  !Aug.Latex.isConstant(curr.alternate, NaN)
              )
            );
        }
        piecewiseParts.push(part);
        curr = curr.alternate;
      }
      if (!Aug.Latex.isConstant(curr, NaN)) {
        if (piecewiseParts.length === 0) {
          // check handles trivial piecewise {}
          if (!Aug.Latex.isConstant(curr, 1))
            throw new Error(
              "Programming error: first branch in Aug piecewise is unconditional but not 1."
            );
        } else piecewiseParts.push(childNodeToString(curr, e));
      }
      return "\\left\\{" + piecewiseParts.join(",") + "\\right\\}";
    }
    case "RepeatedOperator": {
      const prefix = e.name === "Product" ? "\\prod" : "\\sum";
      return (
        prefix +
        `_{${identifierToString(e.index)}=${childNodeToString(e.start, e)}}` +
        `^{${childNodeToString(e.end, e)}}` +
        childNodeToString(e.expression, e, "term")
      );
    }
    case "BinaryOperator": {
      const binopLeft = childNodeToString(e.left, e, "left");
      const binopRight = childNodeToString(e.right, e, "right");
      switch (e.name) {
        case "Add":
          return binopLeft + "+" + binopRight;
        case "Subtract":
          return binopLeft + "-" + binopRight;
        case "Multiply":
          return binopLeft + "\\cdot " + binopRight;
        case "Divide":
          return `\\frac{${binopLeft}}{${binopRight}}`;
        case "Exponent":
          return binopLeft + "^{" + binopRight + "}";
      }
    }
    // eslint-disable-next-line no-fallthrough
    case "Negative":
      return "-" + childNodeToString(e.arg, e);
    case "Factorial":
      return childNodeToString(e.arg, e, "factorial") + "!";
    case "Comparator":
      return (
        childNodeToString(e.left, e) +
        comparatorMap[e.operator] +
        childNodeToString(
          e.right,
          e,
          path === "top" && e.operator === "=" ? "top-level-eq" : undefined
        )
      );
    case "DoubleInequality":
      return (
        childNodeToString(e.left, e) +
        comparatorMap[e.leftOperator] +
        childNodeToString(e.middle, e) +
        comparatorMap[e.rightOperator] +
        childNodeToString(e.right, e)
      );
    case "AssignmentExpression":
      return (
        identifierToString(e.variable) +
        "=" +
        childNodeToString(e.expression, e)
      );
    default:
      e satisfies never;
      throw new Error(
        `Programming Error: Unexpected Aug node ${(e as any).type}`
      );
  }
}

const comparatorMap = {
  "<": "<",
  "<=": "\\le ",
  "=": "=",
  ">=": "\\ge ",
  ">": ">",
};

function bareSeq(
  e: Aug.Latex.AnyChild[],
  parent: Aug.Latex.AnyRootOrChild,
  { alwaysBeforeComma } = { alwaysBeforeComma: false }
): string {
  return e
    .map((f, i) =>
      childNodeToString(
        f,
        parent,
        beforeComma(alwaysBeforeComma || i < e.length - 1)
      )
    )
    .join(",");
}

function beforeComma(beforeComma: boolean) {
  return beforeComma ? "before-comma" : "last-element";
}

function funcToString(
  callee: Aug.Latex.Identifier,
  args: Aug.Latex.AnyChild[],
  parent: Aug.Latex.AnyRootOrChild
): string {
  if (callee.symbol === "abs" && args.length === 1) {
    return `\\left|${bareSeq(args, parent)}\\right|`;
  } else if (callee.symbol === "sqrt" && args.length === 1) {
    return `\\sqrt{${bareSeq(args, parent)}}`;
  } else if (callee.symbol === "nthroot" && [1, 2].includes(args.length)) {
    if (args.length === 1) return `\\sqrt{${bareSeq(args, parent)}}`;
    return `\\sqrt[${childNodeToString(args[1], parent)}]{${bareSeq(
      [...args.slice(0, 1), ...args.slice(2)],
      parent
    )}}`;
  } else if (callee.symbol === "logbase" && args.length === 2) {
    return (
      `\\log_{${childNodeToString(args[args.length - 1], parent)}}` +
      wrapParen(bareSeq(args.slice(0, args.length - 1), parent))
    );
  } else {
    return identifierToString(callee) + wrapParen(bareSeq(args, parent));
  }
}

/**
 * The backslash commands are \alpha, \beta ... \infty
 */
const backslashCommands = new Set(autoCommandNames.split(" "));

function identifierToString(id: Aug.Latex.Identifier): string {
  const symbol = id.symbol.replace(/[{}]/g, "");
  let main = symbol;
  let subscript;
  const uIndex = symbol.indexOf("_");
  if (uIndex >= 0) {
    main = symbol.substring(0, uIndex);
    subscript = symbol.substring(uIndex + 1);
    if (!/^[a-zA-Z]+$/.test(main) || !/^[a-zA-Z0-9]+$/.test(subscript)) {
      throw Error(`Unexpected character in ${symbol}`);
    }
  }
  const start =
    main.length === 1
      ? main
      : backslashCommands.has(main)
      ? "\\" + main
      : `\\operatorname{${main}}`;
  const end = subscript ? `_{${subscript}}` : "";
  return start + end;
}

function wrapParen(s: string) {
  return "\\left(" + s + "\\right)";
}

function wrapBracket(s: string) {
  return "\\left[" + s + "\\right]";
}
