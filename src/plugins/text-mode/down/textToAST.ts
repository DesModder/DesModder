import { parser } from "../lezer/syntax.grammar";
import { printTree } from "../lezer/print-lezer-tree";
import { SyntaxNode } from "@lezer/common";
import {
  Statement,
  Expression,
  RepeatedExpression,
  RangeExpression,
  ListExpression,
  PiecewiseBranch,
  BinaryExpression,
  CallExpression,
  MappingEntry,
  Identifier,
  AssignmentExpression,
  TableColumn,
} from "./textAST";

export default function textToAST(text: string) {
  const cst = parser.parse(text);
  console.groupCollapsed("Program");
  console.log(printTree(cst, text));
  console.groupEnd();
  if (cst.type.name !== "Program") {
    throw "Expected parsed program";
  }
  const cursor = cst.cursor();
  const hasFirstChild = cursor.firstChild();
  if (!hasFirstChild) {
    throw "Expected nonempty program";
  }
  const statements = [];
  do {
    statements.push(statementToAST(text, cursor.node));
  } while (cursor.nextSibling());
  return statements;
}

function statementToAST(text: string, node: SyntaxNode): Statement {
  const style = styleToAST(text, node.getChild("StyleMapping"));
  switch (node.name) {
    case "ShowStatement":
      return {
        type: "ShowStatement",
        expr: exprToAST(text, node.getChild("Expression")!),
        show: isShown(node.getChild("ShowOrHidden")!),
        style,
      };
    case "LetStatement":
      return {
        type: "LetStatement",
        identifier: identifierToAST(text, node.getChild("Identifier")),
        expr: exprToAST(text, node.getChild("Expression")!),
        style,
      };
    case "FunctionDefinition":
      const fdExprChildren = node
        .getChild("CallExpression")!
        .getChildren("Expression");
      return {
        type: "FunctionDefinition",
        identifier: identifierToAST(text, fdExprChildren[0]),
        params: fdExprChildren
          .slice(1)
          .map((node) => identifierToAST(text, node)),
        expr: exprToAST(text, node.getChildren("Expression")![1]),
        style,
      };
    case "RegressionStatement":
      const regressionChildren = node.getChildren("Expression");
      return {
        type: "RegressionStatement",
        left: exprToAST(text, regressionChildren[0]),
        right: exprToAST(text, regressionChildren[1]),
        style,
      };
    case "Table":
      return {
        type: "Table",
        columns: node
          .getChild("TableInner")!
          .getChildren("TableColumn")
          .map((node) => tableColumnToAST(text, node)),
        style,
      };
    case "Image":
      const imageStrings = node.getChildren("String");
      return {
        type: "Image",
        name: parseString(text, imageStrings[0]),
        url: parseString(text, imageStrings[1]),
        style,
      };
    case "Text":
      return {
        type: "Text",
        text: parseString(text, node.getChild("String")!),
        style,
      };
    case "Folder":
      return {
        type: "Folder",
        name: parseString(text, node.getChild("String")!),
        children: node
          .getChild("FolderInner")!
          .getChildren("Statement")
          .map((node) => statementToAST(text, node)),
        style,
      };
    case "Settings":
      return {
        type: "Settings",
        style,
      };
    default:
      throw `Unexpected statment type ${node.name}`;
  }
}

/**
 * @param node StyleMapping
 */
function styleToAST(text: string, node: SyntaxNode | null) {
  if (node == null) return null;
  return {
    type: "StyleMapping" as const,
    entries: node
      ?.getChildren("MappingEntry")
      .map((node) => mappingEntryToAST(text, node)),
  };
}

/**
 * @param node Expression
 */
function exprToAST(text: string, node: SyntaxNode): Expression {
  switch (node.name) {
    case "Number":
      return {
        type: "Number",
        value: parseFloat(text.substring(node.from, node.to)),
      };
    case "Identifier":
      return identifierToAST(text, node);
    case "String":
      return {
        type: "String",
        value: parseString(text, node),
      };
    case "RepeatedExpression":
      return repeatedExpressionToAST(text, node);
    case "ListExpression":
      return listExpressionToAST(text, node);
    case "ListComprehension":
      return {
        type: "ListComprehension",
        expr: exprToAST(text, node.getChild("Expression")!),
        assignments: node
          .getChildren("AssignmentExpression")
          .map((node) => assignmentToAST(text, node)),
      };
    case "Piecewise":
      return {
        type: "PiecewiseExpression",
        branches: node
          .getChildren("PiecewiseBranch")
          .map((node) => piecewiseBranchToAST(text, node)),
      };
    case "PrefixExpression":
      return {
        type: "PrefixExpression",
        op: "negative",
        expr: exprToAST(text, node.getChild("Expression")!),
      };
    case "ParenthesizedExpression":
      return parenToAST(text, node);
    case "MemberExpression":
      const meExpr = node.getChild("Expression")!;
      return {
        type: "MemberExpression",
        object: exprToAST(text, meExpr),
        property: identifierToAST(text, meExpr.nextSibling!.nextSibling!),
      };
    case "ListAccessExpression":
      const laExpr = node.getChild("Expression")!;
      const laIndex = exprToAST(text, laExpr.nextSibling!);
      return {
        type: "ListAccessExpression",
        expr: exprToAST(text, laExpr),
        index:
          laIndex.type === "ListExpression" && laIndex.values.length === 1
            ? laIndex.values[0]
            : laIndex,
      };
    case "BinaryExpression":
      return binaryExpressionToAST(text, node);
    case "PostfixExpression":
      return {
        type: "PostfixExpression",
        op: "factorial",
        expr: exprToAST(text, node.getChild("Expression")!),
      };
    case "CallExpression":
      return callExpressionToAST(text, node);
    default:
      throw `Unexpected expression node: ${node.name}`;
  }
}

