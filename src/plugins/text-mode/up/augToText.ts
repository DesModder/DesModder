import * as Aug from "../aug/AugState";

const INDENT = 2;

export default function augToText(aug: Aug.State) {
  // TODO: ticker
  return (
    graphSettingsToText(aug.settings) +
    aug.expressions.list
      .map(itemToText)
      .map((s) => "\n\n" + s)
      .join("")
  );
}

export function graphSettingsToText(settings: Aug.GraphSettings) {
  return "settings " + styleMapToText(settings);
}

/**
 * Return undefined if `value` matches `defaultValue` under JSON.stringify,
 * otherwise return the original `value`. Note that JSON.stringify excludes
 * nullish values like {prop: undefined} and {prop: null}.
 */
function undefineIfMatch(value: any, defaultValue: any) {
  return JSON.stringify(value) === JSON.stringify(defaultValue)
    ? undefined
    : value;
}

function undefineIfFalse(value: boolean) {
  return value === false ? undefined : true;
}

function undefineIfEmpty(value: any) {
  return undefineIfMatch(value, {});
}

function itemToText(item: Aug.ItemAug): string {
  if (item.error) {
    if (item.type === "text") {
      return stringToText(`(Error in automatic conversion: ${item.text})`);
    } else {
      return stringToText(`(Error in automatic conversion)`);
    }
  }
  const base = {
    id: item.id,
    secret: undefineIfFalse(item.secret),
    pinned: undefineIfFalse(item.type !== "folder" && item.pinned),
  };
  switch (item.type) {
    case "expression":
      if (!item.latex) return "";
      return (
        rootLatexToText(item.latex) +
        (item.regression
          ? "\n" + indent(regressionBody(item.regression))
          : "") +
        "\n" +
        indent(
          styleMapToText({
            ...base,
            ...columnExpressionCommonStyle(item),
            fill: item.fillOpacity,
            label: item.label,
            errorHidden: undefineIfFalse(item.glesmos),
            glesmos: undefineIfFalse(item.glesmos),
            logMode: undefineIfFalse(item.regression?.isLogMode ?? false),
            fractionDisplay: undefineIfFalse(item.displayEvaluationAsFraction),
            slider: undefineIfEmpty({
              ...item.slider,
              isPlaying: undefined,
              playing: item.slider.isPlaying,
            }),
            // We will infer whether parametric or polar domain is needed
            domain: undefineIfEmpty(item.parametricDomain ?? item.polarDomain),
            cdf: undefineIfEmpty(item.cdf),
            vizProps: undefineIfEmpty(item.vizProps),
            onClick: item.clickableInfo?.latex,
            clickDescription: item.clickableInfo?.description,
          })
        )
      );
    case "image":
      return (
        `image ${stringToText(item.name)} ${stringToText(item.image_url)}\n` +
        indent(
          styleMapToText({
            ...base,
            width: item.width,
            height: item.height,
            center: item.center,
            angle: undefineIfMatch(item.angle, constant(0)),
            opacity: undefineIfMatch(item.opacity, constant(1)),
            foreground: undefineIfFalse(item.foreground),
            draggable: undefineIfFalse(item.draggable),
            onClick: item.clickableInfo?.latex,
            clickDescription: item.clickableInfo?.description,
            hoveredImage: item.clickableInfo?.hoveredImage,
            depressedImage: item.clickableInfo?.depressedImage,
          })
        )
      );
    case "table":
      return (
        `table {\n${item.columns.map(columnToText).join("\n")}\n} ` +
        styleMapToText(base)
      );
    case "text":
      return stringToText(item.text) + "\n" + indent(styleMapToText(base));
    case "folder":
      return (
        "folder " +
        stringToText(item.title) +
        " {\n" +
        item.children.map((e) => indent(itemToText(e))).join("\n\n") +
        "\n} " +
        styleMapToText({
          ...base,
          collapsed: undefineIfFalse(item.collapsed),
        })
      );
  }
}

