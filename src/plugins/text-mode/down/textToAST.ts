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
  StyleMapping,
  FunctionDefinition,
  LetStatement,
  ShowStatement,
} from "./textAST";

export default function textToAST(text: string) {
  const cst = parser.parse(text);
  // console.groupCollapsed("Program");
  // console.log(printTree(cst, text));
  // console.groupEnd();
  if (cst.type.name !== "Program") {
    throw "Expected parsed program";
  }
  const cursor = cst.cursor();
  const hasFirstChild = cursor.firstChild();
  if (!hasFirstChild) {
    throw "Expected nonempty program";
  }
  const statements: Statement[] = [];
  do {
    statements.push(statementToAST(text, cursor.node));
  } while (cursor.nextSibling());
  return statements;
}

function statementToAST(text: string, node: SyntaxNode): Statement {
  const style = styleToAST(text, node.getChild("StyleMapping"));
  switch (node.name) {
    case "SimpleStatement":
      return simpleStatementToAST(text, node, style);
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
      throw `Unexpected statement type ${node.name}`;
  }
}

/**
 * @param node SimpleStatement
 */
function simpleStatementToAST(
  text: string,
  node: SyntaxNode,
  style: StyleMapping
): FunctionDefinition | LetStatement | ShowStatement {
  const expr = exprToAST(text, node.getChild("Expression")!);
  const prefix = node.getChild("ShowOrHidden")!.firstChild!.name;
  if (expr.type !== "BinaryExpression" || expr.op !== "=") {
    return {
      type: "ShowStatement",
      expr: expr,
      show: prefix === "show",
      style,
    };
  }
  const lhs = expr.left;
  const rhs = expr.right;
  if (lhs.type === "Identifier") {
    return {
      type: "LetStatement",
      identifier: lhs,
      expr: rhs,
      style,
    };
  } else if (lhs.type === "CallExpression") {
    if (lhs.callee.type !== "Identifier") {
      throw "Expected identifier as function definition callee";
    }
    if (lhs.arguments.some((e) => e.type !== "Identifier")) {
      throw "All parameters should be identifiers";
    }
    return {
      type: "FunctionDefinition",
      callee: lhs.callee,
      params: lhs.arguments as Identifier[],
      expr: rhs,
      style,
    };
  } else {
    throw "LetStatement left-hand side is not an identifier or call expression";
  }
}

/**
 * @param node StyleMapping
 */
function styleToAST(text: string, node: SyntaxNode | null) {
  if (node == null) return null;
  return styleToASTKnown(text, node);
}

function styleToASTKnown(text: string, node: SyntaxNode) {
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
      const piecewiseChildren = node.getChildren("PiecewiseBranch");
      if (piecewiseChildren.length === 0) throw "Empty piecewise not permitted";
      return {
        type: "PiecewiseExpression",
        branches: piecewiseChildren.map((node) =>
          piecewiseBranchToAST(text, node)
        ),
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
      return {
        type: "MemberExpression",
        object: exprToAST(text, node.getChild("Expression")!),
        property: identifierToAST(text, node.getChild("Identifier", ".")!),
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
    case "UpdateRule":
      return {
        type: "UpdateRule",
        variable: exprToAST(text, node.getChild("Expression")!),
        expression: exprToAST(text, node.getChild("Expression", "->")!),
      };
    case "SequenceExpression":
      return {
        type: "SequenceExpression",
        left: exprToAST(text, node.getChild("Expression")!),
        right: exprToAST(text, node.getChild("Expression", ",")!),
        parenWrapped: false,
      };
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
  const name = node.firstChild!.name;
  if (name !== "integral" && name !== "sum" && name !== "product") {
    throw `Unexpected repeated oeprator name: ${name}`;
  }
  return {
    type: "RepeatedExpression",
    name: name,
    index: identifierToAST(text, exprs[0]),
    start: exprToAST(text, exprs[1]),
    end: exprToAST(text, exprs[2]),
    expr: exprToAST(text, exprs[3]),
  };
}

/**
 * @param node ListExpression
 */
function listExpressionToAST(
  text: string,
  node: SyntaxNode
): RangeExpression | ListExpression {
  const exprsStart = node.getChildren("Expression", null, "...");
  const exprsEnd = node.getChildren("Expression", "...");
  if (exprsEnd.length) {
    return {
      type: "RangeExpression",
      startValues: exprsStart.map((node) => exprToAST(text, node)),
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
    consequent: exprs[1]
      ? exprToAST(text, exprs[1])
      : {
          type: "Number",
          value: 1,
        },
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
  const expr = exprToAST(text, node.getChild("Expression")!);
  if (expr.type === "SequenceExpression") {
    expr.parenWrapped = true;
  }
  return expr;
}

/**
 * @param node MappingEntry
 */
function mappingEntryToAST(text: string, node: SyntaxNode): MappingEntry {
  const expr = node.getChild("Expression", ":")!;
  return {
    type: "MappingEntry",
    property: identifierName(text, node.getChild("Identifier")!),
    expr:
      expr.name === "StyleMapping"
        ? styleToAST(text, expr)
        : exprToAST(text, expr),
  };
}

/**
 * @param node Identifier
 */
function identifierName(text: string, node: SyntaxNode | null): string {
  if (node?.name !== "Identifier") {
    debugger;
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
 * @param node TableColumn
 */
function tableColumnToAST(text: string, node: SyntaxNode): TableColumn {
  const style = styleToAST(text, node.getChild("StyleMapping"));
  const simple = simpleStatementToAST(text, node, style);
  if (simple.type === "FunctionDefinition") {
    throw "Table column cannot be a FunctionDefinition";
  }
  return simple;
}

/**
 * @param node String
 */
function parseString(text: string, node: SyntaxNode): string {
  return JSON.parse(text.substring(node.from, node.to));
}
