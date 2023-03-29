import Aug from "../aug/AugState";
import TextAST from "../down/TextAST";
import { Calc } from "globals/window";
import { getSections } from "utils/depUtils";

export function graphSettingsToAST(
  settings: Aug.GraphSettings
): TextAST.Settings {
  return {
    type: "Settings",
    style: styleMapping({
      randomSeed: stringToASTmaybe(settings.randomSeed),
      viewport: styleMapping({
        xmin: numberToASTmaybe(settings.viewport.xmin),
        xmax: numberToASTmaybe(settings.viewport.xmax),
        ymin: numberToASTmaybe(settings.viewport.ymin),
        ymax: numberToASTmaybe(settings.viewport.ymax),
      }),
      xAxisMinorSubdivisions: numberToASTmaybe(settings.xAxisMinorSubdivisions),
      yAxisMinorSubdivisions: numberToASTmaybe(settings.yAxisMinorSubdivisions),
      degreeMode: booleanToAST(settings.degreeMode, false),
      showGrid: booleanToAST(settings.showGrid, true),
      showXAxis: booleanToAST(settings.showXAxis, true),
      showYAxis: booleanToAST(settings.showYAxis, true),
      xAxisNumbers: booleanToAST(settings.xAxisNumbers, true),
      yAxisNumbers: booleanToAST(settings.yAxisNumbers, true),
      polarNumbers: booleanToAST(settings.polarNumbers, true),
      xAxisStep: numberToASTmaybe(settings.xAxisStep),
      yAxisStep: numberToASTmaybe(settings.yAxisStep),
      xAxisArrowMode: stringToASTmaybe(settings.xAxisArrowMode),
      yAxisArrowMode: stringToASTmaybe(settings.yAxisArrowMode),
      xAxisLabel: stringToASTmaybe(settings.xAxisLabel),
      yAxisLabel: stringToASTmaybe(settings.yAxisLabel),
      squareAxes: booleanToAST(settings.squareAxes, true),
      restrictGridToFirstQuadrant: booleanToAST(
        settings.restrictGridToFirstQuadrant,
        false
      ),
      polarMode: booleanToAST(settings.polarMode, false),
      lockViewport: booleanToAST(settings.userLockedViewport, false),
    }),
  };
}

export function tickerToAST(ticker: Aug.TickerAug): TextAST.Ticker {
  return {
    type: "Ticker",
    handler: childLatexToAST(ticker.handlerLatex),
    style: styleMapping({
      minStep: childLatexToAST(ticker.minStepLatex),
      playing: booleanToAST(ticker.playing, false),
    }),
  };
}

function idToString(id: string) {
  return id.startsWith("__") || /\d+/.test(id)
    ? undefined
    : stringToASTmaybe(id);
}

