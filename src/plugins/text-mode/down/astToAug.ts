import { ProgramAnalysis } from "../LanguageServer";
import { Identifier } from "../aug/AugLatex";
import Aug from "../aug/AugState";
import TextAST, { number } from "./TextAST";
import { DiagnosticsState } from "./diagnostics";
import { evalExpr } from "./staticEval";
import * as Hydrated from "./style/Hydrated";
import * as Default from "./style/defaults";
import { StyleValue, hydrate } from "./style/hydrate";
import * as Schema from "./style/schema";
import { Diagnostic } from "@codemirror/lint";
import { GrapherState } from "@desmodder/graph-state";
import { Calc } from "globals/window";
import { autoCommandNames, autoOperatorNames } from "utils/depUtils";
import { everyNonNull } from "utils/utils";

export class DownState extends DiagnosticsState {
  mapIDstmt: Record<string, TextAST.Statement> = {};
  maxCustomID = 0;
  hasBlockingError = false;

  generateID() {
    // TODO: incremental updates, so later IDs don't get destroyed when a new
    // expression is added in the middle of the code
    return `__dsm-auto-${++this.maxCustomID}`;
  }

  ensureID(tryID: string, stmt: TextAST.Statement) {
    const id = tryID === "" ? this.generateID() : tryID;
    this.mapIDstmt[id] = stmt;
    return id;
  }
}

export default function astToAug(
  parseErrors: Diagnostic[],
  program: TextAST.Program
): [ProgramAnalysis, Aug.State | null] {
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
  const diagnostics: Diagnostic[] = [...parseErrors];
  const ds = new DownState(diagnostics);
  for (const stmt of program.children) {
    // TODO: throw if there are multiple settings expressions
    const stmtAug = statementToAug(ds, state, stmt);
    if (stmtAug === null) {
      ds.hasBlockingError = true;
    } else if (stmtAug.type === "settings") {
      state.settings = { ...state.settings, ...stmtAug.settings };
    } else if (stmtAug.type === "ticker") {
      if (state.expressions.ticker !== undefined)
        ds.pushWarning("Duplicate ticker, ignoring this one", stmt.pos);
      state.expressions.ticker = stmtAug.ticker;
    } else {
      state.expressions.list.push(stmtAug);
    }
  }
  fixEmptyColors(state);
  return [
    {
      diagnostics,
      ast: program,
      mapIDstmt: ds.mapIDstmt,
    },
    ds.hasBlockingError ? null : state,
  ];
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
  ds: DownState,
  state: Aug.State,
  stmt: TextAST.Statement
):
  | Aug.ItemAug
  | { type: "settings"; settings: GrapherState }
  | { type: "ticker"; ticker: Aug.TickerAug }
  | null {
  switch (stmt.type) {
    case "Settings":
      return settingsToAug(ds, stmt.style);
    case "Ticker":
      return tickerToAug(ds, stmt.style, stmt.handler);
    case "ExprStatement":
      return expressionToAug(ds, stmt.style, stmt);
    case "Table":
      return tableToAug(ds, stmt.style, stmt);
    case "Image":
      return imageToAug(ds, stmt.style, stmt);
    case "Text":
      return textToAug(ds, stmt.style, stmt);
    case "Folder":
      return folderToAug(ds, stmt.style, stmt, state);
  }
}

function textToAug(
  ds: DownState,
  styleMapping: TextAST.StyleMapping | null,
  stmt: TextAST.Text
): Aug.TextAug | null {
  const style = hydrate(ds, styleMapping, Default.text, Schema.text, "text");
  return style !== null
    ? {
        ...exprBase(ds, style, stmt),
        type: "text",
        text: stmt.text,
      }
    : null;
}

function regressionToAug(
  ds: DownState,
  styleMapping: TextAST.StyleMapping | null,
  stmt: TextAST.ExprStatement,
  regressionData: TextAST.RegressionData,
  exprAST: TextAST.BinaryExpression
): Aug.ExpressionAug | null {
  const expr: Aug.Latex.Regression = {
    type: "Regression",
    left: childExprToAug(exprAST.left),
    right: childExprToAug(exprAST.right),
  };
  const style = hydrate(
    ds,
    styleMapping,
    Default.regression,
    Schema.regression,
    "regression"
  );
  if (style === null) return null;
  const params = regressionData.parameters.entries.map(
    ({ variable, value }): [Identifier, number] | null => {
      const evaluated = evalExpr(ds.diagnostics, value);
      if (typeof evaluated !== "number") {
        ds.pushError(
          `Expected regression parameter to evaluate to number, but got ${typeof evaluated}`,
          value.pos
        );
        return null;
      }
      return [identifierToAug(variable), evaluated];
    }
  );
  if (!everyNonNull(params)) return null;
  return {
    type: "expression",
    ...exprBase(ds, style, stmt),
    latex: expr,
    regression: {
      isLogMode: style.logMode,
      residualVariable:
        regressionData.residualVariable &&
        identifierToAug(regressionData.residualVariable),
      regressionParameters: new Map(params),
    },
    color: "",
    errorHidden: style.errorHidden,
    hidden: false,
    glesmos: false,
    fillOpacity: constant(0),
    displayEvaluationAsFraction: false,
    slider: {},
    vizProps: {},
  };
}

