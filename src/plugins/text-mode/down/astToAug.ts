import * as TextAST from "./TextAST";
import * as Aug from "../aug/AugState";
import { mapFromEntries } from "utils/utils";
import { autoCommandNames, autoOperatorNames } from "utils/depUtils";
import { Calc } from "globals/window";
import { StyleValue, hydrate } from "./style/hydrate";
import * as Hydrated from "./style/Hydrated";
import * as Default from "./style/defaults";
import * as Schema from "./style/schema";
import { DiagnosticsState } from "./diagnostics";
import { Diagnostic } from "@codemirror/lint";
import { evalExpr } from "./staticEval";
import { Identifier } from "../aug/AugLatex";
import { everyNonNull } from "utils/utils";
import { MapIDPosition } from "../modify/mapIDPosition";

export class DownState extends DiagnosticsState {
  public idMap: MapIDPosition = {};
  maxCustomID = 0;
  hasBlockingError = false;

  constructor(diagnostics: Diagnostic[]) {
    super(diagnostics);
  }

  generateID() {
    // TODO: incremental updates, so later IDs don't get destroyed when a new
    // expression is added in the middle of the code
    return `__dsm-auto-${++this.maxCustomID}`;
  }

  ensureIDAndMarkPos(tryID: string, stmt: { pos?: TextAST.Pos }) {
    const id = tryID === "" ? this.generateID() : tryID;
    this.idMap[id] = stmt.pos!.from;
    return id;
  }
}

export default function astToAug(
  parseErrors: Diagnostic[],
  program: TextAST.Program | null
): [Diagnostic[], Aug.State | null, MapIDPosition] {
  if (program === null) return [parseErrors, null, {}];
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
  let hasBlockingError = false;
  for (let stmt of program) {
    // TODO: throw if there are multiple settings expressions
    const stmtAug = statementToAug(ds, state, stmt);
    if (stmtAug === null) {
      ds.hasBlockingError = true;
    } else if (stmtAug.type === "settings") {
      state.settings = { ...state.settings, ...stmtAug.settings };
    } else {
      state.expressions.list.push(stmtAug);
    }
  }
  fixEmptyColors(state);
  return ds.hasBlockingError
    ? [diagnostics, null, {}]
    : [diagnostics, state, ds.idMap];
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
): Aug.ItemAug | { type: "settings"; settings: Hydrated.Settings } | null {
  switch (stmt.type) {
    case "Settings":
      return settingsToAug(ds, stmt.style);
    case "ShowStatement":
      return expressionToAug(ds, stmt.style, childExprToAug(stmt.expr), stmt);
    case "LetStatement":
      return expressionToAug(
        ds,
        stmt.style,
        {
          type: "Comparator",
          operator: "=",
          left: identifierToAug(stmt.identifier),
          right: childExprToAug(stmt.expr),
        },
        stmt
      );
    case "FunctionDefinition":
      return expressionToAug(
        ds,
        stmt.style,
        {
          type: "Comparator",
          operator: "=",
          left: {
            type: "FunctionCall",
            callee: identifierToAug(stmt.callee),
            args: stmt.params.map(identifierToAug),
          },
          right: childExprToAug(stmt.expr),
        },
        stmt
      );
    case "RegressionStatement":
      return expressionToAug(
        ds,
        stmt.style,
        {
          type: "Regression",
          left: childExprToAug(stmt.left),
          right: childExprToAug(stmt.right),
        },
        stmt
      );
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
  styleMapping: TextAST.StyleMapping,
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

function expressionToAug(
  ds: DownState,
  styleMapping: TextAST.StyleMapping,
  expr: Aug.Latex.AnyRootOrChild,
  stmt: TextAST.Statement
): Aug.ExpressionAug | null {
  // is the expr polar for the purposes of domain?
  const isPolar =
    expr.type === "Comparator" &&
    expr.left.type === "Identifier" &&
    expr.left.symbol === "r";

  // TODO: split hydration based on regression, function definition, etc.
  const style = hydrate(
    ds,
    styleMapping,
    isPolar ? Default.polarExpression : Default.nonpolarExpression,
    Schema.expression,
    "expression"
  );
  if (style === null) return null;
  const regMapEntries = regressionMapEntries(
    ds,
    stmt.type === "RegressionStatement" ? stmt : undefined
  );
  if (regMapEntries === null) return null;
  const regression =
    stmt.type === "RegressionStatement"
      ? stmt.body && {
          isLogMode: style.logModeRegression,
          residualVariable: identifierToAug(stmt.body.residualVariable),
          regressionParameters: mapFromEntries(regMapEntries),
        }
      : undefined;
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
    regression: regression,
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

function regressionMapEntries(
  ds: DownState,
  regression?: TextAST.RegressionStatement
): null | [Identifier, number][] {
  if (regression?.body === undefined) return [];
  const res = [...regression.body.regressionParameters.entries()].map(
    ([key, value]): [Identifier, number] | null => {
      const evaluated = evalExpr(ds.diagnostics, value);
      if (evaluated === null) return null;
      if (typeof evaluated !== "number") {
        ds.pushError(
          `Expected regression value ${
            key.name
          } to be a number, but got ${typeof evaluated}`,
          value.pos
        );
        return null;
      }
      return [identifierToAug(key), evaluated];
    }
  );
  return everyNonNull(res) ? res : null;
}

function settingsToAug(
  ds: DownState,
  styleMapping: TextAST.StyleMapping
): null | { type: "settings"; settings: Hydrated.Settings } {
  const res = hydrate(
    ds,
    styleMapping,
    Default.settings,
    Schema.settings,
    "settings"
  );
  return res !== null ? { type: "settings", settings: res } : null;
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
    id: ds.ensureIDAndMarkPos(style.id, stmt),
    secret: style.secret,
    pinned: style.pinned,
  };
}

function tableToAug(
  ds: DownState,
  styleMapping: TextAST.StyleMapping,
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
    id: ds.ensureIDAndMarkPos(style.id, column),
    ...columnExpressionCommonStyle(style),
  };
  if (expr.type === "ListExpression") {
    const values = expr.values.map(childExprToAug);
    return {
      ...base,
      values,
      latex:
        column.type === "LetStatement"
          ? childExprToAug(column.identifier)
          : undefined,
    };
  } else if (column.type === "LetStatement") {
    ds.pushError(
      "Expected table assignment to assign from a ListExpression",
      column.expr.pos
    );
    return null;
  } else {
    return {
      ...base,
      values: [],
      latex: childExprToAug(expr),
    };
  }
}

function imageToAug(
  ds: DownState,
  styleMapping: TextAST.StyleMapping,
  expr: TextAST.Image
): Aug.ImageAug | null {
  const style = hydrate(ds, styleMapping, Default.image, Schema.image, "image");
  if (style === null) return null;
  const res: Aug.ImageAug = {
    type: "image",
    ...exprBase(ds, style, expr),
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
  return res;
}

function folderToAug(
  ds: DownState,
  styleMapping: TextAST.StyleMapping,
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
  const id = ds.ensureIDAndMarkPos(style.id ?? "", expr);
  for (let child of expr.children) {
    const stmtAug = statementToAug(ds, state, child);
    if (stmtAug !== null) {
      if (stmtAug.type === "folder") {
        ds.pushError("Nested folders are not yet implemented", child.pos);
        return null;
      } else if (stmtAug.type === "settings") {
        ds.pushError("Settings may not be in a folder", child.pos);
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
    children: children,
  };
}

function exprEvalSame(expr: TextAST.Expression, expected: number) {
  const evaluated = evalExpr([], expr);
  return evaluated === null ? false : evaluated === expected;
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