function regressionBody(data: Aug.RegressionData) {
  return (
    "# " +
    identifierToText(data.residualVariable) +
    " {\n" +
    [...data.regressionParameters.entries()]
      .map(
        ([id, value]) =>
          INDENT_PREFIX + identifierToText(id) + " = " + numToText(value)
      )
      .join("\n") +
    "\n}"
  );
}

function columnToText(col: Aug.TableColumnAug) {
  const s =
    col.latex === undefined
      ? `[${bareSeqText(col.values)}]`
      : col.latex.type === "Identifier"
      ? `${identifierToText(col.latex)} = [${bareSeqText(col.values)}]`
      : childLatexToText(col.latex);
  return indent(s + " " + styleMapToText(columnExpressionCommonStyle(col)));
}

function columnExpressionCommonStyle(
  item: Aug.TableColumnAug | Aug.ExpressionAug
) {
  return {
    color: item.color,
    lines: item.lines && {
      opacity: item.lines.opacity,
      width: item.lines.width,
      style: item.lines.style,
    },
    points: item.points && {
      opacity: item.points.opacity,
      size: item.points.size,
      style: item.points.style,
      drag: item.points.dragMode,
    },
    hidden: item.hidden,
  };
}

function styleMapToText(mapping: { [key: string]: any }) {
  const inner = styleMapToTextInner(mapping);
  return inner.split("\n").length > 1
    ? `@{\n${indent(inner)},\n}`
    : `@{${inner}}`;
}

function styleMapToTextInner(mapping: { [key: string]: any }): string {
  const parts = [];
  for (let [key, val] of Object.entries(mapping)) {
    const tv = typeof val;
    const prefix = key + ": ";
    if (tv === "boolean" || tv === "string") {
      parts.push(prefix + JSON.stringify(val));
    } else if (tv === "number") {
      parts.push(prefix + numToText(val));
    } else if (tv === "object") {
      if (val.type !== undefined) {
        parts.push(prefix + childLatexToText(val as Aug.Latex.AnyChild));
      } else {
        parts.push(prefix + styleMapToText(val));
      }
    }
  }
  return parts.join(",\n");
}

function stringToText(str: string) {
  return JSON.stringify(str);
}

const vizNameMap = {
  Stats: "stats",
  BoxPlot: "boxplot",
  DotPlot: "dotplot",
  Histogram: "histogram",
  TTest: "ttest",
  IndependentTTest: "ittest",
};

function rootLatexToText(e: Aug.Latex.AnyRootOrChild): string {
  switch (e.type) {
    case "Equation":
      return childLatexToText(e.left) + "=" + childLatexToText(e.right);
    case "Assignment":
      return childLatexToText(e.left) + "=" + childLatexToText(e.right);
    case "FunctionDefinition":
      return (
        funcToText(e.symbol, e.argSymbols) +
        "=" +
        childLatexToText(e.definition)
      );
    case "Visualization":
      return funcToText(
        { type: "Identifier", symbol: vizNameMap[e.callee.symbol] },
        e.args
      );
    case "Regression":
      return childLatexToText(e.left) + " ~ " + childLatexToText(e.right);
    default:
      return childLatexToText(e);
  }
}

