import * as TextAST from "./TextAST";
import { number } from "./TextAST";
import * as Aug from "../aug/AugState";
import { mapFromEntries } from "utils/utils";
import { autoCommandNames, autoOperatorNames } from "utils/depUtils";
import { Calc } from "globals/window";
import { StyleValue, StyleProp, hydrate } from "./style/hydrate";
import * as Hydrated from "./style/Hydrated";
import * as Default from "./style/defaults";
import * as Schema from "./style/schema";
import { error, warning } from "./diagnostics";
import { Diagnostic } from "@codemirror/lint";
import { evalExpr } from "./staticEval";
import { Identifier } from "../aug/AugLatex";

/*
 * Many functions return `[Diagnostic[], ResultValue | null]`
 *
 * The first element has errors, including warnings
 *
 * If the second element is null, then there is some unrecoverable error.
 */

export default function astToAug(
  program: TextAST.Program
): [Diagnostic[], Aug.State | null] {
  const state: Aug.State = {
    version: 9,
    settings: {
      viewport: {
        xmin: -10,
        xmax: 10,
        ymin: -10,
        ymax: 10,
      },
    },
    expressions: {
      list: [],
    },
  };
  const allErrors: Diagnostic[] = [];
  let hasBlockingError = false;
  for (let stmt of program) {
    // TODO: throw if there are multiple settings expressions
    const [errors, stmtAug] = statementToAug(state, stmt);
    allErrors.push(...errors);
    if (stmtAug === null) {
      hasBlockingError = true;
    } else if (stmtAug.type === "settings") {
      state.settings = { ...state.settings, ...stmtAug.settings };
    } else {
      state.expressions.list.push(stmtAug);
    }
  }
  fixEmptyIDs(state);
  fixEmptyColors(state);
  return [allErrors, hasBlockingError ? null : state];
}

/**
 * Convert IDs with value "" (empty string) to valid collision-free IDs
 */
function fixEmptyIDs(state: Aug.State) {
  let maxNumericID = Math.max(
    ...state.expressions.list.map((item) => {
      const p = parseInt(item.id);
      return item.id === p.toString() ? p : 0;
    })
  );
  forEachExpr(state.expressions.list, (item) => {
    if (item.id === "") {
      maxNumericID++;
      item.id = maxNumericID.toString();
    }
  });
}

/**
 * Convert colors with value "" (empty string) to valid colors
 */
function fixEmptyColors(state: Aug.State) {
  // TODO: use Calc.colors instead of fixed colors
  const colors = ["#c74440", "#2d70b3", "#388c46", "#6042a6", "#000000"];
  // colorIndex will be the index of the next color filled
  let colorIndex = 0;
  forEachExpr(state.expressions.list, (item) => {
    if ("color" in item) {
      if (item.color === "") {
        item.color = colors[colorIndex];
        colorIndex = (colorIndex + 1) % colors.length;
      } else if (
        typeof item.color === "string" &&
        colors.includes(item.color)
      ) {
        colorIndex = (colors.indexOf(item.color) + 1) % colors.length;
      }
    }
  });
}

function forEachExpr(
  items: Aug.ItemAug[],
  func: (e: Aug.ItemAug | Aug.TableColumnAug) => void
) {
  items.forEach((item) => {
    func(item);
    if (item.type === "table") {
      item.columns.forEach(func);
    } else if (item.type === "folder") {
      forEachExpr(item.children, func);
    }
  });
}

/**
 * Convert a statement to its Aug form. Null represents inserting nothing.
 * The `state` parameter may be modified
 */
function statementToAug(
  state: Aug.State,
  stmt: TextAST.Statement
): [
  Diagnostic[],
  Aug.ItemAug | { type: "settings"; settings: Hydrated.Settings } | null
] {
  switch (stmt.type) {
    case "Settings":
      return settingsToAug(stmt.style);
    case "ShowStatement":
      return expressionToAug(stmt.style, childExprToAug(stmt.expr));
    case "LetStatement":
      return expressionToAug(stmt.style, {
        type: "Comparator",
        operator: "=",
        left: identifierToAug(stmt.identifier),
        right: childExprToAug(stmt.expr),
      });
    case "FunctionDefinition":
      return expressionToAug(stmt.style, {
        type: "Comparator",
        operator: "=",
        left: {
          type: "FunctionCall",
          callee: identifierToAug(stmt.callee),
          args: stmt.params.map(identifierToAug),
        },
        right: childExprToAug(stmt.expr),
      });
    case "RegressionStatement":
      return expressionToAug(
        stmt.style,
        {
          type: "Regression",
          left: childExprToAug(stmt.left),
          right: childExprToAug(stmt.right),
        },
        stmt
      );
    case "Table":
      return tableToAug(stmt.style, stmt.columns);
    case "Image":
      return imageToAug(stmt.style, stmt);
    case "Text":
      return textToAug(stmt.style, stmt);
    case "Folder":
      return folderToAug(stmt.style, stmt, state);
  }
}