/**
 * @param node RepeatedExpression
 */
function repeatedExpressionToAST(
  text: string,
  node: SyntaxNode
): RepeatedExpression {
  const exprs = node.getChildren("Expression");
  const name = node.firstChild!.firstChild!.name;
  if (name !== "integral" && name !== "sum" && name !== "product") {
    throw `Unexpected repeated oeprator name: ${name}`;
  }
  return {
    type: "RepeatedExpression",
    name: name,
    index: identifierToAST(text, node.getChild("Identifier")),
    start: exprToAST(text, exprs[0]),
    end: exprToAST(text, exprs[1]),
    expr: exprToAST(text, exprs[2]),
  };
}

/**
 * @param node ListExpression
 */
function listExpressionToAST(
  text: string,
  node: SyntaxNode
): RangeExpression | ListExpression {
  const exprsStart = node.getChildren("Expression", "...", null);
  const exprsEnd = node.getChildren("Expression", null, "...");
  if (exprsStart.length && exprsEnd.length) {
    return {
      type: "RangeExpression",
      fromValues: exprsStart.map((node) => exprToAST(text, node)),
      endValues: exprsEnd.map((node) => exprToAST(text, node)),
    };
  } else {
    const exprs = node.getChildren("Expression");
    return {
      type: "ListExpression",
      values: exprs.map((node) => exprToAST(text, node)),
    };
  }
}

/**
 * @param node AssignmentExpression
 */
function assignmentToAST(text: string, node: SyntaxNode): AssignmentExpression {
  const variableNode = node.getChild("Identifier")!;
  return {
    type: "AssignmentExpression",
    variable: identifierToAST(text, variableNode),
    expr: exprToAST(text, variableNode.nextSibling!.nextSibling!),
  };
}

/**
 * @param node PiecewiseBranch
 */
function piecewiseBranchToAST(text: string, node: SyntaxNode): PiecewiseBranch {
  const exprs = node.getChildren("Expression");
  return {
    type: "PiecewiseBranch",
    condition: exprToAST(text, exprs[0]),
    consequent: exprToAST(text, exprs[1]),
  };
}

const binaryOps = ["^", "/", "*", "+", "-", "<", "<=", ">=", ">", "="];

/**
 * @param node BinaryExpression
 */
function binaryExpressionToAST(
  text: string,
  node: SyntaxNode
): BinaryExpression {
  const exprs = node.getChildren("Expression");
  const opNode = exprs[0].nextSibling!;
  console.log("op", opNode);
  const op = text.substring(opNode.from, opNode.to);
  if (!binaryOps.includes(op)) {
    throw `Unexpected binary operator: ${op}`;
  }
  return {
    type: "BinaryExpression",
    op: op as "^" | "/" | "*" | "+" | "-" | "<" | "<=" | ">=" | ">" | "=",
    left: exprToAST(text, exprs[0]),
    right: exprToAST(text, exprs[1]),
  };
}

/**
 * @param node CallExpression
 */
function callExpressionToAST(text: string, node: SyntaxNode): CallExpression {
  const exprs = node.getChildren("Expression");
  return {
    type: "CallExpression",
    callee: exprToAST(text, exprs[0]),
    arguments: exprs.slice(1).map((expr) => exprToAST(text, expr)),
  };
}

/**
 * @param node ParenthesizedExpression
 */
function parenToAST(text: string, node: SyntaxNode): Expression {
  const exprs = node.getChildren("Expression");
  if (exprs.length === 1) {
    return exprToAST(text, exprs[0]);
  } else if (exprs.length === 2) {
    return {
      type: "PointExpression",
      values: [exprToAST(text, exprs[0]), exprToAST(text, exprs[1])],
    };
  } else {
    throw "Points may not have more than 2 coordinates";
  }
}

/**
 * @param node MappingEntry
 */
function mappingEntryToAST(text: string, node: SyntaxNode): MappingEntry {
  return {
    type: "MappingEntry",
    property: identifierName(text, node.getChild("Identifier")!),
    expr: exprToAST(text, node.getChild("Expression")!),
  };
}

/**
 * @param node Identifier
 */
function identifierName(text: string, node: SyntaxNode | null): string {
  if (node?.name !== "Identifier") {
    throw "Expected identifier";
  }
  return text.substring(node.from, node.to);
}

/**
 * @param node Identifier
 */
function identifierToAST(text: string, node: SyntaxNode | null): Identifier {
  return {
    type: "Identifier",
    name: identifierName(text, node),
  };
}

/**
 * @param node ShowOrHidden
 */
function isShown(node: SyntaxNode) {
  return node.firstChild!.name === "show";
}

/**
 * @param node TableColumn
 */
function tableColumnToAST(text: string, node: SyntaxNode): TableColumn {
  const assignmentStartIdentifier = node
    .getChild("AssignmentStart")
    ?.getChild("Identifier");
  const assignment = assignmentStartIdentifier
    ? identifierToAST(text, assignmentStartIdentifier)
    : null;
  return {
    type: "TableColumn" as const,
    show: isShown(node.getChild("ShowOrHidden")!),
    assignment,
    style: styleToAST(text, node.getChild("StyleMapping")),
  };
}

/**
 * @param node String
 */
function parseString(text: string, node: SyntaxNode): string {
  return JSON.parse(text.substring(node.from, node.to));
}