export function itemAugToAST(item: Aug.ItemAug): TextAST.Statement | null {
  if (item.error)
    return {
      type: "Text",
      text: `(Error in automatic conversion${
        item.type === "text" ? ": " + item.text : ""
      })`,
      style: null,
    };
  const base = {
    id: idToString(item.id),
    secret: booleanToAST(item.secret, false),
    pinned: booleanToAST(item.type !== "folder" && item.pinned, false),
  };
  switch (item.type) {
    case "expression": {
      if (item.latex === undefined) return null;
      const expr = rootLatexToAST(item.latex);
      if (
        expr.type === "BinaryExpression" &&
        expr.op === "~" &&
        item.regression
      ) {
        // regression
        return {
          type: "ExprStatement",
          expr,
          style: styleMapping({
            ...base,
            errorHidden: booleanToAST(item.errorHidden, false),
            logMode: booleanToAST(item.regression?.isLogMode, false),
          }),
          regression: {
            parameters: {
              type: "RegressionParameters",
              entries: [...item.regression.regressionParameters.entries()].map(
                ([id, value]) => ({
                  type: "RegressionEntry",
                  variable: identifierToAST(id),
                  value: { type: "Number", value },
                })
              ),
            },
            residualVariable:
              item.regression.residualVariable &&
              identifierToAST(item.regression.residualVariable),
          },
        };
      }
      return {
        type: "ExprStatement",
        expr,
        style: styleMapping({
          ...base,
          ...expressionStyle(item),
        }),
      };
    }
    case "image":
      return {
        type: "Image",
        name: item.name,
        style: styleMapping({
          ...base,
          url: stringToASTmaybe(item.image_url),
          hoveredImage: stringToASTmaybe(item.clickableInfo?.hoveredImage),
          depressedImage: stringToASTmaybe(item.clickableInfo?.depressedImage),
          width: childLatexToASTmaybe(item.width),
          height: childLatexToASTmaybe(item.height),
          center: childLatexToASTmaybe(item.center),
          angle:
            item.angle &&
            (item.angle.type !== "Constant" || item.angle.value !== 0)
              ? childLatexToASTmaybe(item.angle)
              : undefined,
          opacity:
            item.opacity &&
            (item.opacity.type !== "Constant" || item.opacity.value !== 1)
              ? childLatexToASTmaybe(item.opacity)
              : undefined,
          foreground: booleanToAST(item.foreground, false),
          draggable: booleanToAST(item.draggable, false),
          onClick: childLatexToASTmaybe(item.clickableInfo?.latex),
          clickDescription: stringToASTmaybe(item.clickableInfo?.description),
        }),
      };
    case "table":
      return {
        type: "Table",
        columns: item.columns.map((e, i) => columnToAST(e, item, i)),
        style: styleMapping(base),
      };
    case "text":
      return {
        type: "Text",
        text: item.text,
        style: styleMapping(base),
      };
    case "folder":
      return {
        type: "Folder",
        title: item.title,
        children: item.children
          .map(itemAugToAST)
          .filter((e) => e !== null) as TextAST.Statement[],
        style: styleMapping({
          ...base,
          collapsed: booleanToAST(item.collapsed, false),
          hidden: booleanToAST(item.hidden, false),
        }),
      };
  }
}

function expressionStyle(
  item: Aug.ExpressionAug
): Parameters<typeof styleMapping>[0] {
  const domain = item.parametricDomain ?? item.polarDomain;
  const model = Calc.controller.getItemModel(item.id);
  const sections: ReturnType<typeof getSections> = model
    ? getSections(model)
    : // model not found. Just show everything we have data for
      ["points", "label", "fill", "lines", "drag"];
  return {
    ...columnExpressionCommonStyle(item, sections),
    fill: sections.includes("fill")
      ? childLatexToASTmaybe(item.fillOpacity)
      : undefined,
    label: sections.includes("label")
      ? item.label &&
        styleMapping({
          text: stringToASTmaybe(item.label.text),
          size: childLatexToASTmaybe(item.label.size),
          orientation: stringToASTmaybe(item.label.orientation),
          angle: childLatexToASTmaybe(item.label.angle),
          outline: booleanToAST(item.label.outline, true),
          showOnHover: booleanToAST(item.label.showOnHover, false),
          editableMode: stringToASTmaybe(item.label.editableMode),
        })
      : undefined,
    errorHidden: booleanToAST(item.errorHidden, false),
    glesmos: booleanToAST(item.glesmos, false),
    fractionDisplay: booleanToAST(item.displayEvaluationAsFraction, false),
    slider: styleMapping({
      playing: booleanToAST(item.slider.isPlaying, false),
      reversed: booleanToAST(item.slider.playDirection === -1, false),
      loopMode: stringToASTmaybe(item.slider.loopMode),
      period: numberToASTmaybe(item.slider.period),
      min: childLatexToASTmaybe(item.slider.min),
      max: childLatexToASTmaybe(item.slider.max),
      step: childLatexToASTmaybe(item.slider.step),
    }),
    // We will infer whether parametric or polar domain is needed
    domain:
      domain &&
      styleMapping({
        min: childLatexToASTmaybe(domain.min),
        max: childLatexToASTmaybe(domain.max),
      }),
    cdf:
      item.cdf &&
      styleMapping({
        min: childLatexToASTmaybe(item.cdf.min),
        max: childLatexToASTmaybe(item.cdf.max),
      }),
    vizProps:
      item.vizProps &&
      styleMapping({
        boxplot:
          item.vizProps.boxplot &&
          styleMapping({
            breadth: childLatexToASTmaybe(item.vizProps.boxplot.breadth),
            axisOffset: childLatexToASTmaybe(item.vizProps.boxplot.axisOffset),
            alignedAxis: stringToASTmaybe(item.vizProps.boxplot.alignedAxis),
            showOutliers: booleanToAST(
              item.vizProps.boxplot.showOutliers,
              true
            ),
          }),
        dotplotMode: stringToASTmaybe(item.vizProps.dotplotMode),
        binAlignment: stringToASTmaybe(item.vizProps.binAlignment),
        histogramMode: stringToASTmaybe(item.vizProps.histogramMode),
      }),
    onClick: childLatexToASTmaybe(item.clickableInfo?.latex),
    clickDescription: stringToASTmaybe(item.clickableInfo?.description),
  };
}

