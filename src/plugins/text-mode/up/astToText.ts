import TextAST, { NodePath } from "../down/TextAST";
import needsParens from "./needsParens";

import { builders, printer } from "prettier/doc";
import * as DocNS from "prettier/doc";
type Doc = DocNS.builders.Doc;
const { group, indent, join, line, softline, hardline, ifBreak, breakParent } =
  builders;

export function docToString(doc: Doc): string {
  return printer.printDocToString(doc, {
    printWidth: 60,
    tabWidth: 2,
    useTabs: false,
  }).formatted;
}

export function astItemToTextString(path: NodePath<TextAST.Statement>): string {
  return docToString(astItemToText(path));
}

function astItemToText(path: NodePath<TextAST.Statement>): Doc {
  const item = path.node;
  switch (item.type) {
    case "ExprStatement":
      // TODO fix Regression Statement
      return [
        item.regression?.residualVariable
          ? item.regression.residualVariable.name + " = "
          : "",
        exprToText(path.withChild(item.expr, "expr")),
        item.regression
          ? trailingRegressionParams(
              path.withChild(item.regression.parameters, "parameters")
            )
          : "",
        trailingStyleMap(path, item.style),
      ];
    case "Image":
      return [
        "image ",
        stringToText(item.name),
        trailingStyleMap(path, item.style),
      ];
    case "Table":
      return [
        "table {",
        indent([
          hardline,
          join(
            hardline,
            item.columns.map((col, i) =>
              columnToText(path.withChild(col, "column." + i))
            )
          ),
        ]),
        line,
        "}",
        trailingStyleMap(path, item.style),
      ];
    case "Text":
      return [stringToText(item.text), trailingStyleMap(path, item.style)];
    case "Folder":
      return [
        "folder ",
        stringToText(item.title),
        " {",
        indent([
          hardline,
          join(
            [hardline, hardline],
            item.children.map((child, i) =>
              astItemToText(path.withChild(child, "child." + i))
            )
          ),
        ]),
        hardline,
        "}",
        trailingStyleMap(path, item.style),
      ];
    case "Settings":
      return ["settings", trailingStyleMap(path, item.style)];
  }
}

function columnToText(path: NodePath<TextAST.TableColumn>): Doc {
  return [
    exprToText(path.withChild(path.node.expr, "expr")),
    trailingStyleMap(path, path.node.style),
  ];
}

function trailingStyleMap(
  parentPath: NodePath,
  node: TextAST.StyleMapping | null
): Doc {
  if (node === null) return "";
  return [" ", styleMapToText(parentPath.withChild(node, "style"))];
}

function styleMapToText(path: NodePath<TextAST.StyleMapping>): Doc {
  // TODO: handle quotes/unquotes for property names
  // TODO: remove newlines when only 1 or zero entries
  const lines = path.node.entries.map((entry, i, list) => [
    styleEntryToText(path.withChild(entry, "entry." + i)),
    i === list.length - 1 ? ifBreak(",", "") : ",",
  ]);
  return group(["@{", indent([line, join(line, lines)]), line, "}"]);
}

export function styleEntryToText(path: NodePath<TextAST.MappingEntry>) {
  const entry = path.node;
  return [
    entry.property.value,
    ": ",
    entry.expr.type === "StyleMapping"
      ? styleMapToText(path.withChild(entry.expr, "expr"))
      : exprToText(path.withChild(entry.expr, "expr")),
  ];
}

function trailingRegressionParams(
  path: NodePath<TextAST.RegressionParameters>
): Doc {
  return [" ", regressionParamsToText(path)];
}

function regressionParamsToText(
  path: NodePath<TextAST.RegressionParameters>
): Doc {
  const lines = join(
    line,
    path.node.entries.map((entry, i) =>
      regressionEntryToText(path.withChild(entry, "entry." + i))
    )
  );
  return ["#{", indent([line, lines]), line, "}"];
}

function regressionEntryToText(path: NodePath<TextAST.RegressionEntry>): Doc {
  return [
    exprToText(path.withChild(path.node.variable, "variable")),
    " = ",
    exprToText(path.withChild(path.node.value, "value")),
  ];
}

function stringToText(str: string): Doc {
  return JSON.stringify(str);
}

function primeOrCallToText(
  path: NodePath<TextAST.CallExpression>,
  primeOrder: number
): Doc {
  return [
    exprToText(path.withChild(path.node.callee, "callee")),
    "'".repeat(primeOrder),
    "(",
    join(
      ", ",
      path.node.arguments.map((e, i) =>
        exprToText(path.withChild(e, "argument." + i))
      )
    ),
    ")",
  ];
}