function expressionToAug(
  ds: DownState,
  styleMapping: TextAST.StyleMapping | null,
  stmt: TextAST.ExprStatement
): Aug.ExpressionAug | null {
  if (
    stmt.expr.type === "BinaryExpression" &&
    stmt.expr.op === "~" &&
    stmt.regression !== undefined
  ) {
    return regressionToAug(ds, styleMapping, stmt, stmt.regression, stmt.expr);
  }
  const expr = childExprToAug(stmt.expr);
  // is the expr polar for the purposes of domain?
  const isPolar =
    expr.type === "Comparator" &&
    expr.left.type === "Identifier" &&
    expr.left.symbol === "r";

  // TODO: split hydration based on lines, function definition, etc.
  const style = hydrate(
    ds,
    styleMapping,
    isPolar ? Default.polarExpression : Default.nonpolarExpression,
    Schema.expression,
    "expression"
  );
  if (style === null) return null;
  return {
    type: "expression",
    // Use empty string as an ID placeholder. These will get filled in at the end
    ...exprBase(ds, style, stmt),
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
    displayEvaluationAsFraction: style.displayEvaluationAsFraction,
    slider: style.slider
      ? {
          period: style.slider.period,
          loopMode: style.slider.loopMode,
          playDirection: style.slider.reversed ? -1 : 1,
          isPlaying: style.slider.playing,
          min: childExprToAug(style.slider.min),
          max: childExprToAug(style.slider.max),
          step: childExprToAug(style.slider.step),
        }
      : {},
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
}

function tickerToAug(
  ds: DownState,
  styleMapping: TextAST.StyleMapping | null,
  handler: TextAST.Expression
): null | { type: "ticker"; ticker: Aug.TickerAug } {
  const hydrated = hydrate(
    ds,
    styleMapping,
    Default.ticker,
    Schema.ticker,
    "ticker"
  );
  if (hydrated === null) return null;
  return {
    type: "ticker",
    ticker: {
      handlerLatex: childExprToAug(handler),
      minStepLatex: childExprToAug(hydrated.minStep),
      playing: hydrated.playing,
    },
  };
}

function settingsToAug(
  ds: DownState,
  styleMapping: TextAST.StyleMapping | null
): null | { type: "settings"; settings: GrapherState } {
  const hydrated = hydrate(
    ds,
    styleMapping,
    Default.settings,
    Schema.settings,
    "settings"
  );
  if (hydrated === null) return null;
  const res: GrapherState = {
    ...hydrated,
    userLockedViewport: hydrated.lockViewport,
  };
  delete (res as any).lockViewport;
  return { type: "settings", settings: res };
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

function exprBase(
  ds: DownState,
  style: Hydrated.NonFolderBase,
  stmt: TextAST.Statement
) {
  return {
    id: ds.ensureID(style.id, stmt),
    secret: style.secret,
    pinned: style.pinned,
  };
}

function tableToAug(
  ds: DownState,
  styleMapping: TextAST.StyleMapping | null,
  stmt: TextAST.Table
): Aug.TableAug | null {
  const style = hydrate(ds, styleMapping, Default.table, Schema.table, "table");
  if (style === null) return null;
  const base = exprBase(ds, style, stmt);
  const resultColumns = stmt.columns.map((col) => tableColumnToAug(ds, col));
  if (!everyNonNull(resultColumns)) return null;
  return {
    type: "table",
    ...base,
    columns: resultColumns,
  };
}

function tableColumnToAug(
  ds: DownState,
  column: TextAST.TableColumn
): Aug.TableColumnAug | null {
  const style = hydrate(
    ds,
    column.style,
    Default.column,
    Schema.column,
    "column"
  );
  if (style === null) return null;
  const expr = column.expr;
  const base = {
    type: "column" as const,
    id: ds.ensureID(style.id, column),
    ...columnExpressionCommonStyle(style),
  };

  if (expr.type === "BinaryExpression" && expr.op === "=") {
    if (expr.left.type !== "Identifier") {
      ds.pushError(
        `Expected column to assign to an identifier, but got ${expr.left.type}`,
        expr.left.pos
      );
      return null;
    } else if (expr.right.type !== "ListExpression") {
      ds.pushError(
        `Expected table assignment to assign from a ListExpression, but got ${expr.right.type}`,
        expr.right.pos
      );
      return null;
    } else {
      return {
        ...base,
        values: expr.right.values.map(childExprToAug),
        latex: childExprToAug(expr.left),
      };
    }
  } else {
    return {
      ...base,
      values: [],
      latex: childExprToAug(
        expr.type === "ListExpression"
          ? // Desmos complains about a plain list expression as latex
            // so placate it by adding zero
            {
              type: "BinaryExpression",
              op: "+",
              left: number(0),
              right: expr,
            }
          : expr
      ),
    };
  }
}

function imageToAug(
  ds: DownState,
  styleMapping: TextAST.StyleMapping | null,
  expr: TextAST.Image
): Aug.ImageAug | null {
  const style = hydrate(ds, styleMapping, Default.image, Schema.image, "image");
  if (style === null) return null;
  const res: Aug.ImageAug = {
    type: "image",
    ...exprBase(ds, style, expr),
    image_url: style.url,
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
  return res;
}

function folderToAug(
  ds: DownState,
  styleMapping: TextAST.StyleMapping | null,
  expr: TextAST.Folder,
  state: Aug.State
): Aug.FolderAug | null {
  const children: Aug.NonFolderAug[] = [];
  const style = hydrate(
    ds,
    styleMapping,
    Default.folder,
    Schema.folder,
    "folder"
  );
  if (style === null) return null;
  const id = ds.ensureID(style.id ?? "", expr);
  for (const child of expr.children) {
    const stmtAug = statementToAug(ds, state, child);
    if (stmtAug !== null) {
      if (stmtAug.type === "folder") {
        ds.pushError("Nested folders are not yet implemented", child.pos);
        return null;
      } else if (stmtAug.type === "settings") {
        ds.pushError("Settings may not be in a folder", child.pos);
        return null;
      } else if (stmtAug.type === "ticker") {
        ds.pushError("Ticker may not be in a folder", child.pos);
        return null;
      } else {
        children.push(stmtAug);
      }
    }
  }
  return {
    type: "folder",
    id,
    secret: style.secret,
    hidden: style.hidden,
    collapsed: style.collapsed,
    title: expr.title,
    children,
  };
}

function exprEvalSame(expr: TextAST.Expression, expected: number) {
  const evaluated = evalExpr([], expr);
  return evaluated === null ? false : evaluated === expected;
}

function exprEvalSameDeep<T extends Record<string, TextAST.Expression>>(
  exprMap: T,
  expected: { [K in keyof T]: number }
) {
  for (const key in expected)
    if (!exprEvalSame(exprMap[key], expected[key])) return false;
  return true;
}

export function childExprToAug(
  expr: StyleValue | TextAST.Expression
): Aug.Latex.AnyChild {
  if (expr.type === "StyleValue") throw Error("Unexpected style value");
  switch (expr.type) {
    case "Number":
      return constant(expr.value);
    case "Identifier":
      return identifierToAug(expr);
    case "String":
      throw Error("Unexpected string in expression");
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
        throw Error("Update rule may only assign to a variable");
      }
      return {
        type: "UpdateRule",
        variable: identifierToAug(expr.variable),
        expression: childExprToAug(expr.expr),
      };
    case "SequenceExpression": {
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
    }
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
    case "DoubleInequality":
      return {
        type: "DoubleInequality",
        left: childExprToAug(expr.left),
        leftOperator: expr.leftOp,
        middle: childExprToAug(expr.middle),
        rightOperator: expr.rightOp,
        right: childExprToAug(expr.right),
      };
    case "BinaryExpression":
      if (expr.op === "~")
        throw Error("Programming Error: `~` in child BinaryExpression");
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
      return callExpressionToAug(expr);
    case "PrimeExpression": {
      const child = callExpressionToAug(expr.expr);
      if (child.type === "DotAccess") {
        throw new Error("Cannot use prime notation together with dot notation");
      }
      return {
        type: "Prime",
        arg: child,
        order: expr.order,
      };
    }
    case "DerivativeExpression":
      return {
        type: "Derivative",
        arg: childExprToAug(expr.expr),
        variable: identifierToAug(expr.variable),
      };
  }
}

function callExpressionToAug(
  expr: TextAST.CallExpression
): Aug.Latex.FunctionCall | Aug.Latex.DotAccess {
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
  throw Error("Programming Error: Invalid callee");
}

const binopMap: Record<string, string> = {
  "+": "Add",
  "-": "Subtract",
  "*": "Multiply",
  "/": "Divide",
  "^": "Exponent",
};

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
    throw Error("Invalid condition");
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
  "index",
  "dt",
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
