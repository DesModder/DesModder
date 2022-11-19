import Aug from "./AugState";
import * as Graph from "@desmodder/graph-state";
import Metadata from "main/metadata/interface";
import migrateToLatest from "main/metadata/migrate";
import { ChildExprNode, evalMaybeRational, AnyNode } from "parsing/parsenode";
import { getReconciledExpressionProps, parseDesmosLatex } from "utils/depUtils";

export default function rawToAug(raw: Graph.GraphState): Aug.State {
  const dsmMetadata = rawToDsmMetadata(raw);
  const res: Aug.State = {
    version: 9,
    settings: rawToAugSettings(raw),
    expressions: {
      list: rawListToAug(raw.expressions.list, dsmMetadata),
    },
  };
  const ticker = raw.expressions.ticker;
  if (ticker?.handlerLatex) {
    res.expressions.ticker = {
      handlerLatex: parseLatex(ticker.handlerLatex),
      minStepLatex: parseLatex(ticker.minStepLatex ?? "0"),
      playing: ticker.playing ?? false,
    };
  }
  return res;
}

export function rawToAugSettings(raw: Graph.GraphState) {
  return {
    ...raw.graph,
    randomSeed: raw.randomSeed,
  };
}

export function rawToDsmMetadata(raw: Graph.GraphState) {
  const dsmMetadataExpr = raw.expressions.list.find(
    (e) => e.id === "dsm-metadata"
  );
  return migrateToLatest(
    dsmMetadataExpr?.type === "text"
      ? JSON.parse(dsmMetadataExpr.text ?? "{}")
      : {}
  );
}

function rawListToAug(
  list: Graph.ItemState[],
  dsmMetadata: Metadata
): Aug.ItemAug[] {
  const res: Aug.ItemAug[] = [];
  let currentFolder: null | Aug.FolderAug = null;
  for (const item of list) {
    if (item.id === "dsm-metadata-folder" || item.id === "dsm-metadata") {
      continue;
    }
    if (item.type === "folder") {
      currentFolder = rawFolderToAug(item);
      res.push(currentFolder);
    } else {
      const augItem = rawNonFolderToAug(item, dsmMetadata);
      if (item.folderId) {
        if (!currentFolder || item.folderId !== currentFolder.id) {
          throw Error("Folder ID inconsistent");
        }
        currentFolder.children.push(augItem);
      } else {
        res.push(augItem);
      }
    }
  }
  return res;
}

function rawFolderToAug(item: Graph.FolderState): Aug.FolderAug {
  return {
    type: "folder" as const,
    id: item.id,
    secret: item.secret ?? false,
    hidden: item.hidden ?? false,
    collapsed: item.collapsed ?? false,
    title: item.title ?? "",
    children: [],
  };
}

export function rawNonFolderToAug(
  item: Graph.NonFolderState,
  dsmMetadata: Metadata
): Aug.NonFolderAug {
  try {
    return tryRawNonFolderToAug(item, dsmMetadata);
  } catch {
    return {
      id: item.id,
      secret: false,
      pinned: false,
      type: "text",
      text: item.type,
      error: true,
    };
  }
}