function columnExpressionCommonStyle(
  item: Aug.TableColumnAug | Aug.ExpressionAug,
  sections: ReturnType<typeof getSections>
) {
  const res: Parameters<typeof styleMapping>[0] =
    sections.length > 0
      ? {
          color:
            typeof item.color === "string"
              ? stringToASTmaybe(item.color)
              : identifierToAST(item.color),
          hidden: booleanToAST(item.hidden, false),
        }
      : {};
  if (sections.includes("lines") && item.lines) {
    res.lines = styleMapping({
      opacity: childLatexToASTmaybe(item.lines.opacity),
      width: childLatexToASTmaybe(item.lines.width),
      style: stringToASTmaybe(item.lines.style),
    });
  }
  if (sections.includes("points") && item.points) {
    res.points = styleMapping({
      opacity: childLatexToASTmaybe(item.points.opacity),
      size: childLatexToASTmaybe(item.points.size),
      style: stringToASTmaybe(item.points.style),
      drag: sections.includes("drag")
        ? stringToASTmaybe(item.points.dragMode)
        : undefined,
    });
  }
  return res;
}

function columnToAST(
  col: Aug.TableColumnAug,
  parentTable: Aug.TableAug,
  colIndex: number
): TextAST.TableColumn {
  const model = Calc.controller.getItemModel(parentTable.id);
  const draggable =
    model && model.type === "table"
      ? model.columnModels[colIndex].draggable
      : true;
  return {
    type: "ExprStatement",
    expr:
      col.latex === undefined
        ? {
            type: "ListExpression",
            values: col.values.map((e) => childLatexToAST(e)),
          }
        : col.latex.type === "Identifier"
        ? {
            type: "BinaryExpression",
            op: "=",
            left: childLatexToAST(col.latex),
            right: {
              type: "ListExpression",
              values: col.values.map(childLatexToAST),
            },
          }
        : childLatexToAST(col.latex),
    style: styleMapping({
      id: idToString(col.id),
      ...columnExpressionCommonStyle(
        col,
        colIndex === 0
          ? []
          : ["points", "lines", ...(draggable ? ["drag" as const] : [])]
      ),
    }),
  };
}

function styleMapping(
  from: Record<
    string,
    TextAST.Expression | TextAST.StyleMapping | null | undefined
  >
): TextAST.StyleMapping | null {
  const nonemptyEntries = Object.entries(from).filter(
    ([_, value]) => value != null
  ) as [string, TextAST.Expression | TextAST.StyleMapping][];
  return nonemptyEntries.length > 0
    ? {
        type: "StyleMapping",
        entries: nonemptyEntries.map(([prop, value]) => ({
          type: "MappingEntry",
          property: {
            type: "String",
            value: prop,
          },
          expr: value,
        })),
      }
    : null;
}

function booleanToAST(bool: boolean | undefined, defaultValue: boolean) {
  return bool === undefined || bool === defaultValue
    ? undefined
    : identifierToAST({ symbol: bool ? "true" : "false" });
}

