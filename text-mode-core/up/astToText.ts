import { builders, printer } from "#prettier/doc";
import type * as DocNS from "#prettier/doc";
import TextAST, { NodePath } from "../TextAST/Synthetic";
import needsParens from "./needsParens";

type Doc = DocNS.builders.Doc;
const { group, indent, join, line, softline, hardline, ifBreak, label } =
  builders;

const REQUIRED = "required";
const REQUIRED_OR_SEMI = "required-or-semi";

export interface TextEmitOptions {
  keepOptionalSpaces?: boolean;
}

export function docToString(doc: Doc, emitOpts?: TextEmitOptions): string {
  const keepOptionalSpaces = emitOpts?.keepOptionalSpaces ?? true;
  if (!keepOptionalSpaces) doc = removeUnrequiredSpaces(doc);

  return printer.printDocToString(doc, {
    printWidth: 80,
    tabWidth: 2,
    useTabs: false,
  }).formatted;
}

export function astItemToTextString(
  item: TextAST.Statement,
  emitOpts?: TextEmitOptions
): string {
  return docToString(astItemToText(new NodePath(item, null)), emitOpts);
}

export function exprToTextString(
  expr: TextAST.Expression,
  emitOpts?: TextEmitOptions
): string {
  return docToString(exprToText(new NodePath(expr, null)), emitOpts);
}

function required(doc: Doc) {
  return label(REQUIRED, doc);
}

function requiredOrSemicolon(doc: Doc) {
  return label(REQUIRED_OR_SEMI, doc);
}

function astItemToText(path: NodePath<TextAST.Statement>): Doc {
  const item = path.node;
  switch (item.type) {
    case "ExprStatement":
      // TODO fix Regression Statement
      return [
        item.residualVariable ? item.residualVariable.name + " = " : "",
        exprToText(path.withChild(item.expr, "expr")),
        item.parameters
          ? trailingRegressionParams(
              path.withChild(item.parameters, "parameters")
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
            requiredOrSemicolon([hardline, hardline]),
            item.columns.map((col, i) =>
              columnToText(path.withChild(col, "column." + i.toString()))
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
            requiredOrSemicolon([hardline, hardline]),
            item.children.map((child, i) =>
              astItemToText(path.withChild(child, "child." + i.toString()))
            )
          ),
        ]),
        hardline,
        "}",
        trailingStyleMap(path, item.style),
      ];
    case "Settings":
      return ["settings", trailingStyleMap(path, item.style)];
    case "Ticker":
      return [
        maybeRequiredSpace(
          "ticker",
          " ",
          exprToText(path.withChild(item.handler, "handler"))
        ),
        trailingStyleMap(path, item.style),
      ];
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
    styleEntryToText(path.withChild(entry, "entry." + i.toString())),
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
      regressionEntryToText(path.withChild(entry, "entry." + i.toString()))
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
  return required(JSON.stringify(str));
}

function primeOrCallToText(
  path: NodePath<TextAST.CallExpression>,
  primeOrder: number
): Doc {
  return group([
    exprToText(path.withChild(path.node.callee, "callee")),
    "'".repeat(primeOrder),
    parenthesize(
      join(
        [",", line],
        path.node.arguments.map((e, i) =>
          exprToText(path.withChild(e, "argument." + i.toString()))
        )
      )
    ),
  ]);
}

function exprToText(path: NodePath<TextAST.Expression>): Doc {
  if (
    path.node.type === "SequenceExpression" &&
    isNumericOrNumericPoint(path.node)
  ) {
    // keep numeric points like (2, 3) on the same line
    return [
      "(",
      exprToText(path.withChild(path.node.left, "left")),
      ", ",
      exprToText(path.withChild(path.node.right, "right")),
      ")",
    ];
  }
  const inner = exprToTextNoParen(path);
  if (needsParens(path)) return parenthesize(inner);
  return inner;
}

