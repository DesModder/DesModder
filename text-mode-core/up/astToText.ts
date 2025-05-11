import * as builders from "../../prettier-doc/builders";
import * as printer from "../../prettier-doc/printer";
import { Doc } from "../../prettier-doc/doc";
import { NodePath } from "../TextAST/Synthetic";
import { TextASTSynthetic as TextAST } from "..";
import needsParens from "./needsParens";
import { DT } from "../../prettier-doc/doc-types";

const { group, indent, join, ifBreak } = builders;

export interface TextEmitOptions {
  noOptionalSpaces?: boolean;
  noNewlines?: boolean;
}

class EmitContext {
  opts: Required<TextEmitOptions>;
  statementSep: Doc;
  hardline: Doc;
  line: Doc;
  softline: Doc;
  optionalSpace: Doc;
  comma: Doc;

  constructor(optsConfig: TextEmitOptions = {}) {
    const noOptionalSpaces = optsConfig.noOptionalSpaces ?? false;
    const noNewlines = optsConfig.noNewlines ?? false;
    this.opts = {
      noOptionalSpaces,
      noNewlines,
    };
    this.statementSep = noNewlines
      ? ";"
      : [builders.hardline, builders.hardline];
    this.line = noOptionalSpaces
      ? noNewlines
        ? []
        : builders.softline
      : noNewlines
        ? " "
        : builders.line;
    this.hardline = noNewlines ? [] : builders.hardline;
    this.softline = noNewlines ? [] : builders.softline;
    this.optionalSpace = noOptionalSpaces ? [] : " ";
    this.comma = [",", this.optionalSpace];
  }

  docToString(doc: Doc) {
    return printer.printDocToString(doc, {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
    }).formatted;
  }
}

export function astToText(item: TextAST.Node, emitOpts?: TextEmitOptions) {
  const ctx = new EmitContext(emitOpts);
  const path = new NodePath(item, null);
  return ctx.docToString(astToTextDoc(ctx, path));
}

function astToTextDoc(ctx: EmitContext, path: TextAST.NodePath) {
  switch (path.node.type) {
    case "Program":
      return join(
        ctx.statementSep,
        path.node.children.map((child, i) =>
          astItemToText(ctx, path.withChild(child, "child." + i.toString()))
        )
      );
    case "ExprStatement":
    case "Table":
    case "Image":
    case "Text":
    case "Folder":
    case "Settings":
    case "Ticker":
      return astItemToText(ctx, path as TextAST.NodePath<typeof path.node>);
    case "RegressionParameters":
      return regressionParamsToText(
        ctx,
        path as TextAST.NodePath<typeof path.node>
      );
    case "RegressionEntry":
      return regressionEntryToText(
        ctx,
        path as TextAST.NodePath<typeof path.node>
      );
    case "StyleMapping":
      return styleMapToText(ctx, path as TextAST.NodePath<typeof path.node>);
    case "MappingEntry":
      return styleEntryToText(ctx, path as TextAST.NodePath<typeof path.node>);
    case "PiecewiseBranch":
      return piecewiseBranchToText(
        ctx,
        path as TextAST.NodePath<typeof path.node>
      );
    case "Identifier":
    case "Number":
    case "String":
    case "AssignmentExpression":
    case "RepeatedExpression":
    case "RangeExpression":
    case "ListExpression":
    case "ListComprehension":
    case "Substitution":
    case "PiecewiseExpression":
    case "Restriction":
    case "Or":
    case "PrefixExpression":
    case "Norm":
    case "SequenceExpression":
    case "UpdateRule":
    case "MemberExpression":
    case "ListAccessExpression":
    case "BinaryExpression":
    case "ComparatorChain":
    case "PostfixExpression":
    case "CallExpression":
    case "PrimeExpression":
    case "DerivativeExpression":
      return exprToText(ctx, path as TextAST.NodePath<typeof path.node>);
    default:
      path.node satisfies never;
      throw new Error(`Invalid node: ${(path.node as any)?.type}`);
  }
}

