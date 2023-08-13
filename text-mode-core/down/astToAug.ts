import { everyNonNull } from "#utils/utils";
import { ProgramAnalysis } from "../ProgramAnalysis";
import TextAST from "../TextAST";
import { Config } from "../TextModeConfig";
import { Identifier, constant } from "../aug/AugLatex";
import Aug from "../aug/AugState";
import { childLatexToAST } from "../up/augToAST";
import { DiagnosticsState } from "./diagnostics";
import { evalExpr } from "./staticEval";
import * as Hydrated from "./style/Hydrated";
import * as Default from "./style/defaults";
import { StyleValue, hydrate } from "./style/hydrate";
import * as Schema from "./style/schema";
import type { Diagnostic } from "@codemirror/lint";
import type { GrapherState } from "@desmodder/graph-state";

export class DownState extends DiagnosticsState {
  constructor(public readonly cfg: Config, diagnostics: Diagnostic[]) {
    super(diagnostics);
  }

  hasBlockingError = false;
}

export default function astToAug(
  cfg: Config,
  analysis: ProgramAnalysis
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
  const { diagnostics: parseErrors, program, mapIDstmt } = analysis;
  const diagnostics: Diagnostic[] = [...parseErrors];
  const ds = new DownState(cfg, diagnostics);
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
  fixEmptyColors(ds.cfg, state);
  return [
    {
      diagnostics,
      program,
      mapIDstmt,
    },
    ds.hasBlockingError ? null : state,
  ];
}

/**
 * Convert colors with value "" (empty string) to valid colors
 */
function fixEmptyColors(cfg: Config, state: Aug.State) {
  const colors = Object.values(cfg.colors);
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
        ...exprBase(style, stmt),
        type: "text",
        text: stmt.text,
      }
    : null;
}

