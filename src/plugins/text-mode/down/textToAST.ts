import { parser } from "../lezer/syntax.grammar";
import { printTree } from "../lezer/print-lezer-tree";
import { SyntaxNode } from "@lezer/common";
import { Tree } from "@lezer/common";
import * as TextAST from "./TextAST";
import { mapFromEntries } from "utils/utils";
import { Diagnostic } from "@codemirror/lint";
import { error, warning } from "./diagnostics";
import { everyNonNull } from "utils/utils";

class TextAndDiagnostics {
  constructor(public text: string, public diagnostics: Diagnostic[]) {}

  nodeText(pos: TextAST.Pos) {
    return this.text.substring(pos.from, pos.to);
  }

  pushError(message: string, pos: TextAST.Pos | undefined) {
    this.diagnostics.push(error(message, pos));
  }

  pushWarning(message: string, pos: TextAST.Pos | undefined) {
    this.diagnostics.push(warning(message, pos));
  }
}

/**
 * Convert the given string text to AST, throwing out all error nodes and
 * ancestors of error nodes in the CST except for Program.
 */
export default function textToAST(
  text: string
): [Diagnostic[], TextAST.Statement[] | null] {
  const cst = parser.parse(text);
  console.groupCollapsed("Program");
  console.log(printTree(cst, text));
  console.groupEnd();
  if (cst.type.name !== "Program") {
    throw "Programming error: expected parsed program";
  }
  const statements: TextAST.Statement[] = [];
  const td = new TextAndDiagnostics(text, []);
  for (const statementNode of statementsWithoutErrors(td, cst)) {
    const statementAST = statementToAST(td, statementNode);
    statementAST && statements.push(statementAST);
  }
  return [td.diagnostics, statements];
}

/**
 * Get a list of the statement nodes that do not have any error nodes in them
 */
function statementsWithoutErrors(
  td: TextAndDiagnostics,
  cst: Tree
): SyntaxNode[] {
  const cursor = cst.cursor();
  const hasFirstChild = cursor.firstChild();
  if (!hasFirstChild) {
    td.pushWarning("Program is empty. Try typing: y=x", undefined);
    return [];
  }
  const statementNodes: SyntaxNode[] = [];
  do {
    if (!hasError(td, cursor.node)) statementNodes.push(cursor.node);
  } while (cursor.nextSibling());
  return statementNodes;
}

/**
 * Check for syntax errors, and push diagnostics. This should be executed at
 * most once per node to avoid duplicate diagnostics
 */
function hasError(td: TextAndDiagnostics, node: SyntaxNode) {
  if (node.type.isError) {
    if (node.to > node.from) {
      const text = td.nodeText(node);
      td.pushError("Syntax error; unexpected text: " + text, getPos(node));
    } else {
      td.pushError("Syntax error; expected something here", getPos(node));
    }
    return true;
  }
  const cursor = node.cursor;
  if (!cursor.firstChild()) return false;
  let foundError = false;
  do {
    // don't short-circuit, to allow indicating more errors
    if (hasError(td, cursor.node)) foundError = true;
  } while (cursor.nextSibling());
  return foundError;
}

