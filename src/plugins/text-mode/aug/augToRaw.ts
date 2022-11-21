import Aug from "./AugState";
import * as Graph from "@desmodder/graph-state";
import Metadata from "main/metadata/interface";
import { changeExprInMetadata, isBlankMetadata } from "main/metadata/manage";
import { autoCommandNames } from "utils/depUtils";

export default function augToRaw(aug: Aug.State): Graph.GraphState {
  const list = [];
  const dsmMetadata = {
    version: 2 as const,
    expressions: {},
  };
  for (const expr of aug.expressions.list) {
    updateDsmMetadata(dsmMetadata, expr);
    if (expr.type === "folder") {
      list.push(augFolderToRaw(expr));
      for (const child of expr.children) {
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
  const res: Graph.GraphState = {
    version: 9,
    randomSeed,
    graph: aug.settings,
    expressions: {
      list,
      ticker: aug.expressions.ticker && augTickerToRaw(aug.expressions.ticker),
    },
  };
  cleanUndefined(res);
  return res;
}

function cleanUndefined(obj: any): void {
  if (typeof obj === "object") {
    for (const key in obj) {
      if (key in obj && obj[key] === undefined) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete obj[key];
      } else {
        cleanUndefined(obj[key]);
      }
    }
  }
}

function augTickerToRaw(ticker: Aug.TickerAug) {
  return {
    handlerLatex: latexTreeToString(ticker.handlerLatex),
    minStepLatex: latexTreeToString(ticker.minStepLatex),
    playing: ticker.playing,
    open: true,
  };
}

function updateDsmMetadata(dsmMetadata: Metadata, expr: Aug.ItemAug): void {
  if (expr.type !== "folder" && expr.pinned) {
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

function augFolderToRaw(expr: Aug.FolderAug): Graph.FolderState {
  return {
    id: expr.id,
    secret: expr.secret,
    type: "folder",
    hidden: expr.hidden,
    collapsed: expr.collapsed,
    title: expr.title,
  };
}

function augNonFolderToRaw(item: Aug.NonFolderAug): Graph.NonFolderState {
  const base = {
    id: item.id,
    secret: item.secret,
  };
  switch (item.type) {
    case "expression": {
      const shouldFill = item.fillOpacity
        ? !Aug.Latex.isConstant(item.fillOpacity, 0)
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
        regressionParameters: Object.fromEntries(
          [...(item.regression?.regressionParameters.entries() ?? [])].map(
            ([k, v]) => [identifierToString(k), v]
          )
        ),
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
    }
    case "image":
      return {
        ...base,
        type: "image",
        image_url: item.image_url,
        name: item.name,
        width: latexTreeToString(item.width),
        height: latexTreeToString(item.height),
        hidden: Aug.Latex.isConstant(item.opacity, 0),
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
          values:
            // Desmos expects at least one row
            column.values.length > 0
              ? column.values.map(columnEntryToString)
              : [""],
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

function latexMapDomain(domain: Aug.DomainAug | undefined) {
  if (!domain) {
    return undefined;
  } else {
    return {
      min: latexTreeToString(domain.min),
      max: latexTreeToString(domain.max),
    };
  }
}

function columnExpressionCommon(item: Aug.TableColumnAug | Aug.ExpressionAug) {
  const res: Graph.ColumnExpressionShared = {
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
    res.pointSize = latexTreeToString(item.points.size);
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

function latexTreeToStringMaybe(e: Aug.Latex.AnyRootOrChild | undefined) {
  if (!e) return undefined;
  return latexTreeToString(e);
}

function latexTreeToString(e: Aug.Latex.AnyRootOrChild) {
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

function columnEntryToString(e: Aug.Latex.AnyRootOrChild): string {
  if (e.type === "Identifier" && e.symbol === "N_aN") return "";
  return latexTreeToString(e);
}

function childNodeToString(e: Aug.Latex.AnyChild): string {
  switch (e.type) {
    case "Constant": {
      const res = e.value.toString();
      return res.includes("e") ? "(" + res.replace("e", "*10^{") + "})" : res;
    }
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
        `\\left(\\frac{d}{d${identifierToString(e.variable)}}` +
        childNodeToString(e.arg) +
        "\\right)"
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
    case "ListComprehension":
      return wrapBracket(
        childNodeToString(e.expr) +
          "\\operatorname{for}" +
          e.assignments.map(assignmentExprToRaw).join(",")
      );
    case "Piecewise": {
      const piecewiseParts: string[] = [];
      let curr: Aug.Latex.AnyChild = e;
      while (curr.type === "Piecewise") {
        if (curr.condition === true) {
          curr = curr.consequent;
          break;
        }
        let part = childNodeToString(curr.condition);
        if (!Aug.Latex.isConstant(curr.consequent, 1)) {
          part += ":" + childNodeToString(curr.consequent);
        }
        piecewiseParts.push(part);
        curr = curr.alternate;
      }
      if (!Aug.Latex.isConstant(curr, NaN)) {
        // check handles trivial piecewise such as {else: 1}
        if (piecewiseParts.length === 0) return childNodeToString(curr);
        piecewiseParts.push(childNodeToString(curr));
      }
      return "\\left\\{" + piecewiseParts.join(",") + "\\right\\}";
    }
    case "RepeatedOperator": {
      const prefix = e.name === "Product" ? "\\prod" : "\\sum";
      return (
        prefix +
        `_{${identifierToString(e.index)}=${childNodeToString(e.start)}}` +
        `^{${childNodeToString(e.end)}}` +
        wrapParen(childNodeToString(e.expression))
      );
    }
    case "BinaryOperator": {
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
    }
    // eslint-disable-next-line no-fallthrough
    case "Negative":
      if (e.arg.type === "Constant" && e.arg.value > 0)
        return "-" + childNodeToString(e.arg);
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

function assignmentExprToRaw(e: Aug.Latex.AssignmentExpression): string {
  return identifierToString(e.variable) + "=" + childNodeToString(e.expression);
}

const comparatorMap = {
  "<": "<",
  "<=": "\\le ",
  "=": "=",
  ">=": "\\ge ",
  ">": ">",
};

function bareSeq(e: Aug.Latex.AnyChild[]): string {
  return e.map(childNodeToString).join(",");
}

function funcToString(
  callee: Aug.Latex.Identifier,
  args: Aug.Latex.AnyChild[]
): string {
  if (callee.symbol === "factorial") {
    return `\\left(${bareSeq(args)}\\right)!`;
  } else if (callee.symbol === "abs") {
    return `\\left|${bareSeq(args)}\\right|`;
  } else if (callee.symbol === "sqrt") {
    return `\\sqrt{${bareSeq(args)}}`;
  } else if (callee.symbol === "nthroot") {
    if (args.length === 1) return `\\sqrt{${bareSeq(args)}}`;
    return `\\sqrt[${childNodeToString(args[1])}]{${bareSeq([
      ...args.slice(0, 1),
      ...args.slice(2),
    ])}}`;
  } else if (callee.symbol === "l_ogbase") {
    if (args.length === 1) return `\\log\\left(${bareSeq(args)}\\right)`;
    return `\\log_{${childNodeToString(args[args.length - 1])}}\\left(${bareSeq(
      args.slice(0, args.length - 1)
    )}\\right)`;
  } else {
    return identifierToString(callee) + wrapParen(bareSeq(args));
  }
}

/**
 * The backslash commands are \alpha, \beta ... \infty
 */
const backslashCommands = new Set(autoCommandNames.split(" "));

function identifierToString(id: Aug.Latex.Identifier): string {
  const symbol = id.symbol.replace(/[{}]/g, "");
  let main = symbol;
  let subscript;
  const uIndex = symbol.indexOf("_");
  if (uIndex >= 0) {
    main = symbol.substring(0, uIndex);
    subscript = symbol.substring(uIndex + 1);
    if (!/^[a-zA-Z]+$/.test(main) || !/^[a-zA-Z0-9]+$/.test(subscript)) {
      throw Error(`Unexpected character in ${symbol}`);
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