function tryRawNonFolderToAug(
  item: Graph.NonFolderState,
  dsmMetadata: Metadata
): Aug.NonFolderAug {
  const base = {
    id: item.id,
    pinned: dsmMetadata.expressions[item.id]?.pinned ?? false,
    secret: item.secret ?? false,
  };
  switch (item.type) {
    case "expression": {
      // TODO: make this pure instead of relying on Calc.controller.getItemModel
      // to inflate defaults. Unfortunately
      //   desmosRequire("core/graphing-calc/json/expression").inflateDefaults()
      // doesn't take into account the worker analysis points vs lines etc.
      const { points, lines, fill } = getReconciledExpressionProps(item.id);
      return {
        ...base,
        type: "expression",
        ...columnExpressionCommon(item, points, lines),
        ...(item.latex ? { latex: parseRootLatex(item.latex) } : {}),
        ...(item.labelSize !== "0" && item.label
          ? {
              label: {
                text: item.label,
                size: parseLatex(item.labelSize ?? "1"),
                orientation: item.labelOrientation ?? "default",
                angle: parseLatex(item.labelAngle ?? "0"),
                outline: !item.suppressTextOutline,
                showOnHover: item.interactiveLabel ?? false,
                editableMode: item.editableLabelMode ?? "NONE",
              },
            }
          : {}),
        fillOpacity: fill
          ? parseLatex(item.fillOpacity ?? "0.4")
          : parseLatex("0"),
        regression: item.residualVariable
          ? {
              residualVariable: parseLatex(
                item.residualVariable
              ) as Aug.Latex.Identifier,
              regressionParameters: new Map(
                Object.entries(item.regressionParameters ?? {}).map(
                  ([key, value]) => [
                    parseLatex(key) as Aug.Latex.Identifier,
                    value,
                  ]
                )
              ),
              isLogMode: !!item.isLogModeRegression,
            }
          : undefined,
        slider: {
          period: item.slider?.animationPeriod,
          loopMode: item.slider?.loopMode,
          playDirection: item.slider?.playDirection,
          isPlaying: item.slider?.isPlaying,
          min: item.slider?.min ? parseLatex(item.slider?.min) : undefined,
          max: item.slider?.max ? parseLatex(item.slider?.max) : undefined,
          step: item.slider?.step ? parseLatex(item.slider?.step) : undefined,
        },
        glesmos: dsmMetadata.expressions[item.id]?.glesmos ?? false,
        errorHidden: dsmMetadata.expressions[item.id]?.errorHidden ?? false,
        displayEvaluationAsFraction: item.displayEvaluationAsFraction ?? false,
        polarDomain: parseMapDomain(item.polarDomain, "0", "12\\pi"),
        parametricDomain: parseMapDomain(item.parametricDomain, "0", "1"),
        cdf: item.cdf?.show
          ? {
              min: item.cdf.min ? parseLatex(item.cdf.min) : undefined,
              max: item.cdf.max ? parseLatex(item.cdf.max) : undefined,
            }
          : undefined,
        vizProps: vizPropsAug(item),
        clickableInfo: item.clickableInfo?.latex
          ? {
              description: item.clickableInfo.description ?? "",
              latex: parseLatex(item.clickableInfo.latex),
            }
          : undefined,
      };
    }
    case "image":
      return {
        ...base,
        type: "image",
        image_url: item.image_url,
        name: item.name ?? "",
        width: parseLatex(item.width ?? "10"),
        // The height is not actually 10 by default
        height: parseLatex(item.height ?? "10"),
        center: parseLatex(item.center ?? "(0,0)"),
        angle: parseLatex(item.angle ?? "0"),
        // opacity = 0 corresponds to hidden: true
        opacity: parseLatex(item.opacity ?? "1"),
        foreground: item.foreground ?? false,
        draggable: item.draggable ?? false,
        clickableInfo: item.clickableInfo?.latex
          ? {
              description: item.clickableInfo.description ?? "",
              latex: parseLatex(item.clickableInfo.latex),
              hoveredImage: item.clickableInfo.hoveredImage,
              depressedImage: item.clickableInfo.depressedImage,
            }
          : undefined,
      };
    case "table": {
      const longestColumnLength = Math.max(
        ...item.columns.map((col) =>
          col.values.map((e) => e !== "").lastIndexOf(true)
        )
      );
      return {
        ...base,
        type: "table",
        columns: item.columns
          .filter((column) => column.latex !== undefined)
          .map((column) => ({
            type: "column",
            id: column.id,
            values: column.values
              .slice(0, longestColumnLength + 1)
              .map(parseLatex),
            ...columnExpressionCommon(
              column,
              column.points !== false,
              column.lines === true
            ),
            latex: parseLatex(column.latex!),
          })),
      };
    }
    case "text":
      return {
        ...base,
        type: "text",
        text: item.text ?? "",
      };
  }
}

