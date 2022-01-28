import {
  FolderState,
  GraphState,
  ColumnExpressionShared,
  NonFolderState,
} from "@desmodder/graph-state";
import Latex, { ChildLatex, Identifier, isConstant } from "./AugLatex";
import AugState, {
  FolderAug,
  ItemAug,
  ExpressionAug,
  NonFolderAug,
  TableColumnAug,
  DomainAug,
  TickerAug,
} from "./AugState";
import Metadata from "main/metadata/interface";
import { changeExprInMetadata, isBlankMetadata } from "main/metadata/manage";
import { autoCommandNames } from "utils/depUtils";

export default function augToRaw(aug: AugState): GraphState {
  const list = [];
  const dsmMetadata = {
    version: 2 as const,
    expressions: {},
  };
  for (let expr of aug.expressions.list) {
    updateDsmMetadata(dsmMetadata, expr);
    if (expr.type === "folder") {
      list.push(augFolderToRaw(expr));
      for (let child of expr.children) {
        updateDsmMetadata(dsmMetadata, child);
        list.push({
          ...augNonFolderToRaw(child),
          folderId: expr.id,
        });
      }
    } else {
      list.push(augNonFolderToRaw(expr));
    }
  }
  if (!isBlankMetadata(dsmMetadata)) {
    list.push(
      {
        type: "folder",
        id: "dsm-metadata-folder",
        secret: true,
        title: "DesModder Metadata",
      } as const,
      {
        type: "text",
        id: "dsm-metadata",
        folderId: "dsm-metadata-folder",
        text: JSON.stringify(dsmMetadata),
      } as const
    );
  }
  const randomSeed = aug.settings.randomSeed;
  delete aug.settings.randomSeed;
  const res: GraphState = {
    version: 9,
    randomSeed: randomSeed,
    graph: aug.settings,
    expressions: {
      list: list,
      ticker: aug.expressions.ticker && augTickerToRaw(aug.expressions.ticker),
    },
  };
  cleanUndefined(res);
  return res;
}

function cleanUndefined(obj: any): void {
  if (typeof obj === "object") {
    for (let key in obj) {
      if (obj.hasOwnProperty(key) && obj[key] === undefined) {
        delete obj[key];
      } else {
        cleanUndefined(obj[key]);
      }
    }
  }
}

function augTickerToRaw(ticker: TickerAug) {
  return {
    handlerLatex: latexTreeToString(ticker.handlerLatex),
    minStepLatex: latexTreeToString(ticker.minStepLatex),
    playing: ticker.playing,
  };
}

function updateDsmMetadata(dsmMetadata: Metadata, expr: ItemAug): void {
  if (expr.pinned) {
    changeExprInMetadata(dsmMetadata, expr.id, { pinned: true });
  }
  if (expr.type === "expression") {
    if (expr.errorHidden) {
      changeExprInMetadata(dsmMetadata, expr.id, { errorHidden: true });
    }
    if (expr.glesmos) {
      changeExprInMetadata(dsmMetadata, expr.id, { glesmos: true });
    }
  }
}

function augFolderToRaw(expr: FolderAug): FolderState {
  return {
    id: expr.id,
    secret: expr.secret,
    type: "folder",
    hidden: expr.hidden,
    collapsed: expr.collapsed,
    title: expr.title,
  };
}

