import * as TextAST from "../down/TextAST";
import { itemToText } from "./augToText";

const INDENT = 2;
const INDENT_PREFIX = " ".repeat(INDENT);

export function astItemToText(item: TextAST.Statement): string {
  switch (item.type) {
    case "LetStatement":
    case "RegressionStatement":
    case "FunctionDefinition":
      // TODO: RegressionStatement should not be removed
      throw (
        "Programming Error: LetStatement, RegressionStatement, and " +
        "FunctionDefinition are slated for removal and should not be created"
      );
    case "ShowStatement":
      // TODO fix Regression Statement
      return exprToText(item.expr) + trailingStyleMap(item.style, "\n");
    case "Image":
      return (
        `image ${stringToText(item.name)} ${stringToText(item.url)}` +
        trailingStyleMap(item.style, "\n")
      );
    case "Table":
      return (
        `table {\n${item.columns.map(columnToText).join("\n")}\n}` +
        trailingStyleMap(item.style, " ")
      );
    case "Text":
      return stringToText(item.text) + trailingStyleMap(item.style, "\n");
    case "Folder":
      return (
        `folder ${stringToText(item.title)} {\n` +
        indent(item.children.map(astItemToText).join("\n\n")) +
        "\n}" +
        trailingStyleMap(item.style, " ")
      );
    case "Settings":
      return "settings" + trailingStyleMap(item.style, " ");
  }
}

function columnToText(col: TextAST.TableColumn) {
  const s = exprToText(col.expr);
  return indent(s + trailingStyleMap(col.style, " "));
}

function trailingStyleMap(style: TextAST.StyleMapping, prefix: string): string {
  if (style === null) return "";
  const main = styleMapToText(style);
  return prefix + (prefix === "\n" ? indent(main) : main);
}

function styleMapToText(style: TextAST.StyleMappingFilled): string {
  // TODO: handle quotes/unquotes for property names
  // TODO: remove newlines when only 1 or zero entries
  const lines = style.entries.map(
    (entry) =>
      entry.property.value +
      ": " +
      (entry.expr.type === "StyleMapping"
        ? styleMapToText(entry.expr)
        : exprToText(entry.expr)) +
      ","
  );
  return `@{\n${indent(lines.join("\n"))}\n}`;
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

export function exprToText(e: TextAST.Expression): string {
  switch (e.type) {
    case "Number":
      return numToText(e.value);
    case "Identifier":
      return e.name;
    case "CallExpression":
      return (
        exprToText(e.callee) + "(" + e.arguments.map(exprToText).join(",") + ")"
      );
    case "RepeatedExpression":
      return (
        `(${e.name} ${e.index.name}=` +
        `(${exprToText(e.start)} ... ${exprToText(e.end)}) ` +
        exprToText(e.expr) +
        ")"
      );
    // TODO Derivative
    // TODO Prime
    case "ListExpression":
      return "[" + e.values.map(exprToText).join(",") + "]";
    case "RangeExpression":
      return (
        "[" +
        e.startValues.map(exprToText).join(",") +
        "..." +
        e.endValues.map(exprToText).join(",") +
        "]"
      );
    case "ListAccessExpression":
      const listAccessIndex = exprToText(e.index);
      return (
        `(${exprToText(e.expr)})` +
        (e.index.type === "RangeExpression" || e.index.type === "ListExpression"
          ? listAccessIndex
          : `[${listAccessIndex}]`)
      );
    case "MemberExpression":
      return `(${exprToText(e.object)}).${e.property.name}`;
    case "SequenceExpression":
      const inner = exprToText(e.left) + "," + exprToText(e.right);
      return e.parenWrapped ? `(${inner})` : inner;
    case "UpdateRule":
      return e.variable.name + "->" + exprToText(e.expression);
    case "ListComprehension":
      return `[${exprToText(e.expr)} for ${e.assignments
        .map(
          (assignment) =>
            assignment.variable.name + "=" + exprToText(assignment.expr)
        )
        .join(",")}]`;
    case "PiecewiseExpression":
      return (
        "{" +
        e.branches
          .map(
            (branch) =>
              exprToText(branch.condition) + ":" + exprToText(branch.consequent)
          )
          .join(",") +
        "}"
      );
    case "BinaryExpression":
      return `(${exprToText(e.left)})${e.op}(${exprToText(e.right)})`;
    case "PrefixExpression":
      return `-(${exprToText(e.expr)})`;
    case "PostfixExpression":
      return `(${exprToText(e.expr)})!`;
    case "String":
      return stringToText(e.value);
    case "RegressionExpression":
      return exprToText(e.left) + " ~ " + exprToText(e.right);
    // TODO double inequality
  }
}

function numToText(num: number) {
  const s = num.toString();
  return s.includes("e") ? `(${s.replace("e", "*10^")})` : s;
}
