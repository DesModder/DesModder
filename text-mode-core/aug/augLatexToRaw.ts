import { Config } from "../TextModeConfig";
import Aug from "./AugState";
import rawNeedsParens from "./augNeedsParens";

export function latexTreeToString(cfg: Config, e: Aug.Latex.AnyRootOrChild) {
  switch (e.type) {
    case "Equation":
    case "Assignment":
      return (
        childNodeToString(cfg, e.left, e) +
        "=" +
        childNodeToString(cfg, e.right, e, "top-level-eq")
      );
    case "FunctionDefinition":
      return (
        funcToString(cfg, e.symbol, e.argSymbols, e) +
        "=" +
        childNodeToString(cfg, e.definition, e, "top-level-eq")
      );
    case "Visualization":
      // Lower case handles "Stats" → "stats" etc
      return funcToString(cfg, e.callee, e.args, e);
    case "Regression":
      return (
        childNodeToString(cfg, e.left, e) +
        "\\sim " +
        childNodeToString(cfg, e.right, e)
      );
    default:
      return childNodeToString(cfg, e, null, "top");
  }
}

function childNodeToString(
  cfg: Config,
  e: Aug.Latex.AnyChild,
  parent: Aug.Latex.AnyRootOrChild | null,
  path?: string | undefined
): string {
  const inner = childNodeToStringNoParen(cfg, e, path);
  if (rawNeedsParens(e, parent, path)) return wrapParen(inner);
  return inner;
}

