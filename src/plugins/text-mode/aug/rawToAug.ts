import {
  Domain,
  ExpressionState,
  FolderState,
  GraphState,
  ItemState,
  NonFolderState,
  TableColumn,
} from "@desmodder/graph-state";
import { parseDesmosLatex } from "desmodder";
import Latex, { ChildNode, Comparator, Identifier } from "./AugLatex";
import AugState, {
  FolderAug,
  ItemAug,
  ExpressionAug,
  NonFolderAug,
} from "./AugState";
import { ChildExprNode, evalMaybeRational } from "parsing/parsenode";
import migrateToLatest from "main/metadata/migrate";
import Metadata from "main/metadata/interface";

export default function rawToAug(raw: GraphState): AugState {
  const dsmMetadataExpr = raw.expressions.list.find(
    (e) => e.id === "dsm-metadata"
  );
  const dsmMetadata = migrateToLatest(
    dsmMetadataExpr?.type === "text"
      ? JSON.parse(dsmMetadataExpr.text ?? "{}")
      : {}
  );
  const res: AugState = {
    version: 9,
    randomSeed: raw.randomSeed,
    graph: raw.graph,
    expressions: {
      list: rawListToAug(raw.expressions.list, dsmMetadata),
    },
  };
  const ticker = raw.expressions.ticker;
  if (ticker && ticker.handlerLatex) {
    res.expressions.ticker = {
      handlerLatex: parseLatex(ticker.handlerLatex),
      minStepLatex: parseLatex(ticker.minStepLatex ?? "0"),
      playing: ticker.playing ?? false,
    };
  }
  return res;
}

function rawListToAug(list: ItemState[], dsmMetadata: Metadata): ItemAug[] {
  const res: ItemAug[] = [];
  let currentFolder: null | FolderAug = null;
  for (let item of list) {
    if (item.id === "dsm-metadata-folder" || item.id === "dsm-metadata") {
      continue;
    }
    if (item.type === "folder") {
      currentFolder = rawFolderToAug(item, dsmMetadata);
      res.push(currentFolder);
    } else {
      const augItem = rawNonFolderToAug(item, dsmMetadata);
      if (item.folderId) {
        if (!currentFolder || item.folderId !== currentFolder.id) {
          throw "Folder ID inconsistent";
        }
        currentFolder.children.push(augItem);
      } else {
        res.push(augItem);
      }
    }
  }
  return res;
}

function rawFolderToAug(item: FolderState, dsmMetadata: Metadata): FolderAug {
  return {
    type: "folder" as const,
    id: item.id,
    secret: item.secret ?? false,
    pinned: dsmMetadata.expressions[item.id]?.pinned ?? false,
    hidden: item.hidden ?? false,
    collapsed: item.collapsed ?? false,
    title: item.title ?? "",
    children: [],
  };
}