function vizPropsAug(
  item: Graph.ExpressionState
): Aug.ExpressionAug["vizProps"] {
  const viz = item.vizProps ?? {};
  if (!viz) return {};
  const res: Aug.ExpressionAug["vizProps"] = {
    dotplotMode: viz.dotplotXMode,
    binAlignment: viz.binAlignment,
    histogramMode: viz.histogramMode,
  };
  if (
    viz.breadth ??
    viz.axisOffset ??
    viz.alignedAxis ??
    viz.showBoxplotOutliers
  ) {
    res.boxplot = {
      breadth: parseLatex(viz.breadth ?? "1"),
      axisOffset: parseLatex(viz.axisOffset ?? "1"),
      alignedAxis: viz.alignedAxis ?? "x",
      showOutliers: viz.showBoxplotOutliers ?? false,
    };
  }
  return res;
}

function parseMapDomain(
  domain: Graph.Domain | undefined,
  fallbackMin: string,
  fallbackMax: string
): Aug.DomainAug | undefined {
  if (!domain) return undefined;
  return {
    min: parseLatex(domain.min || fallbackMin),
    max: parseLatex(domain.max || fallbackMax),
  };
}

function columnExpressionCommon(
  item: Graph.TableColumn | Graph.ExpressionState,
  points: boolean,
  lines: boolean
) {
  const color = item.colorLatex ? parseLatex(item.colorLatex) : item.color;
  if (typeof color !== "string" && color.type !== "Identifier") {
    throw Error("Expected colorLatex to be an identifier");
  }
  return {
    color,
    hidden: item.hidden ?? false,
    // TODO: don't include points property by default for curves and polygons
    // Rely on Desmos's automatic detection?
    points:
      points && item.pointOpacity !== "0" && item.pointSize !== "0"
        ? {
            opacity: parseLatex(item.pointOpacity ?? "0.9"),
            size: parseLatex(item.pointSize ?? "9"),
            style: item.pointStyle ?? "POINT",
            dragMode: item.dragMode ?? "AUTO",
          }
        : undefined,
    lines:
      lines && item.lineOpacity !== "0" && item.lineWidth !== "0"
        ? {
            opacity: parseLatex(item.lineOpacity ?? "0.9"),
            width: parseLatex(item.lineWidth ?? "2.5"),
            style: item.lineStyle ?? "SOLID",
          }
        : undefined,
  };
}

function parseLatex(str: string): Aug.Latex.AnyChild {
  if (str === "") return { type: "Constant", value: NaN };
  const res = parseDesmosLatex(str);
  // childNodeToTree throws an error if res is not a child node
  return childNodeToTree(res);
}

function parseRootLatex(str: string): Aug.Latex.AnyRootOrChild {
  const parsed = parseDesmosLatex(str);
  switch (parsed.type) {
    case "Equation":
      return {
        type: "Equation",
        left: childNodeToTree(parsed._lhs),
        right: childNodeToTree(parsed._rhs),
      };
    case "Assignment":
      return {
        type: "Assignment",
        left: parseIdentifier(parsed._symbol),
        right: childNodeToTree(parsed._expression),
      };
    case "FunctionDefinition":
      return {
        type: "FunctionDefinition",
        symbol: parseIdentifier(parsed._symbol),
        argSymbols: parsed._argSymbols.map(parseIdentifier),
        definition: childNodeToTree(parsed._expression),
      };
    case "Stats":
    case "BoxPlot":
    case "DotPlot":
    case "Histogram":
    case "IndependentTTest":
    case "TTest":
      return {
        type: "Visualization",
        callee: {
          type: "Identifier",
          symbol: parsed.type,
        },
        args: parsed.args.map(childNodeToTree),
      };
    case "Regression":
      return {
        type: "Regression",
        left: childNodeToTree(parsed._lhs),
        right: childNodeToTree(parsed._rhs),
      };
    default:
      return childNodeToTree(parsed);
  }
}

