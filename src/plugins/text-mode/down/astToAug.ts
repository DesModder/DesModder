import {
  Program,
  StyleMappingFilled,
  Statement,
  Expression,
  Identifier,
  PiecewiseBranch,
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
  return state;
}

function pushStatement(state: Aug.State, stmt: Statement) {
  const style = evalStyle(stmt.style ?? { type: "StyleMapping", entries: [] });
  switch (stmt.type) {
    case "Settings":
      applySettings(state, style);
      break;
    // case "Folder":
    //   pushFolder(state, style, )
    //   break;
    case "ShowStatement":
      style.hidden = !stmt.show;
      pushExpression(state, style, childExprToAug(stmt.expr));
      break;
    case "LetStatement":
      pushExpression(state, style, {
        type: "Comparator",
        operator: "=",
        left: identifierToAug(stmt.identifier),
        right: childExprToAug(stmt.expr),
      });
      break;
    case "FunctionDefinition":
      pushExpression(state, style, {
        type: "Comparator",
        operator: "=",
        left: {
          type: "FunctionCall",
          callee: identifierToAug(stmt.identifier),
          args: stmt.params.map(identifierToAug),
        },
        right: childExprToAug(stmt.expr),
      });
    default:
      let u = stmt.type;
  }
}

function pushExpression(
  state: Aug.State,
  style: StyleValue,
  expr: Aug.Latex.AnyRootOrChild
) {
  // TODO: improve expression schema
  // TODO: handle rest of styling
  if (typeof style.color !== "string") throw "Non-string color";
  if (typeof style.id !== "string") throw "Non-string ID";
  state.expressions.list.push({
    type: "expression",
    id: style.id,
    secret: !!style.secret,
    pinned: !!style.pinned,
    color: style.color,
    latex: expr,
    hidden: !!style.hidden,
    errorHidden: !!style.errorHidden,
    fillOpacity: { type: "Constant", value: 0 },
    glesmos: !!style.glesmos,
    displayEvaluationAsFraction: !!style.displayEvaluationAsFraction,
    slider: {},
    vizProps: {},
  });
}

const graphSettingsSchema = {
  randomSeed: "string",
  viewport: {
    xmin: "number",
    ymin: "number",
    xmax: "number",
    ymax: "number",
  },
  xAxisMinorSubdivisions: "number",
  yAxisMinorSubdivisions: "number",
  degreeMode: "boolean",
  showGrid: "boolean",
  showXAxis: "boolean",
  showYAxis: "boolean",
  xAxisNumbers: "boolean",
  yAxisNumbers: "boolean",
  polarNumbers: "boolean",
  xAxisStep: "number",
  yAxisStep: "number",
  xAxisArrowMode: "ArrowMode",
  yAxisArrowMode: "ArrowMode",
  xAxisLabel: "string",
  yAxisLabel: "string",
  squareAxes: "boolean",
  restrictGridToFirstQuadrant: "boolean",
  polarMode: "boolean",
};

function applySettings(state: Aug.State, style: StyleValue) {
  validateSchema(style, graphSettingsSchema, "settings");
  for (let [key, value] of Object.entries(style)) {
    if (key === "viewport") {
      let newVP = value as {
        xmin?: number;
        ymin?: number;
        xmax?: number;
        ymax?: number;
      };
      state.settings.viewport = { ...state.settings.viewport, ...newVP };
    } else {
      (state.settings as any)[key] = value;
    }
  }
}

function validateSchema(style: object, schema: any, path: string) {
  for (let [key, value] of Object.entries(style)) {
    const type = typeof value;
    const expectedType = schema[key];
    const fullPath = path + "." + key;
    if (expectedType === undefined) {
      throw `Unexpected property: ${fullPath}`;
    } else if (typeof expectedType === "object") {
      if (type !== "object") {
        throw `Property ${fullPath} is type ${type} but should be a style map`;
      }
      validateSchema(value, schema[key], fullPath);
    } else if (expectedType !== type) {
      throw `Property ${fullPath} is type ${type} but should be ${expectedType}`;
    }
  }
}

interface StyleValue {
  [key: string]: string | number | boolean | Expression | StyleValue;
}

function evalStyle(style: StyleMappingFilled) {
  let obj: StyleValue = {};
  for (let { property, expr } of style.entries) {
    if (expr === null) throw "Null expression in style mapping";
    obj[property] =
      expr.type === "StyleMapping" ? evalStyle(expr) : evalExpr(expr);
  }
  return obj;
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
      if (expr.name === "false") return false;
      else if (expr.name === "true") return true;
      else {
        throw `Undefined identifier: ${expr.name}`;
      }
    default:
      throw `Unhandled expr type: ${expr.type}`;
  }
}

function childExprToAug(expr: Expression): Aug.Latex.AnyChild {
  switch (expr.type) {
    case "Number":
      return {
        type: "Constant",
        value: expr.value,
      };
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
    case "PointExpression":
      return {
        type: "Seq",
        parenWrapped: true,
        args: expr.values.map(childExprToAug),
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
      consequent: {
        type: "Constant",
        value: 1,
      },
      alternate: {
        type: "Constant",
        value: NaN,
      },
    };
  } else {
    return res;
  }
}

function piecewiseInnerToAug(branches: PiecewiseBranch[]): Aug.Latex.AnyChild {
  const firstBranch = branches[0];
  if (firstBranch === undefined)
    return {
      type: "Constant",
      value: NaN,
    };
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