function rawNonFolderToAug(
  item: NonFolderState,
  dsmMetadata: Metadata
): NonFolderAug {
  const base = {
    id: item.id,
    pinned: dsmMetadata.expressions[item.id]?.pinned ?? false,
    secret: item.secret ?? false,
  };
  switch (item.type) {
    case "expression":
      return {
        ...base,
        type: "expression",
        ...columnExpressionCommon(item),
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
        fillOpacity: item.fill
          ? parseLatex(item.fillOpacity ?? "0.4")
          : parseLatex("0"),
        regression: item.residualVariable
          ? {
              residualVariable: parseIdentifier(item.residualVariable),
              regressionParameters: item.regressionParameters ?? {},
              isLogMode: !!item.isLogModeRegression,
            }
          : undefined,
        slider: {
          animationPeriod: item.slider?.animationPeriod,
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
        polarDomain: parseMapDomain(item.polarDomain),
        parametricDomain: parseMapDomain(item.parametricDomain),
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
        opacity: parseLatex(item.opacity ?? "0"),
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
    case "table":
      return {
        ...base,
        type: "table",
        columns: item.columns.map((column) => ({
          id: column.id,
          values: column.values.map(parseLatex),
          ...columnExpressionCommon(column),
        })),
      };
    case "text":
      return {
        ...base,
        type: "text",
        text: item.text ?? "",
      };
  }
}

function vizPropsAug(item: ExpressionState): ExpressionAug["vizProps"] {
  const viz = item.vizProps ?? {};
  if (!viz) return {};
  const res: ExpressionAug["vizProps"] = {
    dotplotMode: viz.dotplotXMode,
    binAlignment: viz.binAlignment,
    histogramMode: viz.histogramMode,
  };
  if (
    viz.breadth ||
    viz.axisOffset ||
    viz.alignedAxis ||
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

function parseMapDomain(domain: Domain | undefined) {
  if (!domain) return undefined;
  return {
    min: parseLatex(domain.min),
    max: parseLatex(domain.max),
  };
}

function columnExpressionCommon(item: TableColumn | ExpressionState) {
  const color = item.colorLatex ? parseLatex(item.colorLatex) : item.color;
  if (typeof color !== "string" && color.type !== "Identifier") {
    throw "Expected colorLatex to be an identifier";
  }
  return {
    color: color,
    ...(item.latex ? { latex: parseLatex(item.latex) } : {}),
    hidden: item.hidden ?? false,
    points:
      item.points && item.pointOpacity !== "0" && item.pointSize !== "0"
        ? {
            opacity: parseLatex(item.pointOpacity ?? "0.9"),
            size: parseLatex(item.pointSize ?? "9"),
            style: item.pointStyle ?? "POINT",
            dragMode: item.dragMode ?? "AUTO",
          }
        : undefined,
    lines:
      item.lines && item.lineOpacity !== "0" && item.lineWidth !== "0"
        ? {
            opacity: parseLatex(item.lineOpacity ?? "0.9"),
            width: parseLatex(item.lineWidth ?? "2.5"),
            style: item.lineStyle ?? "SOLID",
          }
        : undefined,
  };
}

function parseLatex(str: string): Latex {
  const parsed = parseDesmosLatex(str);
  switch (parsed.type) {
    case "Equation":
      return {
        type: "Equation",
        left: nodeToTree(parsed._lhs),
        right: nodeToTree(parsed._rhs),
      };
    case "Assignment":
      return {
        type: "Assignment",
        left: parseIdentifier(parsed._symbol),
        right: nodeToTree(parsed._expression),
      };
    case "FunctionDefinition":
      return {
        type: "FunctionDefinition",
        symbol: parseIdentifier(parsed._symbol),
        argSymbols: parsed._argSymbols.map(parseIdentifier),
        definition: nodeToTree(parsed._expression),
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
        args: parsed.args.map(nodeToTree),
      };
    case "Regression":
      return {
        type: "Regression",
        left: nodeToTree(parsed._lhs),
        right: nodeToTree(parsed._rhs),
      };
    default:
      return nodeToTree(parsed);
  }
}

function nodeToTree(node: ChildExprNode): ChildNode {
  switch (node.type) {
    case "Constant":
    case "MixedNumber":
      if (typeof node._constantValue === "boolean") {
        throw "Constant value is boolean, but expected rational or number";
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
        args: node.args.map(nodeToTree),
      };
    case "SeededFunctionCall":
      return {
        type: "FunctionCall",
        callee: parseIdentifier(node._symbol),
        // exclude the seed
        args: node.args
          .filter((e) => e.type !== "ExtendSeed")
          .map((e) => nodeToTree(e as ChildExprNode)),
      };
    case "Seed":
    case "ExtendSeed":
      throw `Programming error: ${node.type} encountered`;
    case "FunctionExponent":
      return {
        type: "BinaryOperator",
        name: "Exponent",
        left: {
          type: "FunctionCall",
          callee: nodeToIdentifier(node.args[0]),
          args: [nodeToTree(node.args[1])],
        },
        right: nodeToTree(node.args[2]),
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
            args: [nodeToTree(node.args[1])],
          },
        ],
      };
    case "Integral":
      return {
        type: "Integral",
        differential: nodeToIdentifier(node.args[0]),
        start: nodeToTree(node.args[1]),
        end: nodeToTree(node.args[2]),
        integrand: nodeToTree(node.args[3]),
      };
    case "Derivative":
      return {
        type: "Derivative",
        arg: nodeToTree(node.args[0]),
        variable: parseIdentifier(node._symbol),
      };
    case "Prime":
      const primeArg = nodeToTree(node.args[0]);
      if (primeArg.type !== "FunctionCall") {
        throw "Expected function call as argument of prime";
      }
      return {
        type: "Prime",
        arg: primeArg,
        order: node.order,
      };
    case "List":
      return {
        type: "List",
        args: node.args.map(nodeToTree),
      };
    case "List":
      return {
        type: "List",
        args: node.args.map(nodeToTree),
      };
    case "Range":
      return {
        type: "Range",
        start: node.args[0].args.map(nodeToTree),
        end: node.args[1].args.map(nodeToTree),
      };
    case "ListAccess":
      return {
        type: "ListAccess",
        list: nodeToTree(node.args[0]),
        index: nodeToTree(node.args[1]),
      };
    case "DotAccess":
      const prop = nodeToTree(node.args[1]);
      if (prop.type !== "Identifier" && prop.type !== "FunctionCall") {
        throw "Dot access property is not an identifier or function call";
      }
      return {
        type: "DotAccess",
        object: nodeToTree(node.args[0]),
        property: prop,
      };
    case "OrderedPairAccess":
      if (typeof node.index._constantValue === "boolean") {
        throw "Ordered pair index is boolean, but expected rational or number";
      }
      const indexValue = evalMaybeRational(node.index._constantValue);
      if (indexValue !== 1 && indexValue !== 2) {
        throw "Ordered pair index is neither 1 nor 2";
      }
      return {
        type: "OrderedPairAccess",
        point: nodeToTree(node.point),
        index: indexValue === 1 ? "x" : "y",
      };
    case "BareSeq":
    case "ParenSeq":
      return {
        type: "Seq",
        parenWrapped: node.type === "ParenSeq",
        args: node.args.map(nodeToTree),
      };
    case "UpdateRule":
      return {
        type: "UpdateRule",
        variable: parseIdentifier(node._symbol),
        expression: nodeToTree(node._expression),
      };
    case "AssignmentExpression":
      return {
        type: "AssignmentExpression",
        variable: nodeToIdentifier(node.args[0]),
        expression: nodeToTree(node.args[1]),
      };
    case "ListComprehension":
      return {
        type: "ListComprehension",
        expr: nodeToTree(node.args[1]),
        assignments: node.args.slice(2).map((n) => {
          const expr = nodeToTree(n);
          if (expr.type !== "AssignmentExpression") {
            throw "ListComprehension contains unexpected non-AssignmentExpression";
          }
          return expr;
        }),
      };
    case "Piecewise":
      const condition = nodeToTree(node.args[0]);
      if (condition.type !== "Comparator" && condition.type !== "And") {
        throw "Expected condition of Piecewise to be a Comparator or And";
      }
      return {
        type: "Piecewise",
        condition: condition,
        consequent: nodeToTree(node.args[1]),
        alternate: nodeToTree(node.args[2]),
      };
    case "Product":
    case "Sum":
      return {
        type: "RepeatedOperator",
        name: node.type,
        index: nodeToIdentifier(node._index),
        start: nodeToTree(node.args[1]),
        end: nodeToTree(node.args[2]),
        expression: nodeToTree(node.args[3]),
      };
    case "Add":
    case "Subtract":
    case "Multiply":
    case "Divide":
    case "Exponent":
      return {
        type: "BinaryOperator",
        name: node.type,
        left: nodeToTree(node.args[0]),
        right: nodeToTree(node.args[1]),
      };
    case "Negative":
      return {
        type: "Negative",
        arg: nodeToTree(node.args[0]),
      };
    case "And":
      return {
        type: "And",
        // We know these are comparators because the args are comparators
        left: nodeToTree(node.args[0]) as Comparator,
        right: nodeToTree(node.args[1]) as Comparator,
      };
    case "DoubleInequality":
      const doubleInequalityMiddle = nodeToTree(node.args[2]);
      return {
        type: "And",
        left: {
          type: "Comparator",
          left: nodeToTree(node.args[0]),
          right: doubleInequalityMiddle,
          symbol: node.args[1] as "<" | "<=" | "=" | ">=" | ">",
        },
        right: {
          type: "Comparator",
          left: doubleInequalityMiddle,
          right: nodeToTree(node.args[4]),
          symbol: node.args[3] as "<" | "<=" | "=" | ">=" | ">",
        },
      };
    case "Comparator['<']":
    case "Comparator['<=']":
    case "Comparator['=']":
    case "Comparator['>=']":
    case "Comparator['>']":
      return {
        type: "Comparator",
        symbol: node.operator,
        left: nodeToTree(node.args[0]),
        right: nodeToTree(node.args[1]),
      };
    case "Error":
      throw "Parsing threw an error";
  }
}

function nodeToIdentifier(node: ChildExprNode) {
  if (node.type !== "Identifier") {
    throw "Expected identifier";
  }
  return parseIdentifier(node._symbol);
}

/**
 * Does not check if `str` is a valid identifier
 */
function parseIdentifier(str: string): Identifier {
  return {
    type: "Identifier",
    symbol: str,
  };
}