function statementToAST(
  td: TextAndDiagnostics,
  node: SyntaxNode
): TextAST.Statement | null {
  const style = styleToAST(td, node.getChild("StyleMapping"));
  switch (node.name) {
    case "SimpleStatement":
      return simpleStatementToAST(td, node, style);
    case "RegressionStatement":
      const regressionChildren = node.getChildren("Expression");
      const regLeft = exprToAST(td, regressionChildren[0]);
      const regRight = exprToAST(td, regressionChildren[1]);
      const regBody = regressionBodyToAST(td, node.getChild("RegressionBody"));
      if (regLeft === null || regRight === null || regBody === null)
        return null;
      return {
        type: "RegressionStatement",
        left: regLeft,
        right: regRight,
        style,
        body: regBody,
        pos: getPos(node),
      };
    case "Table":
      const tableChildren = node
        .getChild("BlockInner")!
        .getChildren("Statement")
        .map((node) => tableColumnToAST(td, node));
      if (!everyNonNull(tableChildren)) return null;
      return {
        type: "Table",
        columns: tableChildren,
        style,
        pos: getPos(node),
      };
    case "Image":
      const imageStrings = node.getChildren("String");
      return {
        type: "Image",
        name: parseString(td, imageStrings[0]),
        url: parseString(td, imageStrings[1]),
        style,
        pos: getPos(node),
      };
    case "Text":
      return {
        type: "Text",
        text: parseString(td, node.getChild("String")!),
        style,
        pos: getPos(node),
      };
    case "Folder":
      const folderChildren = node
        .getChild("BlockInner")!
        .getChildren("Statement")
        .map((node) => statementToAST(td, node));
      if (!everyNonNull(folderChildren)) return null;
      return {
        type: "Folder",
        title: parseString(td, node.getChild("String")!),
        children: folderChildren,
        style,
        pos: getPos(node),
      };
    case "Settings":
      return {
        type: "Settings",
        style,
        pos: getPos(node),
      };
    default:
      throw `Programming error: Unexpected statement type ${node.name}`;
  }
}

/**
 * @param node RegressionBody
 * @returns undefined for no body, null for syntax error, else Regression
 */
function regressionBodyToAST(
  td: TextAndDiagnostics,
  node: SyntaxNode | null
): TextAST.RegressionStatement["body"] | undefined | null {
  if (!node) return undefined;
  const children = node
    .getChildren("Statement")
    .map((node): [TextAST.Identifier, TextAST.Expression] | null => {
      const ast = statementToAST(td, node);
      if (ast?.type !== "LetStatement") {
        td.pushError("Invalid regression body", getPos(node));
        return null;
      }
      return [ast.identifier, ast.expr];
    });
  if (!everyNonNull(children)) return null;
  return {
    residualVariable: identifierToAST(td, node.getChild("Identifier")),
    regressionParameters: mapFromEntries(children),
  };
}

/**
 * @param node SimpleStatement
 */
function simpleStatementToAST(
  td: TextAndDiagnostics,
  node: SyntaxNode,
  style: TextAST.StyleMapping
):
  | TextAST.FunctionDefinition
  | TextAST.LetStatement
  | TextAST.ShowStatement
  | null {
  const expr = exprToAST(td, node.getChild("Expression")!);
  if (expr === null) return null;
  if (expr.type !== "BinaryExpression" || expr.op !== "=") {
    return {
      type: "ShowStatement",
      expr: expr,
      style,
      pos: getPos(node),
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
      pos: getPos(node),
    };
  } else if (lhs.type === "CallExpression") {
    if (lhs.callee.type !== "Identifier") {
      td.pushError(
        "Member expressions cannot be used in function definitions",
        lhs.callee.pos
      );
      return null;
    }
    const nonIdentifiers = lhs.arguments.filter((e) => e.type !== "Identifier");
    for (const np of nonIdentifiers) {
      td.pushError(
        `Expected parameter to be an identifier, got ${td.nodeText(np.pos!)}`,
        np.pos
      );
    }
    if (nonIdentifiers.length > 0) return null;
    return {
      type: "FunctionDefinition",
      callee: lhs.callee,
      params: lhs.arguments as TextAST.Identifier[],
      expr: rhs,
      style,
      pos: getPos(node),
    };
  } else {
    throw "Programming Error: LetStatement left-hand side is not an identifier or call expression";
  }
}

/**
 * @param node StyleMapping
 */
function styleToAST(td: TextAndDiagnostics, node: SyntaxNode | null) {
  if (node == null) return null;
  return styleToASTKnown(td, node);
}

