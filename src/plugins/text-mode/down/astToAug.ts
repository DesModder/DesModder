import {
  Program,
  StyleMappingFilled,
  Statement,
  Expression,
  Identifier,
  PiecewiseBranch,
  TableColumn,
  Image,
  Folder,
} from "./textAST";
import * as Aug from "../aug/AugState";

export default function astToAug(program: Program) {
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
  for (let stmt of program) {
    pushStatement(state, stmt);
  }
  fixEmptyIDs(state);
  return state;
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
  for (let expr of state.expressions.list) {
    if (expr.id === "") {
      maxNumericID++;
      expr.id = maxNumericID.toString();
    }
  }
}

function pushStatement(state: Aug.State, stmt: Statement) {
  const stmtAug = statementToAug(state, stmt);
  if (stmtAug !== null) {
    state.expressions.list.push(stmtAug);
  }
}

/**
 * Convert a statement to its Aug form. Null represents inserting nothing.
 * The `state` parameter may be modified
 */
function statementToAug(state: Aug.State, stmt: Statement): Aug.ItemAug | null {
  const style = evalStyle(stmt.style);
  switch (stmt.type) {
    case "Settings":
      applySettings(state, style);
      return null;
    case "ShowStatement":
      style.props.hidden = boolean(!stmt.show);
      return expressionToAug(style, childExprToAug(stmt.expr));
    case "LetStatement":
      return expressionToAug(style, {
        type: "Comparator",
        operator: "=",
        left: identifierToAug(stmt.identifier),
        right: childExprToAug(stmt.expr),
      });
    case "FunctionDefinition":
      return expressionToAug(style, {
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
      // TODO Regression
      return null;
    case "Table":
      return tableToAug(style, stmt.columns);
    case "Image":
      return imageToAug(style, stmt);
    case "Text":
      return {
        ...exprBase(style),
        type: "text",
        text: stmt.text,
      };
    case "Folder":
      return folderToAug(style, stmt, state);
  }
}

function expressionToAug(
  styleValue: StyleValue,
  expr: Aug.Latex.AnyRootOrChild
): Aug.ExpressionAug {
  // TODO: improve expression schema
  const style = styleValue.props;
  if (style.label !== undefined && !isStyleValue(style.label))
    throw "Label should be a style map";
  return {
    type: "expression",
    // Use empty string as an ID placeholder. These will get filled in at the end
    ...exprBase(styleValue),
    latex: expr,
    // TODO label
    label: style.label && labelStyleToAug(style.label),
    // hidden from common
    errorHidden: stylePropBoolean(style.errorHidden, false),
    glesmos: stylePropBoolean(style.glesmos, false),
    fillOpacity: constant(0),
    // TODO regression
    displayEvaluationAsFraction: stylePropBoolean(
      style.displayEvaluationAsFraction,
      false
    ),
    // TODO slider
    slider: {},
    // TODO polarDomain
    // TODO parametricDomain
    // TODO cdf
    vizProps: {},
    // TODO clickableInfo,
    ...columnExpressionCommonStyle(styleValue),
  };
}

function columnExpressionCommonStyle({ props: style }: StyleValue) {
  if (!isExpr(style.color)) {
    throw (
      `Color should be either string or identifier. ` +
      `Got ${JSON.stringify(style.color)} of type ${typeof style.color}`
    );
  }
  return {
    color:
      style.color.type === "Identifier"
        ? identifierToAug(style.color)
        : evalExprToString(style.color),
    hidden: stylePropBoolean(style.hidden, false),
    // TODO points
    // TODO Lines
  };
}

function exprBase({ props: style }: StyleValue) {
  return {
    // Use empty string as an ID placeholder. These will get filled in at the end
    id: isExpr(style.id) ? evalExprToString(style.id) : "",
    secret: stylePropBoolean(style.secret, false),
    pinned: stylePropBoolean(style.pinned, false),
  };
}

function tableToAug(
  styleValue: StyleValue,
  columns: TableColumn[]
): Aug.TableAug {
  return {
    type: "table",
    ...exprBase(styleValue),
    columns: columns.map(tableColumnToAug),
  };
}

function tableColumnToAug(column: TableColumn): Aug.TableColumnAug {
  const styleValue = evalStyle(column.style);
  const style = styleValue.props;
  const expr = column.expr;
  const base = {
    id: isExpr(style.id) ? evalExprToString(style.id) : "",
    ...columnExpressionCommonStyle(styleValue),
  };
  if (column.type === "LetStatement") {
    if (expr.type !== "ListExpression")
      throw "Table assignment can only assign from a ListExpression";
    return {
      ...base,
      values: expr.values.map(childExprToAug),
      latex: childExprToAug(column.identifier),
    };
  } else if (expr.type === "ListExpression") {
    return {
      ...base,
      values: expr.values.map(childExprToAug),
    };
  } else {
    return {
      ...base,
      values: [],
      latex: childExprToAug(expr),
    };
  }
}

function imageToAug(styleValue: StyleValue, expr: Image): Aug.ImageAug {
  const style = styleValue.props;
  return {
    type: "image",
    ...exprBase(styleValue),
    image_url: expr.url,
    name: expr.name,
    width: stylePropExpr(style.width, constant(10)),
    height: stylePropExpr(style.height, constant(10)),
    center: stylePropExpr(style.center, {
      type: "Seq",
      args: [constant(0), constant(0)],
      parenWrapped: true,
    }),
    angle: stylePropExpr(style.angle, constant(0)),
    opacity: stylePropExpr(style.opacity, constant(1)),
    foreground: stylePropBoolean(style.foreground, false),
    draggable: stylePropBoolean(style.draggable, false),
    // TODO: clickableInfo
  };
}

function folderToAug(
  styleValue: StyleValue,
  expr: Folder,
  state: Aug.State
): Aug.FolderAug {
  const style = styleValue.props;
  const children: Aug.NonFolderAug[] = [];
  for (let child of expr.children) {
    const stmtAug = statementToAug(state, child);
    if (stmtAug !== null) {
      if (stmtAug.type === "folder") {
        throw "Nested folders are not yet permitted";
      }
      children.push(stmtAug);
    }
  }
  return {
    type: "folder",
    ...exprBase(styleValue),
    hidden: stylePropBoolean(style.hidden, false),
    collapsed: stylePropBoolean(style.collapsed, false),
    title: expr.title,
    children: children,
  };
}

const labelOrientations = [
  "default",
  "center",
  "center_auto",
  "auto_center",
  "above",
  "above_left",
  "above_right",
  "above_auto",
  "below",
  "below_left",
  "below_right",
  "below_auto",
  "left",
  "auto_left",
  "right",
  "auto_right",
];

function isLabelOrientation(str: string): str is Aug.LabelOrientation {
  return labelOrientations.includes(str);
}

function labelStyleToAug(styleValue: StyleValue): Aug.LabelStyle {
  const style = styleValue.props;
  const orientation = isExpr(style.orientation)
    ? evalExprToString(style.orientation)
    : "default";
  const editableMode = isExpr(style.editableMode)
    ? evalExprToString(style.editableMode)
    : "NONE";
  return {
    text: isExpr(style.text) ? evalExprToString(style.text) : "",
    size: stylePropExpr(style.size, constant(1)),
    orientation: isLabelOrientation(orientation) ? orientation : "default",
    angle: stylePropExpr(style.angle, constant(0)),
    outline: stylePropBoolean(style.outline, true),
    showOnHover: stylePropBoolean(style.showOnHover, false),
    editableMode:
      editableMode === "MATH" ||
      editableMode === "TEXT" ||
      editableMode === "NONE"
        ? editableMode
        : "NONE",
  };
}

function stylePropExpr(
  value: StyleProp,
  defaultValue: Aug.Latex.AnyChild
): Aug.Latex.AnyChild {
  return isExpr(value) ? childExprToAug(value) : defaultValue;
}

function stylePropBoolean(value: StyleProp, defaultValue: boolean) {
  return isExpr(value) ? evalExprToBoolean(value) : defaultValue;
}

function isExpr(value: StyleProp): value is Expression {
  return typeof value === "object" && value.type !== "StyleValue";
}

function isStyleValue(value: StyleProp): value is StyleValue {
  return typeof value === "object" && value.type === "StyleValue";
}

function applySettings(state: Aug.State, styleValue: StyleValue) {
  const style = styleValue.props;
  const settings = state.settings;
  for (let key in style) {
    const value = style[key];
    switch (key) {
      case "viewport":
        if (value?.type !== "StyleValue") {
          throw "Viewport should be a style mapping";
        }
        for (let prop of ["xmin", "ymin", "xmax", "ymax"] as const) {
          const val = value.props[prop];
          if (!isExpr(val)) {
            throw `The viewport must specify ${prop}`;
          }
          settings.viewport[prop] = evalExprToNumber(val);
        }
        break;
      case "randomSeed":
        if (isExpr(value)) {
          settings[key] = evalExprToString(value);
        } else {
          throw "Random seed must currently be specified";
        }
        break;
      case "xAxisLabel":
      case "yAxisLabel":
        settings[key] = isExpr(value) ? evalExprToString(value) : "";
        break;
      case "xAxisArrowMode":
      case "yAxisArrowMode":
        if (!isExpr(value)) {
          settings[key] = "NONE";
        } else {
          const stringValue = evalExprToString(value);
          if (
            stringValue !== "NONE" &&
            stringValue !== "POSITIVE" &&
            stringValue !== "BOTH"
          ) {
            const strRepr = JSON.stringify(stringValue);
            throw (
              `String ${strRepr} is not a valid arrow mode. ` +
              `Expected "NONE", "POSITIVE", or "BOTH"`
            );
          }
          settings[key] = stringValue;
        }
        break;
      case "xAxisMinorSubdivisions":
      case "yAxisMinorSubdivisions":
      case "xAxisStep":
      case "yAxisStep":
        settings[key] = isExpr(value) ? evalExprToNumber(value) : 0;
        break;
      case "degreeMode":
      case "showGrid":
      case "showXAxis":
      case "showYAxis":
      case "xAxisNumbers":
      case "yAxisNumbers":
      case "polarNumbers":
      case "squareAxes":
      case "restrictGridToFirstQuadrant":
      case "polarMode":
        settings[key] = isExpr(value)
          ? evalExprToBoolean(value)
          : boolDefaults[key];
        break;
      default:
        throw `Unexpected settings key: ${key}`;
    }
  }
}

const boolDefaults = {
  degreeMode: false,
  showGrid: true,
  showXAxis: true,
  showYAxis: true,
  xAxisNumbers: true,
  yAxisNumbers: true,
  polarMode: false,
  polarNumbers: true,
  squareAxes: true,
  restrictGridToFirstQuadrant: false,
};

interface StyleValue {
  type: "StyleValue";
  props: {
    [key: string]: StyleProp;
  };
}

type StyleProp = Expression | StyleValue | undefined;

function evalStyle(style: StyleMappingFilled | null) {
  style ??= { type: "StyleMapping", entries: [] };
  let res: StyleValue = {
    type: "StyleValue",
    props: {},
  };
  for (let { property, expr } of style.entries) {
    if (expr === null) throw "Null expression in style mapping";
    res.props[property] = expr.type === "StyleMapping" ? evalStyle(expr) : expr;
  }
  return res;
}

function evalExpr(expr: Expression): number | string | boolean {
  switch (expr.type) {
    case "Number":
      return expr.value;
    case "String":
      return expr.value;
    case "PrefixExpression":
      return -evalExpr(expr.expr);
    case "Identifier":
      // TODO: create proper builtin map
      // Rudimentary variable inlining
      if (expr.name === "false") return false;
      else if (expr.name === "true") return true;
      else {
        throw `Undefined identifier: ${expr.name}`;
      }
    default:
      throw `Unhandled expr type: ${expr.type}`;
  }
}

function boolean(value: boolean): Identifier {
  return {
    type: "Identifier",
    name: value ? "true" : "false",
  };
}

function evalExprTo(expr: Expression, type: string) {
  const res = evalExpr(expr);
  if (typeof res !== type) {
    throw `Expected expression to evaluate to a ${type}`;
  }
  return res;
}

function evalExprToString(expr: Expression): string {
  return evalExprTo(expr, "string") as string;
}

function evalExprToNumber(expr: Expression): number {
  return evalExprTo(expr, "number") as number;
}

function evalExprToBoolean(expr: Expression): boolean {
  return evalExprTo(expr, "boolean") as boolean;
}

function childExprToAug(expr: Expression): Aug.Latex.AnyChild {
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
      if (expr.callee.type !== "Identifier")
        throw "Non-identifier callee not yet implemented";
      return {
        type: "FunctionCall",
        callee: identifierToAug(expr.callee),
        args: expr.arguments.map(childExprToAug),
      };
  }
}

const binopMap = {
  "+": "Add",
  "-": "Subtract",
  "*": "Multiply",
  "/": "Divide",
  "^": "Exponent",
} as { [key: string]: string };

function piecewiseToAug(branches: PiecewiseBranch[]): Aug.Latex.AnyChild {
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

function piecewiseInnerToAug(branches: PiecewiseBranch[]): Aug.Latex.AnyChild {
  const firstBranch = branches[0];
  if (firstBranch === undefined) return constant(NaN);
  const firstCond = childExprToAug(firstBranch.condition);
  if (firstCond.type === "Identifier" && firstCond.symbol === "else") {
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

function identifierToAug(expr: Identifier) {
  return {
    type: "Identifier" as const,
    symbol: expr.name,
  };
}

function constant(val: number): Aug.Latex.Constant {
  return {
    type: "Constant",
    value: val,
  };
}