function regressionToAug(
  ds: DownState,
  styleMapping: TextAST.StyleMapping | null,
  stmt: TextAST.ExprStatement,
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
  const params = (stmt.parameters?.entries ?? []).map(
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
    ...exprBase(style, stmt),
    latex: expr,
    regression: {
      isLogMode: style.logMode,
      residualVariable:
        stmt.residualVariable && identifierToAug(stmt.residualVariable),
      regressionParameters: new Map(params),
    },
    color: "",
    errorHidden: style.errorHidden,
    hidden: false,
    glesmos: false,
    fillOpacity: undefined,
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
  if (stmt.expr.type === "BinaryExpression" && stmt.expr.op === "~") {
    return regressionToAug(ds, styleMapping, stmt, stmt.expr);
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
    ...exprBase(style, stmt),
    latex: expr,
    label:
      style.label && style.label.text !== ""
        ? {
            ...style.label,
            size: style.label.size,
            angle: style.label.angle,
          }
        : undefined,
    // hidden from common
    errorHidden: style.errorHidden,
    glesmos: style.glesmos,
    fillOpacity: style.fill,
    displayEvaluationAsFraction: style.displayEvaluationAsFraction,
    slider: style.slider
      ? {
          period: style.slider.period,
          loopMode: style.slider.loopMode,
          playDirection: style.slider.reversed ? -1 : 1,
          isPlaying: style.slider.playing,
          min: style.slider.min,
          max: style.slider.max,
          step: style.slider.step,
        }
      : {},
    polarDomain:
      style.domain && isPolar
        ? {
            min: style.domain.min,
            max: style.domain.max,
          }
        : undefined,
    parametricDomain:
      style.domain && !isPolar
        ? {
            min: style.domain.min,
            max: style.domain.max,
          }
        : undefined,
    cdf:
      style.cdf &&
      !exprEvalSameDeep(style.cdf, { min: -Infinity, max: Infinity })
        ? {
            min: style.cdf.min,
            max: style.cdf.max,
          }
        : undefined,
    // TODO: vizProps
    vizProps: {},
    clickableInfo: style.onClick
      ? {
          description: style.clickDescription,
          latex: style.onClick,
        }
      : undefined,
    ...columnExpressionCommonStyle(ds, style),
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
      minStepLatex: hydrated.minStep,
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

function columnExpressionCommonStyle(
  ds: DownState,
  style: Hydrated.ColumnExpressionCommon
) {
  const res = {
    color:
      typeof style.color === "string"
        ? style.color
        : (style.color.type === "Identifier" &&
            ds.cfg.colors[style.color.symbol.replace("_", "")]) ||
          style.color,
    hidden: style.hidden,
    points:
      style.points === true
        ? {}
        : style.points === false
        ? { size: constant(0) }
        : style.points
        ? exprEvalSame(style.points.opacity, 0) ||
          exprEvalSame(style.points.size, 0)
          ? { size: constant(0) }
          : {
              opacity: style.points.opacity,
              size: style.points.size,
              style: style.points.style,
              dragMode: style.points.drag,
            }
        : undefined,
    lines:
      style.lines === true
        ? {}
        : style.lines === false
        ? { width: constant(0) }
        : style.lines
        ? exprEvalSame(style.lines.opacity, 0) ||
          exprEvalSame(style.lines.width, 0)
          ? { width: constant(0) }
          : {
              opacity: style.lines.opacity,
              width: style.lines.width,
              style: style.lines.style,
            }
        : undefined,
  };
  return res;
}

function exprBase(style: Hydrated.NonFolderBase, stmt: TextAST.Statement) {
  return {
    id: stmt.id,
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
  const base = exprBase(style, stmt);
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
    id: column.id,
    ...columnExpressionCommonStyle(ds, style),
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
    const list = childExprToAug(expr);
    return {
      ...base,
      values: [],
      latex:
        expr.type === "ListExpression"
          ? // Desmos complains about a plain list expression as latex
            // so placate it by adding zero
            {
              type: "BinaryOperator",
              name: "Add",
              left: constant(0),
              right: list,
            }
          : list,
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
    ...exprBase(style, expr),
    image_url: style.url,
    name: expr.name,
    width: style.width,
    height: style.height,
    center: style.center,
    angle: style.angle,
    opacity: style.opacity,
    foreground: style.foreground,
    draggable: style.draggable,
    clickableInfo: style.onClick
      ? {
          description: style.clickDescription,
          latex: style.onClick,
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
    id: expr.id,
    secret: style.secret,
    hidden: style.hidden,
    collapsed: style.collapsed,
    title: expr.title,
    children,
  };
}

function exprEvalSame(expr: Aug.Latex.AnyChild, expected: number) {
  const evaluated = evalExpr([], childLatexToAST(expr));
  return evaluated === null ? false : evaluated === expected;
}

function exprEvalSameDeep<T extends Record<string, Aug.Latex.AnyChild>>(
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
        assignments: expr.assignments.map(assignment),
      };
    case "Substitution":
      return {
        type: "Substitution",
        body: childExprToAug(expr.body),
        assignments: expr.assignments.map(assignment),
      };
    case "PiecewiseExpression":
      return piecewiseToAug(expr.branches);
    case "PrefixExpression":
      return {
        type: "Negative",
        arg: childExprToAug(expr.expr),
      };
    case "Norm":
      return {
        type: "Norm",
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
        type: "Factorial",
        arg: childExprToAug(expr.expr),
      };
    case "CallExpression":
      if (
        expr.callee.type === "Identifier" &&
        expr.callee.name === "f_actorial" &&
        expr.arguments.length === 1
      ) {
        return {
          type: "Factorial",
          arg: childExprToAug(expr.arguments[0]),
        };
      }
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
    case "AssignmentExpression":
      return assignment(expr);
    default:
      expr satisfies never;
      throw new Error(
        `Programming Error: Unexpected AST node ${(expr as any).type}`
      );
  }
}

function assignment(
  e: TextAST.AssignmentExpression
): Aug.Latex.AssignmentExpression {
  return {
    type: "AssignmentExpression",
    variable: identifierToAug(e.variable),
    expression: childExprToAug(e.expr),
  };
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
    expr.callee.property.type === "Identifier"
  )
    // Case e.g. L.random(5) or f(x).total()
    return {
      type: "DotAccess",
      object: childExprToAug(expr.callee.object),
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
  if (branches.length === 0) {
    return {
      type: "Piecewise",
      condition: true,
      consequent: constant(1),
      alternate: constant(NaN),
    };
  }
  return piecewiseInnerToAug(branches);
}

function piecewiseInnerToAug(
  branches: TextAST.PiecewiseBranch[]
): Aug.Latex.AnyChild {
  const firstBranch = branches[0];
  if (firstBranch === undefined) return constant(NaN);
  if (firstBranch.condition === null)
    return childExprToAug(firstBranch.consequent);
  const firstCond = childExprToAug(firstBranch.condition);
  if (
    firstCond.type !== "DoubleInequality" &&
    firstCond.type !== "Comparator"
  ) {
    throw Error("Invalid condition");
  }
  return {
    type: "Piecewise" as const,
    condition: firstCond,
    consequent:
      firstBranch.consequent === null
        ? constant(1)
        : childExprToAug(firstBranch.consequent),
    alternate: piecewiseInnerToAug(branches.slice(1)),
  };
}

function identifierToAug(expr: TextAST.Identifier) {
  return {
    type: "Identifier" as const,
    symbol: expr.name,
  };
}
