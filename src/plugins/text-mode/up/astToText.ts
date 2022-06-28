import TextAST, { NodePath } from "../down/TextAST";
import needsParens from "./needsParens";

const INDENT = 2;
const INDENT_PREFIX = " ".repeat(INDENT);

export function astItemToText(path: NodePath<TextAST.Statement>): string {
  const item = path.node;
  switch (item.type) {
    case "ExprStatement":
      // TODO fix Regression Statement
      return (
        (item.regression?.residualVariable
          ? item.regression.residualVariable.name + " = "
          : "") +
        exprToText(path.withChild(item.expr, "expr")) +
        (item.regression
          ? trailingRegressionParams(
              path.withChild(item.regression.parameters, "parameters")
            )
          : "") +
        trailingStyleMap(path, item.style, "\n")
      );
    case "Image":
      return (
        `image ${stringToText(item.name)} ${stringToText(item.url)}` +
        trailingStyleMap(path, item.style, "\n")
      );
    case "Table":
      return (
        `table {\n${item.columns
          .map((col, i) => columnToText(path.withChild(col, "column." + i)))
          .join("\n")}\n}` + trailingStyleMap(path, item.style, " ")
      );
    case "Text":
      return stringToText(item.text) + trailingStyleMap(path, item.style, "\n");
    case "Folder":
      return (
        `folder ${stringToText(item.title)} {\n` +
        indent(
          item.children
            .map((child, i) =>
              astItemToText(path.withChild(child, "child." + i))
            )
            .join("\n\n")
        ) +
        "\n}" +
        trailingStyleMap(path, item.style, " ")
      );
    case "Settings":
      return "settings" + trailingStyleMap(path, item.style, " ");
  }
}

function columnToText(path: NodePath<TextAST.TableColumn>) {
  const s = exprToText(path.withChild(path.node.expr, "expr"));
  return indent(s + trailingStyleMap(path, path.node.style, " "));
}

function trailingStyleMap(
  parentPath: NodePath,
  node: TextAST.StyleMapping | null,
  prefix: string
): string {
  if (node === null) return "";
  const main = styleMapToText(parentPath.withChild(node, "style"));
  return prefix + (prefix === "\n" ? indent(main) : main);
}

function styleMapToText(path: NodePath<TextAST.StyleMapping>): string {
  // TODO: handle quotes/unquotes for property names
  // TODO: remove newlines when only 1 or zero entries
  const lines = path.node.entries.map(
    (entry, i) => styleEntryToText(path.withChild(entry, "entry." + i)) + ","
  );
  return `@{\n${indent(lines.join("\n"))}\n}`;
}

function styleEntryToText(path: NodePath<TextAST.MappingEntry>) {
  const entry = path.node;
  return (
    entry.property.value +
    ": " +
    (entry.expr.type === "StyleMapping"
      ? styleMapToText(path.withChild(entry.expr, "expr"))
      : exprToText(path.withChild(entry.expr, "expr")))
  );
}

function trailingRegressionParams(
  path: NodePath<TextAST.RegressionParameters>
): string {
  return "\n" + indent(regressionParamsToText(path));
}

function regressionParamsToText(
  path: NodePath<TextAST.RegressionParameters>
): string {
  const lines = path.node.entries.map((entry, i) =>
    regressionEntryToText(path.withChild(entry, "entry." + i))
  );
  return `#{\n${indent(lines.join("\n"))}\n}`;
}

function regressionEntryToText(
  path: NodePath<TextAST.RegressionEntry>
): string {
  return (
    exprToText(path.withChild(path.node.variable, "variable")) +
    " = " +
    exprToText(path.withChild(path.node.value, "value"))
  );
}

function indent(str: string): string {
  return str
    .split("\n")
    .map((line) => (/\S/.test(line) ? INDENT_PREFIX + line : line))
    .join("\n");
}

function stringToText(str: string) {
  return JSON.stringify(str);
}

