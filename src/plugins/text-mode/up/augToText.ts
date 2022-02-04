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

function graphSettingsToText(settings: Aug.GraphSettings) {
  return "settings " + styleMapToText(settings);
}

function itemToText(item: Aug.ItemAug): string {
  const base = {
    id: item.id,
    secret: item.secret,
    pinned: item.pinned,
  };
  switch (item.type) {
    case "expression":
      if (!item.latex) return "";
      return (
        getPrefix(item.latex, item.hidden) +
        " " +
        rootLatexToText(item.latex) +
        "\n" +
        indent(
          styleMapToText({
            ...base,
            ...columnExpressionCommonStyle(item),
            fill: item.fillOpacity,
            label: item.label,
            errorHidden: item.errorHidden,
            glesmos: item.glesmos,
            // TODO: regression; need to handle regressionParameters
            // regression: item.regression && styleMapToText({}),
            fractionDisplay: item.displayEvaluationAsFraction,
            slider: {
              ...item.slider,
              isPlaying: undefined,
              playing: item.slider.isPlaying,
            },
            // We will infer whether parametric or polar domain is needed
            domain: item.parametricDomain ?? item.polarDomain,
            cdf: item.cdf,
            vizProps: item.vizProps,
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
            angle: item.angle,
            opacity: item.opacity,
            foreground: item.foreground,
            draggable: item.draggable,
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
          collapsed: item.collapsed,
        })
      );
  }
}

function columnToText(col: Aug.TableColumnAug) {
  const s =
    col.latex === undefined
      ? `[${bareSeqText(col.values)}]`
      : col.latex.type === "Identifier"
      ? `${identifierToText(col.latex)} = [${bareSeqText(col.values)}]`
      : childLatexToText(col.latex);
  return indent(
    (col.hidden ? "calc " : "show ") +
      s +
      " " +
      styleMapToText(columnExpressionCommonStyle(col))
  );
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
  };
}

function styleMapToText(mapping: { [key: string]: any }) {
  return "@{\n" + indent(styleMapToTextInner(mapping)) + "\n}";
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
        parts.push(prefix + "@{\n" + indent(styleMapToTextInner(val)) + "\n}");
      }
    }
  }
  return parts.map((e) => e + ",").join("\n");
}

function stringToText(str: string) {
  return JSON.stringify(str);
}

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
      return funcToText(e.callee, e.args);
    case "Regression":
      return childLatexToText(e.left) + " ~ " + childLatexToText(e.right);
    default:
      return childLatexToText(e);
  }
}

function getPrefix(e: Aug.Latex.AnyRootOrChild, hidden: boolean): string {
  return e.type === "Assignment" || e.type === "FunctionDefinition"
    ? "let"
    : e.type === "Regression"
    ? "regression"
    : hidden
    ? "calc"
    : "show";
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
      return `(${bareSeqText(e.args)})`;
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
        piecewiseParts.push(childLatexToText(curr));
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
  // FIXME: scientific notation
  return num.toString();
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