function astItemToText(
  ctx: EmitContext,
  path: NodePath<TextAST.Statement>
): Doc {
  const item = path.node;
  switch (item.type) {
    case "ExprStatement":
      // TODO fix Regression Statement
      return [
        item.residualVariable
          ? [
              item.residualVariable.name,
              ctx.optionalSpace,
              "=",
              ctx.optionalSpace,
            ]
          : "",
        exprToText(ctx, path.withChild(item.expr, "expr")),
        item.parameters
          ? trailingRegressionParams(
              ctx,
              path.withChild(item.parameters, "parameters")
            )
          : "",
        trailingStyleMap(ctx, path, item.style),
      ];
    case "Image":
      return [
        "image",
        ctx.optionalSpace,
        stringToText(item.name),
        trailingStyleMap(ctx, path, item.style),
      ];
    case "Table":
      return [
        "table",
        ctx.optionalSpace,
        "{",
        indent([
          ctx.hardline,
          join(
            ctx.statementSep,
            item.columns.map((col, i) =>
              columnToText(ctx, path.withChild(col, "column." + i.toString()))
            )
          ),
        ]),
        ctx.hardline,
        "}",
        trailingStyleMap(ctx, path, item.style),
      ];
    case "Text":
      return [stringToText(item.text), trailingStyleMap(ctx, path, item.style)];
    case "Folder":
      return [
        "folder",
        ctx.optionalSpace,
        stringToText(item.title),
        ctx.optionalSpace,
        "{",
        indent([
          ctx.hardline,
          join(
            ctx.statementSep,
            item.children.map((child, i) =>
              astItemToText(ctx, path.withChild(child, "child." + i.toString()))
            )
          ),
        ]),
        ctx.hardline,
        "}",
        trailingStyleMap(ctx, path, item.style),
      ];
    case "Settings":
      return ["settings", trailingStyleMap(ctx, path, item.style)];
    case "Ticker":
      return [
        maybeRequiredSpace(
          ctx,
          "ticker",
          " ",
          exprToText(ctx, path.withChild(item.handler, "handler"))
        ),
        trailingStyleMap(ctx, path, item.style),
      ];
  }
}

function columnToText(
  ctx: EmitContext,
  path: NodePath<TextAST.TableColumn>
): Doc {
  return [
    exprToText(ctx, path.withChild(path.node.expr, "expr")),
    trailingStyleMap(ctx, path, path.node.style),
  ];
}

function trailingStyleMap(
  ctx: EmitContext,
  parentPath: NodePath,
  node: TextAST.StyleMapping | null
): Doc {
  if (node === null) return [];
  return [
    ctx.optionalSpace,
    styleMapToText(ctx, parentPath.withChild(node, "style")),
  ];
}

function styleMapToText(
  ctx: EmitContext,
  path: NodePath<TextAST.StyleMapping>
): Doc {
  // TODO: handle quotes/unquotes for property names
  // TODO: remove newlines when only 1 or zero entries
  const lines = path.node.entries.map((entry, i, list) => [
    styleEntryToText(ctx, path.withChild(entry, "entry." + i.toString())),
    i === list.length - 1 ? (ctx.opts.noNewlines ? "" : ifBreak(",", "")) : ",",
  ]);
  return group([
    "@{",
    indent([ctx.line, join(ctx.line, lines)]),
    ctx.line,
    "}",
  ]);
}

function styleEntryToText(
  ctx: EmitContext,
  path: NodePath<TextAST.MappingEntry>
) {
  const entry = path.node;
  return [
    entry.property.value,
    ":",
    ctx.optionalSpace,
    entry.expr.type === "StyleMapping"
      ? styleMapToText(ctx, path.withChild(entry.expr, "expr"))
      : exprToText(ctx, path.withChild(entry.expr, "expr")),
  ];
}

function trailingRegressionParams(
  ctx: EmitContext,
  path: NodePath<TextAST.RegressionParameters>
): Doc {
  return [ctx.optionalSpace, regressionParamsToText(ctx, path)];
}