function textToAug(
  styleMapping: TextAST.StyleMapping,
  stmt: TextAST.Text
): [Diagnostic[], Aug.TextAug | null] {
  const [errors, style] = hydrate(
    styleMapping,
    Default.text,
    Schema.text,
    "text"
  );
  return [
    errors,
    style !== null
      ? {
          ...exprBase(style),
          type: "text",
          text: stmt.text,
        }
      : null,
  ];
}

function expressionToAug(
  styleMapping: TextAST.StyleMapping,
  expr: Aug.Latex.AnyRootOrChild,
  regressionNode?: TextAST.RegressionStatement
): [Diagnostic[], Aug.ExpressionAug | null] {
  // is the expr polar for the purposes of domain?
  const isPolar =
    expr.type === "Comparator" &&
    expr.left.type === "Identifier" &&
    expr.left.symbol === "r";

  // TODO: split this based on regression, function definition, etc.
  const [errors, style] = hydrate(
    styleMapping,
    isPolar ? Default.polarExpression : Default.nonpolarExpression,
    Schema.expression,
    "expression"
  );
  if (style === null) return [errors, null];
  const [regressionErrors, regMapEntries] =
    regressionMapEntries(regressionNode);
  errors.push(...regressionErrors);
  if (regMapEntries === null) return [errors, null];
  const regression = regressionNode?.body && {
    isLogMode: style.logModeRegression,
    residualVariable: identifierToAug(regressionNode.body.residualVariable),
    regressionParameters: mapFromEntries(regMapEntries),
  };
  const res: Aug.ExpressionAug = {
    type: "expression",
    // Use empty string as an ID placeholder. These will get filled in at the end
    ...exprBase(style),
    latex: expr,
    label:
      style.label && style.label.text !== ""
        ? {
            ...style.label,
            size: childExprToAug(style.label.size),
            angle: childExprToAug(style.label.angle),
          }
        : undefined,
    // hidden from common
    errorHidden: style.errorHidden,
    glesmos: style.glesmos,
    fillOpacity: childExprToAug(style.fill),
    regression: regression,
    displayEvaluationAsFraction: style.displayEvaluationAsFraction,
    // TODO slider
    slider: {},
    polarDomain:
      style.domain &&
      isPolar &&
      !exprEvalSameDeep(style.domain, { min: 0, max: 12 * Math.PI })
        ? {
            min: childExprToAug(style.domain.min),
            max: childExprToAug(style.domain.max),
          }
        : undefined,
    parametricDomain:
      style.domain &&
      !isPolar &&
      !exprEvalSameDeep(style.domain, { min: 0, max: 1 })
        ? {
            min: childExprToAug(style.domain.min),
            max: childExprToAug(style.domain.max),
          }
        : undefined,
    cdf:
      style.cdf &&
      !exprEvalSameDeep(style.cdf, { min: -Infinity, max: Infinity })
        ? {
            min: childExprToAug(style.cdf.min),
            max: childExprToAug(style.cdf.max),
          }
        : undefined,
    // TODO: vizProps
    vizProps: {},
    clickableInfo: style.onClick
      ? {
          description: style.clickDescription,
          latex: childExprToAug(style.onClick),
        }
      : undefined,
    ...columnExpressionCommonStyle(style),
  };
  return [errors, res];
}

function regressionMapEntries(
  regression?: TextAST.RegressionStatement
): [Diagnostic[], null | [Identifier, number][]] {
  if (regression?.body === undefined) return [[], []];
  const errors: Diagnostic[] = [];
  const res = [...regression.body.regressionParameters.entries()].map(
    ([key, value]): [Identifier, number] | null => {
      const evaluated = evalExpr(value);
      if (typeof evaluated !== "number") {
        errors.push(
          error(
            `Expected regression value ${key} to be a number, but got ${typeof evaluated}`,
            regression.pos
          )
        );
        return null;
      }
      return [identifierToAug(key), evaluated];
    }
  );
  return [errors, everyNonNull(res) ? res : null];
}