function styleToASTKnown(td: TextAndDiagnostics, node: SyntaxNode) {
  return {
    type: "StyleMapping" as const,
    entries: node
      ?.getChildren("MappingEntry")
      .map((node) => mappingEntryToAST(td, node)),
    pos: getPos(node),
  };
}

/**
 * @param node Expression
 */
function exprToAST(
  td: TextAndDiagnostics,
  node: SyntaxNode
): TextAST.Expression | null {
  switch (node.name) {
    case "Number":
      return {
        type: "Number",
        value: parseFloat(td.nodeText(node)),
        pos: getPos(node),
      };
    case "Identifier":
      return identifierToAST(td, node);
    case "String":
      return {
        type: "String",
        value: parseString(td, node),
        pos: getPos(node),
      };
    case "RepeatedExpression":
      return repeatedExpressionToAST(td, node);
    case "ListExpression":
      return listExpressionToAST(td, node);
    case "ListComprehension":
      const listcompArg = exprToAST(td, node.getChild("Expression")!);
      const listcompAssignments = node
        .getChildren("AssignmentExpression")
        .map((node) => assignmentToAST(td, node));
      if (listcompArg === null || !everyNonNull(listcompAssignments))
        return null;
      return {
        type: "ListComprehension",
        expr: listcompArg,
        assignments: listcompAssignments,
        pos: getPos(node),
      };
    case "Piecewise":
      const piecewiseChildren = node.getChildren("PiecewiseBranch");
      if (piecewiseChildren.length === 0)
        throw "Programming error: empty piecewise not yet implemented";
      const piecewiseBranches = piecewiseChildren.map((node) =>
        piecewiseBranchToAST(td, node)
      );
      if (!everyNonNull(piecewiseBranches)) return null;
      return {
        type: "PiecewiseExpression",
        branches: piecewiseBranches,
        pos: getPos(node),
      };
    case "PrefixExpression":
      const prefixArg = exprToAST(td, node.getChild("Expression")!);
      if (prefixArg === null) return null;
      return {
        type: "PrefixExpression",
        op: "negative",
        expr: prefixArg,
        pos: getPos(node),
      };
    case "ParenthesizedExpression":
      return parenToAST(td, node);
    case "MemberExpression":
      const memberObj = exprToAST(td, node.getChild("Expression")!);
      if (memberObj === null) return null;
      return {
        type: "MemberExpression",
        object: memberObj,
        property: identifierToAST(td, node.getChild("DotAccessIdentifier")!),
        pos: getPos(node),
      };
    case "ListAccessExpression":
      const laExprNode = node.getChild("Expression")!;
      const laIndex = exprToAST(td, laExprNode.nextSibling!);
      const laExpr = exprToAST(td, laExprNode);
      if (laIndex === null || laExpr === null) return null;
      return {
        type: "ListAccessExpression",
        expr: laExpr,
        index:
          laIndex.type === "ListExpression" && laIndex.values.length === 1
            ? laIndex.values[0]
            : laIndex,
        pos: getPos(node),
      };
    case "BinaryExpression":
      return binaryExpressionToAST(td, node);
    case "PostfixExpression":
      const postfixArg = exprToAST(td, node.getChild("Expression")!);
      if (postfixArg === null) return null;
      return {
        type: "PostfixExpression",
        op: "factorial",
        expr: postfixArg,
        pos: getPos(node),
      };
    case "CallExpression":
      return callExpressionToAST(td, node);
    case "UpdateRule":
      const updateVar = exprToAST(td, node.getChild("Expression")!);
      const updateExpr = exprToAST(td, node.getChild("Expression", "->")!);
      if (updateVar === null || updateExpr === null) return null;
      return {
        type: "UpdateRule",
        variable: updateVar,
        expression: updateExpr,
        pos: getPos(node),
      };
    case "SequenceExpression":
      const seqLeft = exprToAST(td, node.getChild("Expression")!);
      const seqRight = exprToAST(td, node.getChild("Expression", ",")!);
      if (seqLeft === null || seqRight === null) return null;
      return {
        type: "SequenceExpression",
        left: seqLeft,
        right: seqRight,
        parenWrapped: false,
        pos: getPos(node),
      };
    default:
      throw `Programming error: Unexpected expression node: ${node.name}`;
  }
}