function identifierToAST(name: { symbol: string }): TextAST.Identifier {
  // TODO: avoid collisions from underscore removal
  return {
    type: "Identifier",
    name: name.symbol.replace("_", ""),
  };
}

function numberToASTmaybe(
  num: number | undefined
): TextAST.NumberNode | undefined {
  return num !== undefined
    ? {
        type: "Number",
        value: num,
      }
    : undefined;
}

function stringToASTmaybe(
  str: string | undefined
): TextAST.StringNode | undefined {
  return str !== undefined
    ? {
        type: "String",
        value: str,
      }
    : undefined;
}

/**
 * Returns undefined if (and only if) the input is undefined
 */
function childLatexToASTmaybe(
  e: Aug.Latex.AnyChild | undefined
): TextAST.Expression | undefined {
  return e && childLatexToAST(e);
}

function functionCallToAST(e: Aug.Latex.FunctionCall): TextAST.CallExpression {
  return {
    type: "CallExpression",
    callee: identifierToAST(e.callee),
    arguments: e.args.map(childLatexToAST),
  };
}

function childLatexToAST(e: Aug.Latex.AnyChild): TextAST.Expression {
  switch (e.type) {
    case "Constant":
      return numberToASTmaybe(e.value)!;
    case "Identifier":
      return identifierToAST(e);
    case "FunctionCall":
      return e.callee.symbol === "factorial" && e.args.length === 1
        ? {
            type: "PostfixExpression",
            op: "factorial",
            expr: childLatexToAST(e.args[0]),
          }
        : functionCallToAST(e);
    case "Prime":
      return {
        type: "PrimeExpression",
        expr: functionCallToAST(e.arg),
        order: e.order,
      };
    case "Integral":
      return {
        type: "RepeatedExpression",
        name: "integral",
        index: identifierToAST(e.differential),
        start: childLatexToAST(e.start),
        end: childLatexToAST(e.end),
        expr: childLatexToAST(e.integrand),
      };
    case "Derivative":
      return {
        type: "DerivativeExpression",
        expr: childLatexToAST(e.arg),
        variable: identifierToAST(e.variable),
      };
    case "List":
      return {
        type: "ListExpression",
        values: e.args.map(childLatexToAST),
      };
    case "Range":
      return {
        type: "RangeExpression",
        startValues: e.start.map(childLatexToAST),
        endValues: e.end.map(childLatexToAST),
      };
    case "ListAccess":
      return {
        type: "ListAccessExpression",
        expr: childLatexToAST(e.list),
        index: childLatexToAST(e.index),
      };
    case "DotAccess":
      return e.property.type === "FunctionCall"
        ? {
            type: "CallExpression",
            callee: {
              type: "MemberExpression",
              object: childLatexToAST(e.object),
              property: identifierToAST(e.property.callee),
            },
            arguments: e.property.args.map(childLatexToAST),
          }
        : {
            type: "MemberExpression",
            object: childLatexToAST(e.object),
            property: identifierToAST(e.property),
          };
    case "OrderedPairAccess":
      return {
        type: "MemberExpression",
        object: childLatexToAST(e.point),
        property: identifierToAST({ symbol: e.index }),
      };
    case "Seq":
      if (e.args.length <= 1)
        throw Error("Programming Error: Expected at least 2 elements in Seq");
      return {
        type: "SequenceExpression",
        left: childLatexToAST(e.args[0]),
        right:
          e.args.length > 2
            ? childLatexToAST({
                type: "Seq",
                args: e.args.slice(1),
                parenWrapped: false,
              })
            : childLatexToAST(e.args[1]),
        parenWrapped: e.parenWrapped,
      };
    case "UpdateRule":
      return {
        type: "UpdateRule",
        variable: identifierToAST(e.variable),
        expr: childLatexToAST(e.expression),
      };
    case "ListComprehension":
      return {
        type: "ListComprehension",
        expr: childLatexToAST(e.expr),
        assignments: e.assignments.map(assignmentExprToAST),
      };
    case "Piecewise": {
      const piecewiseBranches: TextAST.PiecewiseBranch[] = [];
      let curr: Aug.Latex.AnyChild = e;
      while (curr.type === "Piecewise") {
        if (curr.condition === true) {
          curr = curr.consequent;
          break;
        }
        piecewiseBranches.push({
          type: "PiecewiseBranch",
          condition: childLatexToAST(curr.condition),
          consequent: childLatexToAST(curr.consequent),
        });
        curr = curr.alternate;
      }
      if (!Aug.Latex.isConstant(curr, NaN)) {
        piecewiseBranches.push({
          type: "PiecewiseBranch",
          condition: identifierToAST({ symbol: "else" }),
          consequent: childLatexToAST(curr),
        });
      }
      return {
        type: "PiecewiseExpression",
        branches: piecewiseBranches,
      };
    }
    case "RepeatedOperator":
      return {
        type: "RepeatedExpression",
        name: e.name === "Product" ? "product" : "sum",
        index: identifierToAST(e.index),
        start: childLatexToAST(e.start),
        end: childLatexToAST(e.end),
        expr: childLatexToAST(e.expression),
      };
    case "BinaryOperator":
      if (
        e.name === "Multiply" &&
        e.left.type === "Constant" &&
        e.right.type === "BinaryOperator" &&
        e.right.name === "Exponent" &&
        e.right.left.type === "Constant" &&
        e.right.left.value === 10 &&
        e.right.right.type === "Constant" &&
        Number.isSafeInteger(e.right.right.value)
      ) {
        // special case to change exponential notation e.g. 2 * 10 ^ 5 to 2e5
        // advantage: every float from an action value looks like a float after
        // disadvantage: maybe unexpected conversion in some cases
        return {
          type: "Number",
          value: e.left.value * e.right.left.value ** e.right.right.value,
        };
      }
      return {
        type: "BinaryExpression",
        op: binopMap[e.name],
        left: childLatexToAST(e.left),
        right: childLatexToAST(e.right),
      };
    case "Negative":
      return {
        type: "PrefixExpression",
        op: "-",
        expr: childLatexToAST(e.arg),
      };
    case "Comparator":
      return {
        type: "BinaryExpression",
        op: e.operator,
        left: childLatexToAST(e.left),
        right: childLatexToAST(e.right),
      };
    case "DoubleInequality":
      return {
        type: "DoubleInequality",
        left: childLatexToAST(e.left),
        leftOp: e.leftOperator,
        middle: childLatexToAST(e.middle),
        rightOp: e.rightOperator,
        right: childLatexToAST(e.right),
      };
  }
}