function settingsToAug(
  styleMapping: TextAST.StyleMapping
): [Diagnostic[], null | { type: "settings"; settings: Hydrated.Settings }] {
  const [errors, res] = hydrate(
    styleMapping,
    Default.settings,
    Schema.settings,
    "settings"
  );
  return [errors, res !== null ? { type: "settings", settings: res } : null];
}

function columnExpressionCommonStyle(style: Hydrated.ColumnExpressionCommon) {
  const res = {
    color:
      typeof style.color === "string"
        ? style.color
        : Calc.colors[style.color.name] ?? identifierToAug(style.color),
    hidden: style.hidden,
    points:
      style.points &&
      !exprEvalSame(style.points.opacity, 0) &&
      !exprEvalSame(style.points.size, 0)
        ? {
            opacity: childExprToAug(style.points.opacity),
            size: childExprToAug(style.points.size),
            style: style.points.style,
            dragMode: style.points.drag,
          }
        : undefined,
    lines:
      style.lines &&
      !exprEvalSame(style.lines.opacity, 0) &&
      !exprEvalSame(style.lines.width, 0)
        ? {
            opacity: childExprToAug(style.lines.opacity),
            width: childExprToAug(style.lines.width),
            style: style.lines.style,
          }
        : undefined,
  };
  return res;
}

function exprBase(style: Hydrated.NonFolderBase) {
  return {
    id: style.id,
    secret: style.secret,
    pinned: style.pinned,
  };
}

function tableToAug(
  styleMapping: TextAST.StyleMapping,
  columns: TextAST.TableColumn[]
): [Diagnostic[], Aug.TableAug | null] {
  const results = columns.map(tableColumnToAug);
  const tableColumnErrors = results
    .map((e) => e[0])
    .reduce((a, b) => [...a, ...b], []);
  const resultColumns = results.map((e) => e[1]);
  if (!everyNonNull(resultColumns)) return [tableColumnErrors, null];
  const [hydrateErrors, style] = hydrate(
    styleMapping,
    Default.table,
    Schema.table,
    "table"
  );
  const errors = [...tableColumnErrors, ...hydrateErrors];
  if (style === null) return [errors, null];
  return [
    errors,
    {
      type: "table",
      ...exprBase(style),
      columns: resultColumns,
    },
  ];
}

function tableColumnToAug(
  column: TextAST.TableColumn
): [Diagnostic[], Aug.TableColumnAug | null] {
  const [errors, style] = hydrate(
    column.style,
    Default.column,
    Schema.column,
    "column"
  );
  if (style === null) return [errors, null];
  const expr = column.expr;
  const base = {
    type: "column" as const,
    id: style.id,
    ...columnExpressionCommonStyle(style),
  };
  if (expr.type === "ListExpression") {
    const values = expr.values.map(childExprToAug);
    return [
      errors,
      {
        ...base,
        values,
        latex:
          column.type === "LetStatement"
            ? childExprToAug(column.identifier)
            : undefined,
      },
    ];
  } else if (column.type === "LetStatement") {
    return [
      [
        error(
          "Table assignment can only assign from a ListExpression",
          column.pos
        ),
      ],
      null,
    ];
  } else {
    return [
      errors,
      {
        ...base,
        values: [],
        latex: childExprToAug(expr),
      },
    ];
  }
}

function imageToAug(
  styleMapping: TextAST.StyleMapping,
  expr: TextAST.Image
): [Diagnostic[], Aug.ImageAug | null] {
  const [errors, style] = hydrate(
    styleMapping,
    Default.image,
    Schema.image,
    "image"
  );
  if (style === null) return [errors, null];
  const res: Aug.ImageAug = {
    type: "image",
    ...exprBase(style),
    image_url: expr.url,
    name: expr.name,
    width: childExprToAug(style.width),
    height: childExprToAug(style.height),
    center: childExprToAug(style.center),
    angle: childExprToAug(style.angle),
    opacity: childExprToAug(style.opacity),
    foreground: style.foreground,
    draggable: style.draggable,
    clickableInfo: style.onClick
      ? {
          description: style.clickDescription,
          latex: childExprToAug(style.onClick),
          hoveredImage: style.hoveredImage,
          depressedImage: style.depressedImage,
        }
      : undefined,
  };
  return [errors, res];
}