function maybeRequiredSpace(left: Doc, space: Doc, right: Doc) {
  if (endsWithWord(left) && startsWithWord(right)) {
    return [left, required(space), right];
  } else {
    return [left, space, right];
  }
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
        "(d/d",
        required(" "),
        exprToText(path.withChild(e.variable, "variable")),
        ")",
        line,
        exprToText(path.withChild(e.expr, "expr")),
      ]);
    case "RepeatedExpression":
      return group([
        e.name,
        required(" "),
        e.index.name,
        "=",
        parenthesize([
          exprToText(path.withChild(e.start, "start")),
          " ... ",
          exprToText(path.withChild(e.end, "end")),
        ]),
        line,
        exprToText(path.withChild(e.expr, "expr")),
      ]);
    case "ListExpression":
      return listToText(path as TextAST.NodePath<TextAST.ListExpression>);
    case "RangeExpression":
      return bracketize([
        group(
          join(
            ", ",
            e.startValues.map((v, i) =>
              exprToText(path.withChild(v, "startValues." + i.toString()))
            )
          )
        ),
        line,
        "...",
        line,
        group(
          join(
            ", ",
            e.endValues.map((v, i) =>
              exprToText(path.withChild(v, "endValues." + i.toString()))
            )
          )
        ),
      ]);
    case "ListAccessExpression": {
      const listAccessIndex = exprToText(path.withChild(e.index, "index"));
      return [
        exprToText(path.withChild(e.expr, "expr")),
        group(
          e.index.type === "RangeExpression" ||
            e.index.type === "ListExpression"
            ? listAccessIndex
            : bracketize(listAccessIndex)
        ),
      ];
    }
    case "MemberExpression":
      return group([
        exprToText(path.withChild(e.object, "object")),
        ".",
        e.property.name,
      ]);
    case "SequenceExpression":
      return group([
        exprToText(path.withChild(e.left, "left")),
        ",",
        line,
        exprToText(path.withChild(e.right, "right")),
      ]);
    case "UpdateRule":
      return group([
        e.variable.name,
        " -> ",
        exprToText(path.withChild(e.expr, "expr")),
      ]);
    case "ListComprehension":
      return bracketize([
        maybeRequiredSpace(
          exprToText(path.withChild(e.expr, "expr")),
          " ",
          "for"
        ),
        required(" "),
        join(
          ", ",
          e.assignments.map((assignment, i) =>
            assignmentExpressionToText(
              path.withChild(assignment, `assignments.${i}`)
            )
          )
        ),
      ]);
    case "Substitution":
      return group([
        maybeRequiredSpace(
          exprToText(path.withChild(e.body, "body")),
          line,
          "with"
        ),
        required(" "),
        join(
          ", ",
          e.assignments.map((assignment, i) =>
            assignmentExpressionToText(
              path.withChild(assignment, `assignments.${i}`)
            )
          )
        ),
      ]);
    case "PiecewiseExpression":
      return group([
        "{",
        indent([
          softline,
          join(
            [",", line],
            e.branches.map((branch) =>
              group([
                branch.condition === null
                  ? [softline]
                  : [
                      exprToText(path.withChild(branch.condition, "condition")),
                      ":",
                      line,
                    ],
                indent([
                  branch.consequent === null
                    ? "1"
                    : exprToText(
                        path.withChild(branch.consequent, "consequent")
                      ),
                ]),
              ])
            )
          ),
        ]),
        softline,
        "}",
      ]);
    case "BinaryExpression":
      return group([
        exprToText(path.withChild(e.left, "left")),
        " ",
        e.op,
        indent([line, exprToText(path.withChild(e.right, "right"))]),
      ]);
    case "DoubleInequality":
      return group([
        exprToText(path.withChild(e.left, "left")),
        " ",
        e.leftOp,
        indent([
          line,
          exprToText(path.withChild(e.middle, "middle")),
          " ",
          e.rightOp,
          line,
          exprToText(path.withChild(e.right, "right")),
        ]),
      ]);
    case "PrefixExpression":
      return ["-", exprToText(path.withChild(e.expr, "expr"))];
    case "Norm":
      return ["|", exprToText(path.withChild(e.expr, "expr")), "|"];
    case "PostfixExpression":
      return [exprToText(path.withChild(e.expr, "expr")), "!"];
    case "String":
      return stringToText(e.value);
    case "AssignmentExpression":
      return assignmentExpressionToText(
        path as NodePath<TextAST.AssignmentExpression>
      );
    default:
      e satisfies never;
      throw new Error(
        `Programming Error: Unexpected AST node ${(e as any).type}`
      );
  }
}

function assignmentExpressionToText(
  path: NodePath<TextAST.AssignmentExpression>
): Doc {
  return group([
    path.node.variable.name,
    " = ",
    exprToText(path.withChild(path.node.expr, "expr")),
  ]);
}

function numToText(num: number): Doc {
  return isFinite(num)
    ? num.toString().replace("e+", "e")
    : num > 0
    ? "infty"
    : num < 0
    ? "-infty"
    : "NaN";
}