function regressionParamsToText(
  ctx: EmitContext,
  path: NodePath<TextAST.RegressionParameters>
): Doc {
  const lines = join(
    ctx.line,
    path.node.entries.map((entry, i) =>
      regressionEntryToText(ctx, path.withChild(entry, "entry." + i.toString()))
    )
  );
  return ["#{", indent([ctx.line, lines]), ctx.line, "}"];
}

function regressionEntryToText(
  ctx: EmitContext,
  path: NodePath<TextAST.RegressionEntry>
): Doc {
  return [
    exprToText(ctx, path.withChild(path.node.variable, "variable")),
    ctx.optionalSpace,
    "=",
    ctx.optionalSpace,
    exprToText(ctx, path.withChild(path.node.value, "value")),
  ];
}

function stringToText(str: string): Doc {
  return JSON.stringify(str);
}

function primeOrCallToText(
  ctx: EmitContext,
  path: NodePath<TextAST.CallExpression>,
  primeOrder: number
): Doc {
  return group([
    exprToText(ctx, path.withChild(path.node.callee, "callee")),
    "'".repeat(primeOrder),
    parenthesize(
      ctx,
      join(
        [",", ctx.line],
        path.node.arguments.map((e, i) =>
          exprToText(ctx, path.withChild(e, "argument." + i.toString()))
        )
      )
    ),
  ]);
}

function exprToText(ctx: EmitContext, path: NodePath<TextAST.Expression>): Doc {
  if (
    path.node.type === "SequenceExpression" &&
    isNumericOrNumericPoint(path.node)
  ) {
    // keep numeric points like (2, 3) on the same line
    return [
      "(",
      exprToText(ctx, path.withChild(path.node.left, "left")),
      ctx.comma,
      exprToText(ctx, path.withChild(path.node.right, "right")),
      ")",
    ];
  }
  const inner = exprToTextNoParen(ctx, path);
  if (needsParens(path)) return parenthesize(ctx, inner);
  return inner;
}

function maybeRequiredSpace(
  ctx: EmitContext,
  left: Doc,
  space: Doc,
  right: Doc
) {
  if (
    !ctx.opts.noOptionalSpaces ||
    (endsWithWord(left) && startsWithWord(right))
  ) {
    return [left, space, right];
  } else {
    return [left, right];
  }
}