function folderToAug(
  styleMapping: TextAST.StyleMapping,
  expr: TextAST.Folder,
  state: Aug.State
): [Diagnostic[], Aug.FolderAug | null] {
  const children: Aug.NonFolderAug[] = [];
  const allErrors: Diagnostic[] = [];
  for (let child of expr.children) {
    const [errors, stmtAug] = statementToAug(state, child);
    allErrors.push(...errors);
    if (stmtAug !== null) {
      if (stmtAug.type === "folder") {
        return [
          [error("Nested folders are not yet implemented", child.pos)],
          null,
        ];
      } else if (stmtAug.type === "settings") {
        return [[error("Settings may not be in a folder", child.pos)], null];
      } else {
        children.push(stmtAug);
      }
    }
  }
  const [styleErrors, style] = hydrate(
    styleMapping,
    Default.folder,
    Schema.folder,
    "folder"
  );
  allErrors.push(...styleErrors);
  if (style === null) return [allErrors, null];
  const res: Aug.FolderAug = {
    type: "folder",
    id: style.id,
    secret: style.secret,
    hidden: style.hidden,
    collapsed: style.collapsed,
    title: expr.title,
    children: children,
  };
  return [allErrors, res];
}

function exprEvalSame(expr: TextAST.Expression, expected: number) {
  try {
    const evaluated = evalExpr(expr);
    return evaluated === expected;
  } catch {
    // the expr can't be statically evaluated currently
    return false;
  }
}

function exprEvalSameDeep<T extends { [key: string]: TextAST.Expression }>(
  exprMap: T,
  expected: { [K in keyof T]: number }
) {
  for (const key in expected)
    if (!exprEvalSame(exprMap[key], expected[key])) return false;
  return true;
}

function childExprToAug(
  expr: StyleValue | TextAST.Expression
): Aug.Latex.AnyChild {
  if (expr.type === "StyleValue") throw "Unexpected style value";
  switch (expr.type) {
    case "Number":
      return constant(expr.value);
    case "Identifier":
      return identifierToAug(expr);
    case "String":
      throw "Unexpected string in expression";
    case "RepeatedExpression":
      if (expr.name === "integral") {
        return {
          type: "Integral",
          differential: identifierToAug(expr.index),
          start: childExprToAug(expr.start),
          end: childExprToAug(expr.end),
          integrand: childExprToAug(expr.expr),
        };
      } else {
        return {
          type: "RepeatedOperator",
          name: expr.name === "sum" ? "Sum" : "Product",
          index: identifierToAug(expr.index),
          start: childExprToAug(expr.start),
          end: childExprToAug(expr.end),
          expression: childExprToAug(expr.expr),
        };
      }
    case "RangeExpression":
      return {
        type: "Range",
        start: expr.startValues.map(childExprToAug),
        end: expr.endValues.map(childExprToAug),
      };
    case "ListExpression":
      return {
        type: "List",
        args: expr.values.map(childExprToAug),
      };
    case "ListComprehension":
      return {
        type: "ListComprehension",
        expr: childExprToAug(expr.expr),
        assignments: expr.assignments.map((assignment) => ({
          type: "AssignmentExpression",
          variable: identifierToAug(assignment.variable),
          expression: childExprToAug(assignment.expr),
        })),
      };
    case "PiecewiseExpression":
      return piecewiseToAug(expr.branches);
    case "PrefixExpression":
      return {
        type: "Negative",
        arg: childExprToAug(expr.expr),
      };
    case "UpdateRule":
      if (expr.variable.type !== "Identifier") {
        throw "Update rule may only assign to a variable";
      }
      return {
        type: "UpdateRule",
        variable: identifierToAug(expr.variable),
        expression: childExprToAug(expr.expression),
      };
    case "SequenceExpression":
      const seqRight = childExprToAug(expr.right);
      return {
        type: "Seq",
        parenWrapped: expr.parenWrapped,
        args: [
          childExprToAug(expr.left),
          ...(seqRight.type === "Seq" && !seqRight.parenWrapped
            ? seqRight.args
            : [seqRight]),
        ],
      };
    case "MemberExpression":
      return ["x", "y"].includes(expr.property.name)
        ? {
            type: "OrderedPairAccess",
            point: childExprToAug(expr.object),
            index: expr.property.name as "x" | "y",
          }
        : {
            type: "DotAccess",
            object: childExprToAug(expr.object),
            property: identifierToAug(expr.property),
          };
    case "ListAccessExpression":
      return {
        type: "ListAccess",
        list: childExprToAug(expr.expr),
        index: childExprToAug(expr.index),
      };
    case "BinaryExpression":
      return binopMap[expr.op] !== undefined
        ? {
            type: "BinaryOperator",
            name: binopMap[expr.op] as any,
            left: childExprToAug(expr.left),
            right: childExprToAug(expr.right),
          }
        : {
            type: "Comparator",
            operator: expr.op as any,
            left: childExprToAug(expr.left),
            right: childExprToAug(expr.right),
          };
    case "PostfixExpression":
      return {
        type: "FunctionCall",
        callee: {
          type: "Identifier",
          symbol: "factorial",
        },
        args: [childExprToAug(expr.expr)],
      };
    case "CallExpression":
      if (expr.callee.type === "Identifier")
        return {
          type: "FunctionCall",
          callee: identifierToAug(expr.callee),
          args: expr.arguments.map(childExprToAug),
        };
      else if (
        expr.callee.type === "MemberExpression" &&
        expr.callee.object.type === "Identifier" &&
        expr.callee.property.type === "Identifier"
      )
        // Case e.g. L.random(5)
        return {
          type: "DotAccess",
          object: identifierToAug(expr.callee.object),
          property: {
            type: "FunctionCall",
            callee: identifierToAug(expr.callee.property),
            args: expr.arguments.map(childExprToAug),
          },
        };
      throw "Invalid callee";
  }
}

