// eslint-disable-next-line rulesdir/no-reach-past-exports
import Metadata from "../../metadata/interface";
// eslint-disable-next-line rulesdir/no-reach-past-exports
import migrateToLatest from "../../metadata/migrate";
import {
  ChildExprNode,
  evalMaybeRational,
  AnyNode,
  // eslint-disable-next-line rulesdir/no-reach-past-exports
} from "../../parsing/parsenode";
import { Config } from "../TextModeConfig";
import Aug from "./AugState";
import type * as Graph from "@desmodder/graph-state";

export default function rawToAug(
  cfg: Config,
  raw: Graph.GraphState
): Aug.State {
  const dsmMetadata = rawToDsmMetadata(raw);
  const res: Aug.State = {
    version: 9,
    settings: rawToAugSettings(raw),
    expressions: {
      list: rawListToAug(cfg, raw.expressions.list, dsmMetadata),
    },
  };
  const ticker = raw.expressions.ticker;
  if (ticker?.handlerLatex) {
    res.expressions.ticker = {
      handlerLatex: parseLatex(cfg, ticker.handlerLatex),
      minStepLatex: parseLatex(cfg, ticker.minStepLatex ?? "0"),
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
  cfg: Config,
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
      const augItem = rawNonFolderToAug(cfg, item, dsmMetadata);
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
  cfg: Config,
  item: Graph.NonFolderState,
  dsmMetadata: Metadata
): Aug.NonFolderAug {
  try {
    return tryRawNonFolderToAug(cfg, item, dsmMetadata);
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
  cfg: Config,
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
      let latex;
      if (item.latex) {
        try {
          latex = parseRootLatex(cfg, item.latex);
        } catch {
          return {
            ...base,
            type: "text",
            text: item.latex,
            error: true,
          };
        }
      }
      return {
        ...base,
        type: "expression",
        ...columnExpressionCommon(cfg, item),
        ...(latex ? { latex } : {}),
        ...(item.labelSize !== "0" && item.label && item.showLabel
          ? {
              label: {
                text: item.label,
                size: parseLatex(cfg, item.labelSize ?? "1"),
                orientation: item.labelOrientation ?? "default",
                angle: parseLatex(cfg, item.labelAngle ?? "0"),
                outline: !item.suppressTextOutline,
                showOnHover: item.interactiveLabel ?? false,
                editableMode: item.editableLabelMode ?? "NONE",
              },
            }
          : {}),
        fillOpacity:
          item.fill === false
            ? parseLatex(cfg, "0")
            : parseMaybeLatex(
                cfg,
                item.fillOpacity === "0"
                  ? "2^{-99}"
                  : item.fillOpacity ?? (item.fill ? "0.4" : undefined)
              ),
        regression: item.residualVariable
          ? {
              residualVariable: parseLatex(
                cfg,
                item.residualVariable
              ) as Aug.Latex.Identifier,
              regressionParameters: new Map(
                Object.entries(item.regressionParameters ?? {}).map(
                  ([key, value]) => [
                    parseLatex(cfg, key) as Aug.Latex.Identifier,
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
          min: item.slider?.min ? parseLatex(cfg, item.slider?.min) : undefined,
          max: item.slider?.max ? parseLatex(cfg, item.slider?.max) : undefined,
          step: item.slider?.step
            ? parseLatex(cfg, item.slider?.step)
            : undefined,
        },
        glesmos: dsmMetadata.expressions[item.id]?.glesmos ?? false,
        errorHidden: dsmMetadata.expressions[item.id]?.errorHidden ?? false,
        displayEvaluationAsFraction: item.displayEvaluationAsFraction ?? false,
        polarDomain: parseMapDomain(cfg, item.polarDomain, "0", "12\\pi"),
        parametricDomain: parseMapDomain(cfg, item.parametricDomain, "0", "1"),
        cdf: item.cdf?.show
          ? {
              min: item.cdf.min ? parseLatex(cfg, item.cdf.min) : undefined,
              max: item.cdf.max ? parseLatex(cfg, item.cdf.max) : undefined,
            }
          : undefined,
        vizProps: vizPropsAug(cfg, item),
        clickableInfo: item.clickableInfo?.latex
          ? {
              description: item.clickableInfo.description ?? "",
              latex: parseLatex(cfg, item.clickableInfo.latex),
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
        width: parseLatex(cfg, item.width ?? "10"),
        // The height is not actually 10 by default
        height: parseLatex(cfg, item.height ?? "10"),
        center: parseLatex(cfg, item.center ?? "(0,0)"),
        angle: parseLatex(cfg, item.angle ?? "0"),
        // opacity = 0 corresponds to hidden: true
        opacity: parseLatex(cfg, item.hidden ? "0" : item.opacity ?? "1"),
        foreground: item.foreground ?? false,
        draggable: item.draggable ?? false,
        clickableInfo: item.clickableInfo?.latex
          ? {
              description: item.clickableInfo.description ?? "",
              latex: parseLatex(cfg, item.clickableInfo.latex),
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
              .map((s) => parseLatex(cfg, s)),
            ...columnExpressionCommon(cfg, column),
            latex: parseLatex(cfg, column.latex!),
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
  cfg: Config,
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
      breadth: parseLatex(cfg, viz.breadth ?? "1"),
      axisOffset: parseLatex(cfg, viz.axisOffset ?? "1"),
      alignedAxis: viz.alignedAxis ?? "x",
      showOutliers: viz.showBoxplotOutliers ?? false,
    };
  }
  return res;
}

function parseMapDomain(
  cfg: Config,
  domain: Graph.Domain | undefined,
  fallbackMin: string,
  fallbackMax: string
): Aug.DomainAug | undefined {
  if (!domain) return undefined;
  return {
    min: parseLatex(cfg, domain.min || fallbackMin),
    max: parseLatex(cfg, domain.max || fallbackMax),
  };
}

function columnExpressionCommon(
  cfg: Config,
  item: Graph.TableColumn | Graph.ExpressionState
) {
  const color = item.colorLatex ? parseLatex(cfg, item.colorLatex) : item.color;
  return {
    color,
    hidden: item.hidden ?? false,
    points:
      item.points === false ||
      item.pointOpacity === "0" ||
      item.pointSize === "0"
        ? { size: parseLatex(cfg, "0") }
        : item.points === true ||
          item.pointOpacity !== undefined ||
          item.pointSize !== undefined ||
          item.dragMode !== undefined
        ? {
            opacity: parseMaybeLatex(cfg, item.pointOpacity),
            size: parseMaybeLatex(cfg, item.pointSize),
            style: item.pointStyle,
            dragMode: item.dragMode,
          }
        : undefined,
    lines:
      item.lines === false || item.lineOpacity === "0" || item.lineWidth === "0"
        ? { width: parseLatex(cfg, "0") }
        : item.lines === true ||
          item.lineOpacity !== undefined ||
          item.lineWidth !== undefined
        ? {
            opacity: parseMaybeLatex(cfg, item.lineOpacity),
            width: parseMaybeLatex(cfg, item.lineWidth),
            style: item.lineStyle,
          }
        : undefined,
  };
}

function parseMaybeLatex(cfg: Config, str: string | undefined) {
  return str !== undefined ? parseLatex(cfg, str) : undefined;
}

export function parseLatex(cfg: Config, str: string): Aug.Latex.AnyChild {
  if (str === "") return { type: "Constant", value: NaN };
  const res = cfg.parseDesmosLatex(str);
  // childNodeToTree throws an error if res is not a child node
  return childNodeToTree(res);
}

export function parseRootLatex(
  cfg: Config,
  str: string
): Aug.Latex.AnyRootOrChild {
  const parsed = cfg.parseDesmosLatex(str);
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
          symbol: vizSymbol[parsed.type],
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

const vizSymbol = {
  Stats: "stats",
  BoxPlot: "boxplot",
  DotPlot: "dotplot",
  Histogram: "histogram",
  IndependentTTest: "IndependentTTest",
  TTest: "TTest",
} as const;

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
    case "Norm":
      return {
        type: "Norm",
        arg: childNodeToTree(node.args[0]),
      };
    case "FunctionCall":
      if (node._symbol === "factorial" && node.args.length === 1)
        return { type: "Factorial", arg: childNodeToTree(node.args[0]) };
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
        type: "Factorial",
        arg: {
          type: "FunctionCall",
          callee: nodeToIdentifier(node.args[0]),
          args: [childNodeToTree(node.args[1])],
        },
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
    case "NamedCoordinateAccess": {
      return {
        type: "OrderedPairAccess",
        point: childNodeToTree(node.args[0]),
        index: node.symbol,
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
        assignments: node.args.slice(2).map(assignmentExprToTree),
      };
    case "Substitution":
      return {
        type: "Substitution",
        body: childNodeToTree(node.args[0]),
        assignments: node.args.slice(1).map(assignmentExprToTree),
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
    case "DotMultiply":
    case "CrossMultiply":
    case "Divide":
    case "Exponent":
      return {
        type: "BinaryOperator",
        name:
          node.type === "DotMultiply" || node.type === "CrossMultiply"
            ? "Multiply"
            : node.type,
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
      throw new Error("Parsing threw an error");
    case "Equation":
    case "Assignment":
    case "FunctionDefinition":
    case "Stats":
    case "AssignmentExpression":
    case "Ans":
    case "DotPlot":
    case "BoxPlot":
    case "Histogram":
    case "IndependentTTest":
    case "TTest":
    case "Regression":
    case "RGBColor":
    case "Image":
    case "Ticker":
    case "SolvedEquation":
    case "Slider":
    case "OptimizedRegression":
    case "IRExpression":
    case "Table":
    case "TableColumn":
      throw new Error(
        `Programming Error: Expected parsenode ${node.type} to not be created`
      );
    default:
      node satisfies never;
      throw new Error(
        `Programming Error: Unexpected raw node ${(node as any).type}`
      );
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