function exprToTextNoParen(
  ctx: EmitContext,
  path: NodePath<TextAST.Expression>
): Doc {
  const e = path.node;
  switch (e.type) {
    case "Number":
      // TODO: raw string property so users don't get their numbers auto
      // formatted to scientific notation every time
      return numToText(e.value);
    case "Identifier":
      return e.name;
    case "CallExpression":
      return primeOrCallToText(
        ctx,
        path as NodePath<TextAST.CallExpression>,
        0
      );
    case "PrimeExpression":
      return primeOrCallToText(ctx, path.withChild(e.expr, "expr"), e.order);
    case "DerivativeExpression":
      return group([
        "(d/d",
        " ",
        exprToText(ctx, path.withChild(e.variable, "variable")),
        ")",
        ctx.line,
        exprToText(ctx, path.withChild(e.expr, "expr")),
      ]);
    case "RepeatedExpression":
      return group([
        e.name,
        " ",
        e.index.name,
        "=",
        parenthesize(ctx, [
          exprToText(ctx, path.withChild(e.start, "start")),
          ctx.optionalSpace,
          "...",
          ctx.optionalSpace,
          exprToText(ctx, path.withChild(e.end, "end")),
        ]),
        ctx.line,
        exprToText(ctx, path.withChild(e.expr, "expr")),
      ]);
    case "ListExpression":
      return listToText(ctx, path as TextAST.NodePath<TextAST.ListExpression>);
    case "RangeExpression":
      return bracketize(ctx, [
        group(
          join(
            ctx.comma,
            e.startValues.map((v, i) =>
              exprToText(ctx, path.withChild(v, "startValues." + i.toString()))
            )
          )
        ),
        ctx.line,
        "...",
        ctx.line,
        group(
          join(
            ctx.comma,
            e.endValues.map((v, i) =>
              exprToText(ctx, path.withChild(v, "endValues." + i.toString()))
            )
          )
        ),
      ]);
    case "ListAccessExpression": {
      const listAccessIndex = exprToText(ctx, path.withChild(e.index, "index"));
      return [
        exprToText(ctx, path.withChild(e.expr, "expr")),
        group(
          e.index.type === "RangeExpression" ||
            e.index.type === "ListExpression"
            ? listAccessIndex
            : bracketize(ctx, listAccessIndex)
        ),
      ];
    }
    case "MemberExpression":
      return group([
        exprToText(ctx, path.withChild(e.object, "object")),
        ".",
        e.property.name,
      ]);
    case "SequenceExpression":
      return group([
        exprToText(ctx, path.withChild(e.left, "left")),
        ",",
        ctx.line,
        exprToText(ctx, path.withChild(e.right, "right")),
      ]);
    case "UpdateRule":
      return group([
        e.variable.name,
        ctx.optionalSpace,
        "->",
        ctx.optionalSpace,
        exprToText(ctx, path.withChild(e.expr, "expr")),
      ]);
    case "ListComprehension": {
      const assignments = e.assignments.map((assignment, i) =>
        assignmentExpressionToText(
          ctx,
          path.withChild(assignment, `assignments.${i}`)
        )
      );
      const intervalParameters = e.parameters.map(
        ({ identifier, open, bounds: [min, max] }, i) =>
          group([
            exprToText(ctx, path.withChild(min, `param.${i}.min`)),
            ctx.optionalSpace,
            open[0] ? "<" : "<=",
            ctx.optionalSpace,
            exprToText(ctx, path.withChild(identifier, `param.${i}.ident`)),
            ctx.optionalSpace,
            open[1] ? "<" : "<=",
            ctx.optionalSpace,
            exprToText(ctx, path.withChild(max, `param.${i}.max`)),
          ])
      );
      const unwrapped = [
        maybeRequiredSpace(
          ctx,
          exprToText(ctx, path.withChild(e.expr, "expr")),
          " ",
          "for"
        ),
        " ",
        join(ctx.comma, [...intervalParameters, ...assignments]),
      ];
      return e.bracketWrapped ? bracketize(ctx, unwrapped) : unwrapped;
    }
    case "Substitution":
      return group([
        maybeRequiredSpace(
          ctx,
          exprToText(ctx, path.withChild(e.body, "body")),
          ctx.opts.noNewlines ? " " : builders.line,
          "with"
        ),
        " ",
        join(
          ctx.comma,
          e.assignments.map((assignment, i) =>
            assignmentExpressionToText(
              ctx,
              path.withChild(assignment, `assignments.${i}`)
            )
          )
        ),
      ]);
    case "PiecewiseExpression":
      return group([
        "{",
        indent([
          ctx.softline,
          join(
            [",", ctx.line],
            e.branches.map((branch, i) =>
              piecewiseBranchToText(
                ctx,
                path.withChild(branch, `branches.${i}`)
              )
            )
          ),
        ]),
        ctx.softline,
        "}",
      ]);
    case "Restriction":
      if (e.condition === true) return "{}";
      return group([
        "{",
        indent([
          ctx.softline,
          exprToText(ctx, path.withChild(e.condition, "condition")),
        ]),
        ctx.softline,
        "}",
      ]);
    case "Or":
      // "Or" can only appear inside a restriction, which provides the group().
      // Hence we don't put a group here even though it's binary.
      return [
        exprToText(ctx, path.withChild(e.left, "left")),
        ",",
        ctx.line,
        exprToText(ctx, path.withChild(e.right, "right")),
      ];
    case "BinaryExpression": {
      const left = exprToText(ctx, path.withChild(e.left, "left"));
      const right = exprToText(ctx, path.withChild(e.right, "right"));
      if (e.op === "cross") {
        return group([
          left,
          endsWithWord(left) ? " " : ctx.optionalSpace,
          e.op,
          indent([startsWithWord(right) ? " " : ctx.optionalSpace, right]),
        ]);
      }
      return group([left, ctx.optionalSpace, e.op, indent([ctx.line, right])]);
    }
    case "ComparatorChain": {
      const g = [];
      for (let i = 0; i < e.args.length; i++) {
        g.push(
          exprToText(ctx, path.withChild(e.args[i], "arg." + i.toString()))
        );
        if (i < e.symbols.length) {
          g.push(ctx.optionalSpace, e.symbols[i], ctx.line);
        }
      }
      return group(g);
    }
    case "PrefixExpression":
      return ["-", exprToText(ctx, path.withChild(e.expr, "expr"))];
    case "Norm":
      return ["|", exprToText(ctx, path.withChild(e.expr, "expr")), "|"];
    case "PostfixExpression":
      return [exprToText(ctx, path.withChild(e.expr, "expr")), "!"];
    case "String":
      return stringToText(e.value);
    case "AssignmentExpression":
      return assignmentExpressionToText(
        ctx,
        path as NodePath<TextAST.AssignmentExpression>
      );
    default:
      e satisfies never;
      throw new Error(
        `Programming Error: Unexpected AST node ${(e as any).type}`
      );
  }
}