const binopMap = {
  Add: "+",
  Subtract: "-",
  Multiply: "*",
  Divide: "/",
  Exponent: "^",
} as const;

function assignmentExprToAST(
  e: Aug.Latex.AssignmentExpression
): TextAST.AssignmentExpression {
  return {
    type: "AssignmentExpression",
    variable: identifierToAST(e.variable),
    expr: childLatexToAST(e.expression),
  };
}

function rootLatexToAST(e: Aug.Latex.AnyRootOrChild): TextAST.Expression {
  switch (e.type) {
    case "Equation":
    case "Assignment":
      return {
        type: "BinaryExpression",
        op: "=",
        left: childLatexToAST(e.left),
        right: childLatexToAST(e.right),
      };
    case "FunctionDefinition":
      return {
        type: "BinaryExpression",
        op: "=",
        left: childLatexToAST({
          type: "FunctionCall",
          callee: e.symbol,
          args: e.argSymbols,
        }),
        right: childLatexToAST(e.definition),
      };
    case "Visualization":
      return {
        type: "CallExpression",
        callee: identifierToAST(e.callee),
        arguments: e.args.map(childLatexToAST),
      };
    case "Regression":
      return {
        type: "BinaryExpression",
        op: "~",
        left: childLatexToAST(e.left),
        right: childLatexToAST(e.right),
      };
    default:
      return childLatexToAST(e);
  }
}