const binopMap = {
  "+": "Add",
  "-": "Subtract",
  "*": "Multiply",
  "/": "Divide",
  "^": "Exponent",
} as { [key: string]: string };

function piecewiseToAug(
  branches: TextAST.PiecewiseBranch[]
): Aug.Latex.AnyChild {
  const res = piecewiseInnerToAug(branches);
  if (res.type === "Constant" && res.value === 1) {
    return {
      type: "Piecewise",
      condition: true,
      consequent: constant(1),
      alternate: constant(NaN),
    };
  } else {
    return res;
  }
}

function piecewiseInnerToAug(
  branches: TextAST.PiecewiseBranch[]
): Aug.Latex.AnyChild {
  const firstBranch = branches[0];
  if (firstBranch === undefined) return constant(NaN);
  const firstCond = childExprToAug(firstBranch.condition);
  if (firstCond.type === "Identifier" && firstCond.symbol === "e_lse") {
    // Rudimentary variable inlining
    return childExprToAug(firstBranch.consequent);
  }
  if (
    firstCond.type !== "DoubleInequality" &&
    firstCond.type !== "Comparator"
  ) {
    throw "Invalid condition";
  }
  return {
    type: "Piecewise" as const,
    condition: firstCond,
    consequent: childExprToAug(firstBranch.consequent),
    alternate: piecewiseToAug(branches.slice(1)),
  };
}

/**
 * Fragile names. Subset of those given by the following script:
 *
 *     const {BuiltInTable, CompilerFunctionTable} = require("core/math/ir/builtin-table")
 *     const builtins = Object.keys({...BuiltInTable, ...CompilerFunctionTable})
 *     const {getAutoOperators, getAutoCommands}  = require("main/mathquill-operators")
 *     const operators = new Set((getAutoOperators()+" "+getAutoCommands()).split(/[ |]/));
 *     console.log(builtins.filter(name => !operators.has(name)))
 */
const fragileNames = [
  "polyGamma",
  "argmin",
  "argmax",
  "uniquePerm",
  "rtxsqpone",
  "rtxsqmone",
  "hypot",
];

const dontSubscriptIdentifiers = new Set([
  ...autoOperatorNames.split(" ").map((e) => e.split("|")[0]),
  ...autoCommandNames.split(" "),
  ...fragileNames,
]);

function identifierToAug(expr: TextAST.Identifier) {
  return {
    type: "Identifier" as const,
    symbol:
      expr.name.length > 1 && !dontSubscriptIdentifiers.has(expr.name)
        ? expr.name[0] + "_" + expr.name.substring(1)
        : expr.name,
  };
}

function constant(value: number) {
  return { type: "Constant" as const, value };
}

function everyNonNull<T>(arr: (T | null)[]): arr is T[] {
  return arr.every((e) => e !== null);
}