/**
 * @param node RepeatedExpression
 */
function repeatedExpressionToAST(
  td: TextAndDiagnostics,
  node: SyntaxNode
): TextAST.RepeatedExpression | null {
  const exprs = node.getChildren("Expression");
  const name = node.firstChild!.name;
  if (name !== "integral" && name !== "sum" && name !== "product") {
    throw `Programming error: Unexpected repeated operator name: ${name}`;
  }
  const startExpr = exprToAST(td, exprs[1]);
  const endExpr = exprToAST(td, exprs[2]);
  const exprExpr = exprToAST(td, exprs[3]);
  if (startExpr === null || endExpr === null || exprExpr === null) return null;
  return {
    type: "RepeatedExpression",
    name: name,
    index: identifierToAST(td, exprs[0]),
    start: startExpr,
    end: endExpr,
    expr: exprExpr,
    pos: getPos(node),
  };
}

/**
 * @param node ListExpression
 */
function listExpressionToAST(
  td: TextAndDiagnostics,
  node: SyntaxNode
): TextAST.RangeExpression | TextAST.ListExpression | null {
  const exprsStart = node.getChildren("Expression", null, "...");
  const exprsEnd = node.getChildren("Expression", "...");
  if (exprsEnd.length) {
    const startValues = exprsStart.map((node) => exprToAST(td, node));
    const endValues = exprsEnd.map((node) => exprToAST(td, node));
    if (!everyNonNull(startValues) || !everyNonNull(endValues)) return null;
    return {
      type: "RangeExpression",
      startValues,
      endValues,
      pos: getPos(node),
    };
  } else {
    const exprs = node.getChildren("Expression");
    const values = exprs.map((node) => exprToAST(td, node));
    if (!everyNonNull(values)) return null;
    return {
      type: "ListExpression",
      values,
      pos: getPos(node),
    };
  }
}

/**
 * @param node AssignmentExpression
 */
function assignmentToAST(
  td: TextAndDiagnostics,
  node: SyntaxNode
): TextAST.AssignmentExpression | null {
  const variableNode = node.getChild("Identifier")!;
  const expr = exprToAST(td, variableNode.nextSibling!.nextSibling!);
  if (expr === null) return null;
  return {
    type: "AssignmentExpression",
    variable: identifierToAST(td, variableNode),
    expr,
    pos: getPos(node),
  };
}

/**
 * @param node PiecewiseBranch
 */
function piecewiseBranchToAST(
  td: TextAndDiagnostics,
  node: SyntaxNode
): TextAST.PiecewiseBranch | null {
  const exprs = node.getChildren("Expression");
  const condition = exprToAST(td, exprs[0]);
  const consequent = exprs[1]
    ? exprToAST(td, exprs[1])
    : {
        type: "Number" as const,
        value: 1,
      };
  if (condition === null || consequent === null) return null;
  return {
    type: "PiecewiseBranch",
    condition,
    consequent,
    pos: getPos(node),
  };
}

const binaryOps = ["^", "/", "*", "+", "-", "<", "<=", ">=", ">", "="];

/**
 * @param node BinaryExpression
 */
function binaryExpressionToAST(
  td: TextAndDiagnostics,
  node: SyntaxNode
): TextAST.BinaryExpression | null {
  const exprs = node.getChildren("Expression");
  const opNode = exprs[0].nextSibling!;
  const op = td.nodeText(opNode);
  if (!binaryOps.includes(op)) {
    throw `Programming Error: Unexpected binary operator: ${op}`;
  }
  const left = exprToAST(td, exprs[0]);
  const right = exprToAST(td, exprs[1]);
  if (left === null || right === null) return null;
  return {
    type: "BinaryExpression",
    op: op as "^" | "/" | "*" | "+" | "-" | "<" | "<=" | ">=" | ">" | "=",
    left,
    right,
    pos: getPos(node),
  };
}