function augNonFolderToRaw(item: NonFolderAug): NonFolderState {
  const base = {
    id: item.id,
    secret: item.secret,
  };
  switch (item.type) {
    case "expression":
      const shouldFill = item.fillOpacity
        ? !isConstant(item.fillOpacity, 0)
        : false;
      return {
        ...base,
        type: "expression",
        ...columnExpressionCommon(item),
        fill: shouldFill,
        fillOpacity: shouldFill
          ? latexTreeToStringMaybe(item.fillOpacity)
          : undefined,
        residualVariable: latexTreeToStringMaybe(
          item.regression?.residualVariable
        ),
        regressionParameters: item.regression?.regressionParameters,
        isLogModeRegression: item.regression?.isLogMode,
        ...(item.label
          ? {
              label: item.label.text,
              showLabel: true,
              labelSize: latexTreeToString(item.label.size),
              labelOrientation: item.label.orientation,
              labelAngle: latexTreeToString(item.label.angle),
              suppressTextOutline: !item.label.outline,
              interactiveLabel: item.label.showOnHover,
              editableLabelMode:
                item.label.editableMode === "NONE"
                  ? undefined
                  : item.label.editableMode,
            }
          : {}),
        slider: {
          animationPeriod: item.slider.period,
          loopMode: item.slider.loopMode,
          playDirection: item.slider.playDirection,
          isPlaying: item.slider.isPlaying,
          hardMin: !!item.slider.min,
          min: latexTreeToStringMaybe(item.slider.min),
          hardMax: !!item.slider.max,
          max: latexTreeToStringMaybe(item.slider.max),
          step: latexTreeToStringMaybe(item.slider.step),
        },
        displayEvaluationAsFraction: item.displayEvaluationAsFraction,
        polarDomain: latexMapDomain(item.polarDomain),
        parametricDomain: latexMapDomain(item.parametricDomain),
        domain: latexMapDomain(item.parametricDomain),
        cdf: item.cdf && {
          show: true,
          min: latexTreeToStringMaybe(item.cdf.min),
          max: latexTreeToStringMaybe(item.cdf.max),
        },
        vizProps: {
          breadth: latexTreeToStringMaybe(item.vizProps.boxplot?.breadth),
          axisOffset: latexTreeToStringMaybe(item.vizProps.boxplot?.axisOffset),
          alignedAxis: item.vizProps.boxplot?.alignedAxis,
          showBoxplotOutliers: item.vizProps.boxplot?.showOutliers,
          dotplotXMode: item.vizProps.dotplotMode,
          binAlignment: item.vizProps.binAlignment,
          histogramMode: item.vizProps.histogramMode,
        },
        clickableInfo: item.clickableInfo && {
          enabled: true,
          description: item.clickableInfo.description,
          latex: latexTreeToString(item.clickableInfo.latex),
        },
      };
    case "image":
      return {
        ...base,
        type: "image",
        image_url: item.image_url,
        name: item.name,
        width: latexTreeToString(item.width),
        height: latexTreeToString(item.height),
        hidden: isConstant(item.opacity, 0),
        center: latexTreeToString(item.center),
        angle: latexTreeToString(item.angle),
        opacity: latexTreeToString(item.opacity),
        foreground: item.foreground,
        draggable: item.draggable,
        clickableInfo: item.clickableInfo && {
          enabled: true,
          description: item.clickableInfo.description,
          latex: latexTreeToString(item.clickableInfo.latex),
          hoveredImage: item.clickableInfo.hoveredImage,
          depressedImage: item.clickableInfo.depressedImage,
        },
      };
    case "table":
      return {
        ...base,
        type: "table",
        columns: item.columns.map((column) => ({
          values: column.values.map(latexTreeToString),
          id: column.id,
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

function latexMapDomain(domain: DomainAug | undefined) {
  if (!domain) {
    return undefined;
  } else {
    return {
      min: latexTreeToString(domain.min),
      max: latexTreeToString(domain.max),
    };
  }
}

function columnExpressionCommon(item: TableColumnAug | ExpressionAug) {
  const res: ColumnExpressionShared = {
    color: "",
    hidden: item.hidden,
    latex: latexTreeToStringMaybe(item.latex),
  };
  if (typeof item.color === "string") {
    res.color = item.color;
  } else {
    // default to red if latex
    res.color = "#c74440";
    res.colorLatex = identifierToString(item.color);
  }
  if (item.points) {
    res.points = true;
    res.pointOpacity = latexTreeToString(item.points.opacity);
    res.pointSize = latexTreeToString(item.points.opacity);
    res.pointStyle = item.points.style;
    res.dragMode = item.points.dragMode;
  }
  if (item.lines) {
    res.lines = true;
    res.lineOpacity = latexTreeToString(item.lines.opacity);
    res.lineWidth = latexTreeToString(item.lines.width);
    res.lineStyle = item.lines.style;
  }
  return res;
}

function wrapParen(s: string) {
  return "\\left(" + s + "\\right)";
}

function wrapBracket(s: string) {
  return "\\left[" + s + "\\right]";
}

function latexTreeToStringMaybe(e: Latex | undefined) {
  if (!e) return undefined;
  return latexTreeToString(e);
}

function latexTreeToString(e: Latex) {
  switch (e.type) {
    case "Equation":
    case "Assignment":
      return childNodeToString(e.left) + "=" + childNodeToString(e.right);
    case "FunctionDefinition":
      return (
        funcToString(e.symbol, e.argSymbols) +
        "=" +
        childNodeToString(e.definition)
      );
    case "Visualization":
      // Lower case handles "Stats" → "stats" etc
      return funcToString(e.callee, e.args);
    case "Regression":
      return childNodeToString(e.left) + "\\sim " + childNodeToString(e.right);
    default:
      return childNodeToString(e);
  }
}

function childNodeToString(e: ChildLatex): string {
  switch (e.type) {
    case "Constant":
      return e.value.toString();
    case "Identifier":
      return identifierToString(e);
    case "FunctionCall":
      return funcToString(e.callee, e.args);
    case "Integral":
      return (
        `\\int_{${childNodeToString(e.start)}}` +
        `^{${childNodeToString(e.end)}}` +
        wrapParen(childNodeToString(e.integrand)) +
        "d" +
        identifierToString(e.differential)
      );
    case "Derivative":
      return (
        `\\frac{d}{d${identifierToString(e.variable)}}` +
        childNodeToString(e.arg)
      );
    case "Prime":
      return (
        identifierToString(e.arg.callee) +
        "'".repeat(e.order) +
        wrapParen(childNodeToString(e.arg.args[0]))
      );
    case "List":
      return wrapBracket(bareSeq(e.args));
    case "Range":
      return wrapBracket(bareSeq(e.start) + "..." + bareSeq(e.end));
    case "ListAccess":
      return (
        wrapParen(childNodeToString(e.list)) +
        (e.index.type === "Range"
          ? childNodeToString(e.index)
          : wrapBracket(childNodeToString(e.index)))
      );
    case "DotAccess":
      return (
        wrapParen(childNodeToString(e.object)) +
        "." +
        childNodeToString(e.property)
      );
    case "OrderedPairAccess":
      return wrapParen(childNodeToString(e.point)) + "." + e.index;
    case "Seq":
      return e.parenWrapped ? wrapParen(bareSeq(e.args)) : bareSeq(e.args);
    case "UpdateRule":
      return (
        identifierToString(e.variable) +
        "\\to " +
        childNodeToString(e.expression)
      );
    case "AssignmentExpression":
      return (
        identifierToString(e.variable) + "=" + childNodeToString(e.expression)
      );
    case "ListComprehension":
      return wrapBracket(
        childNodeToString(e.expr) +
          "\\operatorname{for}" +
          bareSeq(e.assignments)
      );
    case "Piecewise":
      const piecewiseParts: string[] = [];
      let curr: ChildLatex = e;
      while (curr.type === "Piecewise") {
        let part = childNodeToString(curr.condition);
        if (!isConstant(curr.consequent, 1)) {
          part += ":" + childNodeToString(curr.consequent);
        }
        piecewiseParts.push(part);
        curr = curr.alternate;
      }
      if (!isConstant(curr, NaN)) {
        piecewiseParts.push(childNodeToString(curr));
      }
      return "\\left\\{" + piecewiseParts.join(",") + "\\right\\}";
    case "RepeatedOperator":
      let prefix = e.name === "Product" ? "\\prod" : "\\sum";
      return (
        prefix +
        `_{${identifierToString(e.index)}=${childNodeToString(e.start)}}` +
        `^{${childNodeToString(e.end)}}` +
        wrapParen(childNodeToString(e.expression))
      );
    case "BinaryOperator":
      const binopLeft = childNodeToString(e.left);
      const binopRight = childNodeToString(e.right);
      switch (e.name) {
        case "Add":
          return wrapParen(binopLeft) + "+" + wrapParen(binopRight);
        case "Subtract":
          return wrapParen(binopLeft) + "-" + wrapParen(binopRight);
        case "Multiply":
          return wrapParen(binopLeft) + "\\cdot " + wrapParen(binopRight);
        case "Divide":
          return `\\frac{${binopLeft}}{${binopRight}}`;
        case "Exponent":
          return wrapParen(binopLeft) + "^{" + binopRight + "}";
      }
    case "Negative":
      return "-" + wrapParen(childNodeToString(e.arg));
    case "Comparator":
      return (
        childNodeToString(e.left) +
        comparatorMap[e.operator] +
        childNodeToString(e.right)
      );
    case "DoubleInequality":
      return (
        childNodeToString(e.left) +
        comparatorMap[e.leftOperator] +
        childNodeToString(e.middle) +
        comparatorMap[e.rightOperator] +
        childNodeToString(e.right)
      );
  }
}

const comparatorMap = {
  "<": "<",
  "<=": "\\le ",
  "=": "=",
  ">=": "\\ge ",
  ">": ">",
};

function bareSeq(e: ChildLatex[]): string {
  return e.map(childNodeToString).join(",");
}

function funcToString(callee: Identifier, args: ChildLatex[]): string {
  if (callee.symbol === "factorial") {
    return `\\left(${bareSeq(args)}\\right)!`;
  } else if (callee.symbol === "abs") {
    return `\\left|${bareSeq(args)}\\right|`;
  } else {
    return identifierToString(callee) + wrapParen(bareSeq(args));
  }
}

/**
 * The backslash commands are \alpha, \beta ... \infty
 */
const backslashCommands = new Set(autoCommandNames.split(" "));

function identifierToString(id: Identifier): string {
  const symbol = id.symbol.replace(/[{}]/g, "");
  let main = symbol;
  let subscript = undefined;
  const uIndex = symbol.indexOf("_");
  if (uIndex >= 0) {
    main = symbol.substring(0, uIndex);
    subscript = symbol.substring(uIndex + 1);
    if (!/^[a-zA-Z]+$/.test(main) || !/^[a-zA-Z0-9]+$/.test(subscript)) {
      throw `Unexpected character in ${symbol}`;
    }
  }
  const start =
    main.length === 1
      ? main
      : backslashCommands.has(main)
      ? "\\" + main
      : `\\operatorname{${main}}`;
  const end = subscript ? `_{${subscript}}` : "";
  return start + end;
}