function primeOrCallToText(
  path: NodePath<TextAST.CallExpression>,
  primeOrder: number
) {
  return (
    exprToText(path.withChild(path.node.callee, "callee")) +
    "'".repeat(primeOrder) +
    "(" +
    path.node.arguments
      .map((e, i) => exprToText(path.withChild(e, "argument." + i)))
      .join(",") +
    ")"
  );
}

export function exprToText(path: NodePath<TextAST.Expression>): string {
  const inner = exprToTextNoParen(path);
  if (needsParens(path)) return "(" + inner + ")";
  return inner;
}

export function exprToTextNoParen(path: NodePath<TextAST.Expression>): string {
  const e = path.node;
  switch (e.type) {
    case "Number":
      return numToText(e.value);
    case "Identifier":
      return e.name;
    case "CallExpression":
      return primeOrCallToText(path as NodePath<TextAST.CallExpression>, 0);
    case "PrimeExpression":
      return primeOrCallToText(path.withChild(e.expr, "expr"), e.order);
    case "DerivativeExpression":
      return `(d/d ${exprToText(
        path.withChild(e.variable, "variable")
      )}) ${exprToText(path.withChild(e.expr, "expr"))}`;
    case "RepeatedExpression":
      return (
        `${e.name} ${e.index.name}=` +
        `(${exprToText(path.withChild(e.start, "start"))} ... ${exprToText(
          path.withChild(e.end, "end")
        )}) ` +
        exprToText(path.withChild(e.expr, "expr"))
      );
    // TODO Derivative
    case "ListExpression":
      return (
        "[" +
        e.values
          .map((v, i) => exprToText(path.withChild(v, "values." + i)))
          .join(",") +
        "]"
      );
    case "RangeExpression":
      return (
        "[" +
        e.startValues
          .map((v, i) => exprToText(path.withChild(v, "startValues." + i)))
          .join(",") +
        "..." +
        e.endValues
          .map((v, i) => exprToText(path.withChild(v, "endValues" + i)))
          .join(",") +
        "]"
      );
    case "ListAccessExpression":
      const listAccessIndex = exprToText(path.withChild(e.index, "index"));
      return (
        exprToText(path.withChild(e.expr, "expr")) +
        (e.index.type === "RangeExpression" || e.index.type === "ListExpression"
          ? listAccessIndex
          : `[${listAccessIndex}]`)
      );
    case "MemberExpression":
      return (
        exprToText(path.withChild(e.object, "object")) + "." + e.property.name
      );
    case "SequenceExpression":
      return (
        exprToText(path.withChild(e.left, "left")) +
        "," +
        exprToText(path.withChild(e.right, "right"))
      );
    case "UpdateRule":
      return (
        e.variable.name + "->" + exprToText(path.withChild(e.expr, "expr"))
      );
    case "ListComprehension":
      return `[${exprToText(path.withChild(e.expr, "expr"))} for ${e.assignments
        .map((assignment, i) =>
          assignmentExpressionToText(
            path.withChild(assignment, "assignments.i")
          )
        )
        .join(",")}]`;
    case "PiecewiseExpression":
      return (
        "{" +
        e.branches
          .map(
            (branch) =>
              exprToText(path.withChild(branch.condition, "condition")) +
              ":" +
              exprToText(path.withChild(branch.consequent, "consequent"))
          )
          .join(",") +
        "}"
      );
    case "BinaryExpression":
      return (
        exprToText(path.withChild(e.left, "left")) +
        e.op +
        exprToText(path.withChild(e.right, "right"))
      );
    case "PrefixExpression":
      return "-" + exprToText(path.withChild(e.expr, "expr"));
    case "PostfixExpression":
      return exprToText(path.withChild(e.expr, "expr")) + "!";
    case "String":
      return stringToText(e.value);
    // TODO double inequality
  }
}

function assignmentExpressionToText(
  path: NodePath<TextAST.AssignmentExpression>
) {
  return (
    path.node.variable.name +
    "=" +
    exprToText(path.withChild(path.node.expr, "expr"))
  );
}

function numToText(num: number) {
  const s = num.toString();
  return s.includes("e") ? `(${s.replace("e", "*10^")})` : s;
}