function childNodeToStringNoParen(
  cfg: Config,
  e: Aug.Latex.AnyChild,
  path: string | undefined
): string {
  switch (e.type) {
    case "Constant": {
      const res = e.value.toString();
      return res.includes("e") ? "(" + res.replace("e", "*10^{") + "})" : res;
    }
    case "Identifier":
      return identifierToString(cfg, e);
    case "FunctionCall":
      return funcToString(cfg, e.callee, e.args, e);
    case "Integral":
      return (
        `\\int_{${childNodeToString(cfg, e.start, e)}}` +
        `^{${childNodeToString(cfg, e.end, e)}}` +
        childNodeToString(cfg, e.integrand, e, "integrand") +
        "d" +
        identifierToString(cfg, e.differential)
      );
    case "Derivative":
      return (
        `\\frac{d}{d${identifierToString(cfg, e.variable)}}` +
        childNodeToString(cfg, e.arg, e)
      );
    case "Prime":
      return (
        identifierToString(cfg, e.arg.callee) +
        "'".repeat(e.order) +
        wrapParen(bareSeq(cfg, e.arg.args, e.arg))
      );
    case "List":
      return wrapBracket(bareSeq(cfg, e.args, e));
    case "Range":
      return wrapBracket(
        bareSeq(cfg, e.start, e, { alwaysBeforeComma: true }) +
          "..." +
          bareSeq(cfg, e.end, e)
      );
    case "ListAccess":
      return (
        childNodeToString(cfg, e.list, e, "list") +
        (e.index.type === "Range" || e.index.type === "List"
          ? childNodeToString(cfg, e.index, e)
          : wrapBracket(childNodeToString(cfg, e.index, e)))
      );
    case "DotAccess":
      return (
        childNodeToString(cfg, e.object, e, "object") +
        "." +
        childNodeToString(cfg, e.property, e)
      );
    case "OrderedPairAccess":
      return childNodeToString(cfg, e.point, e, "object") + "." + e.index;
    case "Seq":
      // needsParen handles wrapping in paren for parenWrapped
      return bareSeq(cfg, e.args, e);
    case "UpdateRule":
      return (
        identifierToString(cfg, e.variable) +
        "\\to " +
        childNodeToString(cfg, e.expression, e)
      );
    case "ListComprehension":
      return wrapBracket(
        childNodeToString(cfg, e.expr, e) +
          "\\operatorname{for}" +
          bareSeq(cfg, e.assignments, e)
      );
    case "Substitution":
      return (
        childNodeToString(cfg, e.body, e) +
        "\\operatorname{with}" +
        bareSeq(cfg, e.assignments, e)
      );
    case "Piecewise": {
      const piecewiseParts: string[] = [];
      let curr: Aug.Latex.AnyChild = e;
      while (curr.type === "Piecewise") {
        if (curr.condition === true) {
          curr = curr.consequent;
          break;
        }
        let part = childNodeToString(cfg, curr.condition, curr);
        if (!Aug.Latex.isConstant(curr.consequent, 1)) {
          part +=
            ":" +
            childNodeToString(
              cfg,
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
        } else piecewiseParts.push(childNodeToString(cfg, curr, e));
      }
      return "\\left\\{" + piecewiseParts.join(",") + "\\right\\}";
    }
    case "RepeatedOperator": {
      const prefix = e.name === "Product" ? "\\prod" : "\\sum";
      return (
        prefix +
        `_{${identifierToString(cfg, e.index)}=${childNodeToString(
          cfg,
          e.start,
          e
        )}}` +
        `^{${childNodeToString(cfg, e.end, e)}}` +
        childNodeToString(cfg, e.expression, e, "term")
      );
    }
    case "BinaryOperator": {
      const binopLeft = childNodeToString(cfg, e.left, e, "left");
      const binopRight = childNodeToString(cfg, e.right, e, "right");
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
        default:
          e satisfies never;
          throw new Error(`Unexpected BinaryOperator ${(e as any).name}`);
      }
    }
    case "Negative":
      return "-" + childNodeToString(cfg, e.arg, e);
    case "Norm":
      return "\\left|" + childNodeToString(cfg, e.arg, e) + "\\right|";
    case "Factorial":
      return childNodeToString(cfg, e.arg, e, "factorial") + "!";
    case "Comparator":
      return (
        childNodeToString(cfg, e.left, e) +
        comparatorMap[e.operator] +
        childNodeToString(
          cfg,
          e.right,
          e,
          path === "top" && e.operator === "=" ? "top-level-eq" : undefined
        )
      );
    case "DoubleInequality":
      return (
        childNodeToString(cfg, e.left, e) +
        comparatorMap[e.leftOperator] +
        childNodeToString(cfg, e.middle, e) +
        comparatorMap[e.rightOperator] +
        childNodeToString(cfg, e.right, e)
      );
    case "AssignmentExpression":
      return (
        identifierToString(cfg, e.variable) +
        "=" +
        childNodeToString(cfg, e.expression, e)
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
  cfg: Config,
  e: Aug.Latex.AnyChild[],
  parent: Aug.Latex.AnyRootOrChild,
  { alwaysBeforeComma } = { alwaysBeforeComma: false }
): string {
  return e
    .map((f, i) =>
      childNodeToString(
        cfg,
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
  cfg: Config,
  callee: Aug.Latex.Identifier,
  args: Aug.Latex.AnyChild[],
  parent: Aug.Latex.AnyRootOrChild
): string {
  if (callee.symbol === "sqrt" && args.length === 1) {
    return `\\sqrt{${bareSeq(cfg, args, parent)}}`;
  } else if (callee.symbol === "nthroot" && [1, 2].includes(args.length)) {
    if (args.length === 1) return `\\sqrt{${bareSeq(cfg, args, parent)}}`;
    return `\\sqrt[${childNodeToString(cfg, args[1], parent)}]{${bareSeq(
      cfg,
      [...args.slice(0, 1), ...args.slice(2)],
      parent
    )}}`;
  } else if (callee.symbol === "logbase" && args.length === 2) {
    return (
      `\\log_{${childNodeToString(cfg, args[args.length - 1], parent)}}` +
      wrapParen(bareSeq(cfg, args.slice(0, args.length - 1), parent))
    );
  } else {
    return (
      identifierToString(cfg, callee) + wrapParen(bareSeq(cfg, args, parent))
    );
  }
}

export function identifierToString(
  cfg: Config,
  id: Aug.Latex.Identifier
): string {
  const tokenMatch = /^\$(\d+)$/.exec(id.symbol);
  if (tokenMatch) return `\\token{${tokenMatch[1]}}`;
  const symbol = id.symbol.replace(/[{}]/g, "");
  let main = symbol;
  let subscript;
  const uIndex = symbol.indexOf("_");
  if (uIndex >= 0) {
    main = symbol.substring(0, uIndex);
    subscript = symbol.substring(uIndex + 1);
    if (!/^[a-zA-Z]+$/.test(main) || !/^[a-zA-Z0-9]+$/.test(subscript)) {
      throw new Error(`Unexpected character in ${symbol}`);
    }
  }
  const start =
    main.length === 1
      ? main
      : cfg.commandNames.has(main)
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