function parenthesize(doc: Doc): Doc {
  return group(["(", indent([softline, doc]), softline, ")"]);
}

function bracketize(doc: Doc): Doc {
  return group(["[", indent([softline, doc]), softline, "]"]);
}

function listToText(path: NodePath<TextAST.ListExpression>) {
  const values = path.node.values;
  const printOneLineOnly =
    values.length > 50 || values.every(isNumericOrNumericPoint);
  const inner = values.map((v, i) =>
    exprToText(path.withChild(v, "values." + i.toString()))
  );
  return printOneLineOnly
    ? ["[", join(", ", inner), "]"]
    : bracketize(join([",", line], inner));
}

function isNumericOrNumericPoint(node: TextAST.Expression) {
  return (
    isNumericLikeLiteral(node) ||
    (node.type === "SequenceExpression" &&
      node.parenWrapped &&
      isNumericLikeLiteral(node.right) &&
      isNumericLikeLiteral(node.left))
  );
}

function isNumericLikeLiteral(node: TextAST.Expression) {
  return (
    isUnsignedNumericLikeLiteral(node) ||
    (node.type === "PrefixExpression" &&
      node.op === "-" &&
      isUnsignedNumericLikeLiteral(node.expr))
  );
}

function isUnsignedNumericLikeLiteral(node: TextAST.Expression) {
  return (
    node.type === "Number" ||
    (node.type === "Identifier" &&
      (node.name === "infty" || node.name === "NaN"))
  );
}

function removeUnrequiredSpaces(doc: Doc): Doc {
  if (typeof doc === "string") {
    // Space removal!
    return doc.replace(/\s/g, "");
  }
  if (Array.isArray(doc)) return doc.map((d) => removeUnrequiredSpaces(d));

  switch (doc.type) {
    case "fill":
    case "concat":
      return removeUnrequiredSpaces(doc.parts);
    case "if-break":
      return removeUnrequiredSpaces(doc.flatContents);
    case "group":
    case "align":
    case "indent":
    case "line-suffix":
      return removeUnrequiredSpaces(doc.contents);
    case "label":
      if ((doc as any).label === REQUIRED) return (doc as any).contents;
      if ((doc as any).label === REQUIRED_OR_SEMI) return ";";
      // The type for Label does not currently include "contents" or "label".
      // This was fixed a few days ago, waiting for release.
      // https://github.com/prettier/prettier/commit/347c60730e12d6e9e52aaa360526d8792fb818e8
      return removeUnrequiredSpaces((doc as any).contents);
    case "indent-if-break":
    case "cursor":
    case "trim":
    case "line-suffix-boundary":
    case "break-parent":
      // no children
      return doc;
    case "line":
      // Space removal!
      return [];

    default:
      doc satisfies never;
      throw new Error(`Invalid doc type: ${(doc as any)?.type}.`);
  }
}

/** dir: 0 = starts with word. -1 = ends with word.
 * Assumes there's nothing with empty children. */
function startsOrEndsWithWord(dir: 0 | -1) {
  function fn(doc: Doc | undefined): boolean {
    if (!doc) return false;
    if (typeof doc === "string")
      return /[a-zA-Z0-9_]/.test(dir === 0 ? doc[0] : doc[doc.length - 1]);
    if (Array.isArray(doc)) return fn(doc.at(dir));

    switch (doc.type) {
      case "fill":
      case "concat":
        return fn(doc.parts.at(dir));
      case "if-break":
        return fn(doc.flatContents) || fn(doc.breakContents);
      case "group":
        if (doc.expandedStates) {
          return doc.expandedStates.some((d) => fn(d));
        } else {
          return fn(doc.contents);
        }

      case "align":
      case "indent":
      case "label":
      case "line-suffix":
        // The type for Label does not currently include "contents".
        // This was fixed a few days ago, waiting for release.
        // https://github.com/prettier/prettier/commit/347c60730e12d6e9e52aaa360526d8792fb818e8
        return fn((doc as any).contents);

      case "indent-if-break":
      case "cursor":
      case "trim":
      case "line-suffix-boundary":
      case "line":
      case "break-parent":
        // no children
        return false;

      default:
        doc satisfies never;
        throw new Error(`Invalid doc type: ${(doc as any)?.type}.`);
    }
  }
  return fn;
}

const startsWithWord = startsOrEndsWithWord(0);
const endsWithWord = startsOrEndsWithWord(-1);