function piecewiseBranchToText(
  ctx: EmitContext,
  path: NodePath<TextAST.PiecewiseBranch>
): Doc {
  const branch = path.node;
  return group([
    branch.condition === null
      ? [ctx.softline]
      : [
          exprToText(ctx, path.withChild(branch.condition, "condition")),
          ":",
          ctx.line,
        ],
    indent([
      branch.consequent === null
        ? "1"
        : exprToText(ctx, path.withChild(branch.consequent, "consequent")),
    ]),
  ]);
}

function assignmentExpressionToText(
  ctx: EmitContext,
  path: NodePath<TextAST.AssignmentExpression>
): Doc {
  return group([
    path.node.variable.name,
    ctx.optionalSpace,
    "=",
    ctx.optionalSpace,
    exprToText(ctx, path.withChild(path.node.expr, "expr")),
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

function parenthesize(ctx: EmitContext, doc: Doc): Doc {
  return group(["(", indent([ctx.softline, doc]), ctx.softline, ")"]);
}

function bracketize(ctx: EmitContext, doc: Doc): Doc {
  return group(["[", indent([ctx.softline, doc]), ctx.softline, "]"]);
}

function listToText(ctx: EmitContext, path: NodePath<TextAST.ListExpression>) {
  const { values } = path.node;
  const printOneLineOnly =
    values.length > 50 || values.every(isNumericOrNumericPoint);
  const inner = values.map((v, i) =>
    exprToText(ctx, path.withChild(v, "values." + i.toString()))
  );
  return printOneLineOnly
    ? ["[", join(ctx.comma, inner), "]"]
    : bracketize(ctx, join([",", ctx.line], inner));
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

/** dir: 0 = starts with word. -1 = ends with word.
 * Assumes there's nothing with empty children. */
function startsOrEndsWithWord(dir: 0 | -1) {
  function fn(doc: Doc | undefined): boolean {
    if (!doc) return false;
    if (typeof doc === "string")
      return /[a-zA-Z0-9_]/.test(dir === 0 ? doc[0] : doc[doc.length - 1]);
    if (Array.isArray(doc)) return fn(doc.at(dir));

    switch (doc.type) {
      case DT.Fill:
        return fn(doc.parts.at(dir));
      case DT.IfBreak:
        return fn(doc.flatContents) || fn(doc.breakContents);
      case DT.Group:
        if (doc.expandedStates) {
          return doc.expandedStates.some((d) => fn(d));
        } else {
          return fn(doc.contents);
        }

      case DT.Align:
      case DT.Indent:
      case DT.Label:
      case DT.LineSuffix:
        return fn(doc.contents);

      case DT.IndentIfBreak:
      case DT.Cursor:
      case DT.Trim:
      case DT.LineSuffixBoundary:
      case DT.Line:
      case DT.BreakParent:
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