/**
 * @param node CallExpression
 */
function callExpressionToAST(
  td: TextAndDiagnostics,
  node: SyntaxNode
): TextAST.CallExpression | null {
  const exprs = node.getChildren("Expression");
  if (exprs[0].name !== "Identifier" && exprs[0].name !== "MemberExpression") {
    td.pushError(
      "Invalid callee; expected identifier or member expression",
      getPos(exprs[0])
    );
    return null;
  }
  const callee = exprToAST(td, exprs[0]);
  const args = exprs.slice(1).map((expr) => exprToAST(td, expr));
  if (callee === null || !everyNonNull(args)) return null;
  return {
    type: "CallExpression",
    callee,
    arguments: args,
    pos: getPos(node),
  };
}

/**
 * @param node ParenthesizedExpression
 */
function parenToAST(
  td: TextAndDiagnostics,
  node: SyntaxNode
): TextAST.Expression | null {
  const expr = exprToAST(td, node.getChild("Expression")!);
  if (expr === null) return null;
  if (expr.type === "SequenceExpression") {
    expr.parenWrapped = true;
  }
  return expr;
}

/**
 * @param node MappingEntry
 */
function mappingEntryToAST(
  td: TextAndDiagnostics,
  node: SyntaxNode
): TextAST.MappingEntry {
  const expr = node.lastChild!;
  return {
    type: "MappingEntry",
    property: identifierToStringAST(td, node.getChild("Identifier")!),
    expr:
      expr.name === "StyleMapping" ? styleToAST(td, expr) : exprToAST(td, expr),
    pos: getPos(node),
  };
}

/**
 * @param node Identifier | DotAccessIdentifier
 */
function identifierName(
  td: TextAndDiagnostics,
  node: SyntaxNode | null
): string {
  if (node?.name === "DotAccessIdentifier") {
    return td.text.substring(node.from + 1, node.to);
  } else if (node?.name === "Identifier") {
    return td.nodeText(node);
  } else {
    throw "Programming Error: expected identifier here";
  }
}

/**
 * @param node Identifier | DotAccessIdentifier
 */
function identifierToAST(
  td: TextAndDiagnostics,
  node: SyntaxNode | null
): TextAST.Identifier {
  return {
    type: "Identifier",
    name: identifierName(td, node),
    pos: node ? getPos(node) : undefined,
  };
}

function identifierToStringAST(
  td: TextAndDiagnostics,
  node: SyntaxNode | null
): TextAST.String {
  return {
    type: "String",
    value: identifierName(td, node),
    pos: node ? getPos(node) : undefined,
  };
}

/**
 * @param node TableInner statement
 */
function tableColumnToAST(
  td: TextAndDiagnostics,
  node: SyntaxNode
): TextAST.TableColumn | null {
  if (node.name !== "SimpleStatement") {
    td.pushError(
      "Expected a valid table column. Try: x1 = [1, 2, 3]",
      getPos(node)
    );
    return null;
  }
  const style = styleToAST(td, node.getChild("StyleMapping"));
  const simple = simpleStatementToAST(td, node, style);
  if (simple === null) return null;
  if (simple.type === "FunctionDefinition") {
    td.pushError("Table column cannot be a function definition", simple.pos);
    return null;
  }
  return simple;
}

/**
 * @param node String
 */
function parseString(td: TextAndDiagnostics, node: SyntaxNode): string {
  return JSON.parse(td.nodeText(node));
}

function getPos(node: SyntaxNode): TextAST.Pos {
  return {
    from: node.from,
    to: node.to,
  };
}