export function exprToTextString(path: NodePath<TextAST.Expression>): string {
  return docToString(exprToText(path));
}

function exprToText(path: NodePath<TextAST.Expression>): Doc {
  const inner = exprToTextNoParen(path);
  if (needsParens(path)) return ["(", inner, ")"];
  return inner;
}

function exprToTextNoParen(path: NodePath<TextAST.Expression>): Doc {
  const e = path.node;
  switch (e.type) {
    case "Number":
      // TODO: raw string property so users don't get their numbers auto
      // formatted to scientific notation every time
      return numToText(e.value);
    case "Identifier":
      return e.name;
    case "CallExpression":
      return primeOrCallToText(path as NodePath<TextAST.CallExpression>, 0);
    case "PrimeExpression":
      return primeOrCallToText(path.withChild(e.expr, "expr"), e.order);
    case "DerivativeExpression":
      return group([
        "(d/d ",
        exprToText(path.withChild(e.variable, "variable")),
        ")",
        line,
        exprToText(path.withChild(e.expr, "expr")),
      ]);
    case "RepeatedExpression":
      return group([
        e.name,
        line,
        e.index.name,
        "=",
        "(",
        exprToText(path.withChild(e.start, "start")),
        " ... ",
        exprToText(path.withChild(e.end, "end")),
        ") ",
        exprToText(path.withChild(e.expr, "expr")),
      ]);
    case "ListExpression":
      return group([
        "[",
        softline,
        join(
          ", ",
          e.values.map((v, i) => exprToText(path.withChild(v, "values." + i)))
        ),
        "]",
      ]);
    case "RangeExpression":
      return group([
        "[",
        join(
          ", ",
          e.startValues.map((v, i) =>
            exprToText(path.withChild(v, "startValues." + i))
          )
        ),
        "...",
        join(
          ", ",
          e.endValues.map((v, i) =>
            exprToText(path.withChild(v, "endValues" + i))
          )
        ),
        "]",
      ]);
    case "ListAccessExpression":
      const listAccessIndex = exprToText(path.withChild(e.index, "index"));
      return [
        exprToText(path.withChild(e.expr, "expr")),
        group(
          e.index.type === "RangeExpression" ||
            e.index.type === "ListExpression"
            ? listAccessIndex
            : ["[", listAccessIndex, "]"]
        ),
      ];
    case "MemberExpression":
      return group([
        exprToText(path.withChild(e.object, "object")),
        ".",
        e.property.name,
      ]);
    case "SequenceExpression":
      return group([
        exprToText(path.withChild(e.left, "left")),
        ", ",
        exprToText(path.withChild(e.right, "right")),
      ]);
    case "UpdateRule":
      return group([
        e.variable.name,
        " -> ",
        exprToText(path.withChild(e.expr, "expr")),
      ]);
    case "ListComprehension":
      return group([
        "[",
        exprToText(path.withChild(e.expr, "expr")),
        " for ",
        join(
          ", ",
          e.assignments.map((assignment, i) =>
            assignmentExpressionToText(
              path.withChild(assignment, "assignments.i")
            )
          )
        ),
        "]",
      ]);
    case "PiecewiseExpression":
      return group([
        "{",
        join(
          ", ",
          e.branches.map((branch) => [
            exprToText(path.withChild(branch.condition, "condition")),
            ": ",
            exprToText(path.withChild(branch.consequent, "consequent")),
          ])
        ),
        "}",
      ]);
    case "BinaryExpression":
      return group([
        exprToText(path.withChild(e.left, "left")),
        line,
        e.op,
        line,
        exprToText(path.withChild(e.right, "right")),
      ]);
    case "DoubleInequality":
      return group([
        exprToText(path.withChild(e.left, "left")),
        line,
        e.leftOp,
        line,
        exprToText(path.withChild(e.middle, "middle")),
        line,
        e.rightOp,
        line,
        exprToText(path.withChild(e.right, "right")),
      ]);
    case "PrefixExpression":
      return ["-", exprToText(path.withChild(e.expr, "expr"))];
    case "PostfixExpression":
      return [exprToText(path.withChild(e.expr, "expr")), "!"];
    case "String":
      return stringToText(e.value);
  }
}

function assignmentExpressionToText(
  path: NodePath<TextAST.AssignmentExpression>
): Doc {
  return group([
    path.node.variable.name,
    "=",
    exprToText(path.withChild(path.node.expr, "expr")),
  ]);
}

function numToText(num: number): Doc {
  const s = num.toString();
  return s.includes("e")
    ? group(["(", s.replace("e+", "e").replace("e", " * 10 ^ "), ")"])
    : s;
}