function childNodeToTree(node: AnyNode): Aug.Latex.AnyChild {
  switch (node.type) {
    case "Constant":
    case "MixedNumber":
      if (typeof node._constantValue === "boolean") {
        throw Error(
          "Constant value is boolean, but expected rational or number"
        );
      }
      return {
        type: "Constant",
        value: evalMaybeRational(node._constantValue),
      };
    case "Identifier":
      return parseIdentifier(node._symbol);
    case "FunctionCall":
      return {
        type: "FunctionCall",
        callee: parseIdentifier(node._symbol),
        args: node.args.map(childNodeToTree),
      };
    case "SeededFunctionCall":
      return {
        type: "FunctionCall",
        callee: parseIdentifier(node._symbol),
        // exclude the seed
        args: node.args
          .filter((e) => e.type !== "ExtendSeed")
          .map((e) => childNodeToTree(e)),
      };
    case "Seed":
    case "ExtendSeed":
      throw Error(`Programming error: ${node.type} encountered`);
    case "FunctionExponent":
      return {
        type: "BinaryOperator",
        name: "Exponent",
        left: {
          type: "FunctionCall",
          callee: nodeToIdentifier(node.args[0]),
          args: [childNodeToTree(node.args[1])],
        },
        right: childNodeToTree(node.args[2]),
      };
    case "FunctionFactorial":
      return {
        type: "FunctionCall",
        callee: {
          type: "Identifier",
          symbol: "factorial",
        },
        args: [
          {
            type: "FunctionCall",
            callee: nodeToIdentifier(node.args[0]),
            args: [childNodeToTree(node.args[1])],
          },
        ],
      };
    case "Integral":
      return {
        type: "Integral",
        differential: nodeToIdentifier(node.args[0]),
        start: childNodeToTree(node.args[1]),
        end: childNodeToTree(node.args[2]),
        integrand: childNodeToTree(node.args[3]),
      };
    case "Derivative":
      return {
        type: "Derivative",
        arg: childNodeToTree(node.args[0]),
        variable: parseIdentifier(node._symbol),
      };
    case "Prime": {
      const primeArg = childNodeToTree(node.args[0]);
      if (primeArg.type !== "FunctionCall") {
        throw Error("Expected function call as argument of prime");
      }
      return {
        type: "Prime",
        arg: primeArg,
        order: node.order,
      };
    }
    case "List":
      return {
        type: "List",
        args: node.args.map(childNodeToTree),
      };
    case "Range":
      return {
        type: "Range",
        start: node.args[0].args.map(childNodeToTree),
        end: node.args[1].args.map(childNodeToTree),
      };
    case "ListAccess":
      return {
        type: "ListAccess",
        list: childNodeToTree(node.args[0]),
        index: childNodeToTree(node.args[1]),
      };
    case "DotAccess": {
      const prop = childNodeToTree(node.args[1]);
      if (prop.type !== "Identifier" && prop.type !== "FunctionCall") {
        throw Error(
          "Dot access property is not an identifier or function call"
        );
      }
      return {
        type: "DotAccess",
        object: childNodeToTree(node.args[0]),
        property: prop,
      };
    }
    case "OrderedPairAccess": {
      if (typeof node.index._constantValue === "boolean") {
        throw Error(
          "Ordered pair index is boolean, but expected rational or number"
        );
      }
      const indexValue = evalMaybeRational(node.index._constantValue);
      if (indexValue !== 1 && indexValue !== 2) {
        throw Error("Ordered pair index is neither 1 nor 2");
      }
      return {
        type: "OrderedPairAccess",
        point: childNodeToTree(node.point),
        index: indexValue === 1 ? "x" : "y",
      };
    }
    case "BareSeq":
    case "ParenSeq":
      return {
        type: "Seq",
        parenWrapped: node.type === "ParenSeq",
        args: node.args.map(childNodeToTree),
      };
    case "UpdateRule":
      return {
        type: "UpdateRule",
        variable: parseIdentifier(node._symbol),
        expression: childNodeToTree(node._expression),
      };
    case "ListComprehension":
      return {
        type: "ListComprehension",
        expr: childNodeToTree(node.args[1]),
        assignments: node.args.slice(2).map((n) => {
          return assignmentExprToTree(n);
        }),
      };
    case "Piecewise": {
      const conditionNode = node.args[0];
      const condition =
        conditionNode.type === "Constant" &&
        conditionNode._constantValue === true
          ? true
          : childNodeToTree(conditionNode);
      if (
        condition !== true &&
        condition.type !== "Comparator" &&
        condition.type !== "DoubleInequality"
      ) {
        throw Error(
          "Expected condition of Piecewise to be a Comparator, DoubleInequality, or true"
        );
      }
      return {
        type: "Piecewise",
        condition,
        consequent: childNodeToTree(node.args[1]),
        alternate: childNodeToTree(node.args[2]),
      };
    }
    case "Product":
    case "Sum":
      return {
        type: "RepeatedOperator",
        name: node.type,
        index: nodeToIdentifier(node._index),
        start: childNodeToTree(node.args[1]),
        end: childNodeToTree(node.args[2]),
        expression: childNodeToTree(node.args[3]),
      };
    case "Add":
    case "Subtract":
    case "Multiply":
    case "Divide":
    case "Exponent":
      return {
        type: "BinaryOperator",
        name: node.type,
        left: childNodeToTree(node.args[0]),
        right: childNodeToTree(node.args[1]),
      };
    case "Negative":
      return {
        type: "Negative",
        arg: childNodeToTree(node.args[0]),
      };
    case "And":
      return {
        type: "DoubleInequality",
        // We know these are comparators because the args are comparators
        left: childNodeToTree(node.args[0].args[0]),
        leftOperator: node.args[0].operator,
        middle: childNodeToTree(node.args[0].args[1]),
        rightOperator: node.args[1].operator,
        right: childNodeToTree(node.args[1].args[1]),
      };
    case "DoubleInequality":
      return {
        type: "DoubleInequality",
        left: childNodeToTree(node.args[0]),
        leftOperator: node.args[1] as "<" | "<=" | "=" | ">=" | ">",
        middle: childNodeToTree(node.args[2]),
        rightOperator: node.args[3] as "<" | "<=" | "=" | ">=" | ">",
        right: childNodeToTree(node.args[4]),
      };
    case "Comparator['<']":
    case "Comparator['<=']":
    case "Comparator['=']":
    case "Comparator['>=']":
    case "Comparator['>']":
      return {
        type: "Comparator",
        operator: node.operator,
        left: childNodeToTree(node.args[0]),
        right: childNodeToTree(node.args[1]),
      };
    case "Error":
      throw Error("Parsing threw an error");
    default:
      throw Error(`Programming Error: Unexpected raw node ${node.type}`);
  }
}

function assignmentExprToTree(
  node: ChildExprNode
): Aug.Latex.AssignmentExpression {
  if (node.type !== "AssignmentExpression")
    throw Error(
      "Programming Error: expected AssignmentExpression in list comprehension"
    );
  return {
    type: "AssignmentExpression",
    variable: nodeToIdentifier(node.args[0]),
    expression: childNodeToTree(node.args[1]),
  };
}

function nodeToIdentifier(node: ChildExprNode) {
  if (node.type !== "Identifier") {
    throw Error("Expected identifier");
  }
  return parseIdentifier(node._symbol);
}

/**
 * Does not check if `str` is a valid identifier
 */
function parseIdentifier(str: string): Aug.Latex.Identifier {
  return {
    type: "Identifier",
    symbol: str,
  };
}