function childLatexToText(e: Aug.Latex.AnyChild): string {
  switch (e.type) {
    case "Constant":
      return numToText(e.value);
    case "Identifier":
      return identifierToText(e);
    case "FunctionCall":
      return funcToText(e.callee, e.args);
    case "Integral":
      return repeatedOperator(
        "integral",
        e.differential,
        e.start,
        e.end,
        e.integrand
      );
    case "Derivative":
      return `(d/d${identifierToText(e.variable)})` + childLatexToText(e.arg);
    case "Prime":
      return (
        identifierToText(e.arg.callee) +
        "'".repeat(e.order) +
        `(${childLatexToText(e.arg.args[0])})`
      );
    case "List":
      return `[${bareSeqText(e.args)}]`;
    case "Range":
      return `[${bareSeqText(e.start)}...${bareSeqText(e.end)}]`;
    case "ListAccess":
      const listAccessIndex = childLatexToText(e.index);
      return (
        `(${childLatexToText(e.list)})` +
        (e.index.type === "Range" ? listAccessIndex : `[${listAccessIndex}]`)
      );
    case "DotAccess":
      return `(${childLatexToText(e.object)}).` + childLatexToText(e.property);
    case "OrderedPairAccess":
      return `(${childLatexToText(e.point)}).${e.index}`;
    case "Seq":
      return e.parenWrapped ? `(${bareSeqText(e.args)})` : bareSeqText(e.args);
    case "UpdateRule":
      return (
        identifierToText(e.variable) + "->" + childLatexToText(e.expression)
      );
    case "AssignmentExpression":
      return (
        identifierToText(e.variable) + "=" + childLatexToText(e.expression)
      );
    case "ListComprehension":
      return `[${e.expr} for ${bareSeqText(e.assignments)}]`;
    case "Piecewise":
      const piecewiseParts: string[] = [];
      let curr: Aug.Latex.AnyChild = e;
      while (curr.type === "Piecewise") {
        if (curr.condition === true) {
          curr = curr.consequent;
          break;
        }
        let part =
          childLatexToText(curr.condition) +
          // Always include `:1`, unlike in raw
          ":" +
          childLatexToText(curr.consequent);
        piecewiseParts.push(part);
        curr = curr.alternate;
      }
      if (!Aug.Latex.isConstant(curr, NaN)) {
        piecewiseParts.push("else:" + childLatexToText(curr));
      }
      return "{" + piecewiseParts.join(", ") + "}";
    case "RepeatedOperator":
      return repeatedOperator(
        e.name === "Product" ? "product" : "sum",
        e.index,
        e.start,
        e.end,
        e.expression
      );
    case "BinaryOperator":
      const binopLeft = childLatexToText(e.left);
      const binopRight = childLatexToText(e.right);
      return `(${binopLeft})${binopMap[e.name]}(${binopRight})`;
    case "Negative":
      return `-(${childLatexToText(e.arg)})`;
    case "Comparator":
      return childLatexToText(e.left) + e.operator + childLatexToText(e.right);
    case "DoubleInequality":
      return (
        childLatexToText(e.left) +
        e.leftOperator +
        childLatexToText(e.middle) +
        e.rightOperator +
        childLatexToText(e.right)
      );
  }
}

const binopMap = {
  Add: "+",
  Subtract: "-",
  Multiply: "*",
  Divide: "/",
  Exponent: "^",
};

function funcToText(callee: Aug.Latex.Identifier, args: Aug.Latex.AnyChild[]) {
  return identifierToText(callee) + "(" + bareSeqText(args) + ")";
}

function bareSeqText(list: Aug.Latex.AnyChild[]) {
  return list.map(childLatexToText).join(",");
}

function identifierToText(id: Aug.Latex.Identifier) {
  // FIXME: avoid collisions from underscore removal
  return id.symbol.replace("_", "");
}

function numToText(num: number) {
  const s = num.toString();
  return s.includes("e") ? `(${s.replace("e", "*10^")})` : s;
}

function repeatedOperator(
  name: string,
  variable: Aug.Latex.Identifier,
  start: Aug.Latex.AnyChild,
  end: Aug.Latex.AnyChild,
  body: Aug.Latex.AnyChild
) {
  return (
    "(" +
    name +
    " " +
    identifierToText(variable) +
    `=(${childLatexToText(start)} ... ${childLatexToText(end)}) ` +
    childLatexToText(body) +
    ")"
  );
}

const INDENT_PREFIX = " ".repeat(INDENT);

function indent(str: string) {
  return str
    .split("\n")
    .map((line) => INDENT_PREFIX + line)
    .join("\n");
}

function constant(val: number): Aug.Latex.Constant {
  return {
    type: "Constant",
    value: val,
  };
}
