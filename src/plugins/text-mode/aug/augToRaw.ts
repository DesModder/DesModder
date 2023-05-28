import { isConstant } from "./AugLatex";
import Aug from "./AugState";
import rawNeedsParens from "./augNeedsParens";
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
        : undefined;
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
          hardMin:
            !!item.slider.min && item.slider.loopMode !== "PLAY_INDEFINITELY",
          min: latexTreeToStringMaybe(item.slider.min),
          hardMax:
            !!item.slider.max && item.slider.loopMode !== "PLAY_INDEFINITELY",
          max: latexTreeToStringMaybe(item.slider.max),
          step: latexTreeToStringMaybe(item.slider.step),
        },
        displayEvaluationAsFraction: item.displayEvaluationAsFraction,
        polarDomain: item.polarDomain && latexMapDomain(item.polarDomain),
        parametricDomain:
          item.parametricDomain && latexMapDomain(item.parametricDomain),
        domain: item.parametricDomain && latexMapDomain(item.parametricDomain),
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
        columns: item.columns
          .map((column) => ({
            values:
              // Desmos expects at least one row
              column.values.length > 0
                ? column.values.map(columnEntryToString)
                : [""],
            id: column.id,
            ...columnExpressionCommon(column),
          }))
          // Desmos expects at least two columns
          .concat(
            Array.from({ length: 2 - item.columns.length }).map(() => ({
              id: "dsm-blank-" + Math.random().toString().slice(2, 16),
              values: [""],
              color: "#2D70B3",
            }))
          ),
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
      min: domain.min ? latexTreeToString(domain.min) : "",
      max: domain.max ? latexTreeToString(domain.max) : "",
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
    res.colorLatex = latexTreeToString(item.color);
  }
  if (item.points) {
    res.points =
      !isConstant(item.points.opacity, 0) && !isConstant(item.points.size, 0);
    if (item.points.opacity)
      res.pointOpacity = latexTreeToString(item.points.opacity);
    if (item.points.size) res.pointSize = latexTreeToString(item.points.size);
    res.pointStyle = item.points.style;
    res.dragMode = item.points.dragMode;
  }
  if (item.lines) {
    res.lines =
      !isConstant(item.lines.opacity, 0) && !isConstant(item.lines.width, 0);
    if (item.lines.opacity)
      res.lineOpacity = latexTreeToString(item.lines.opacity);
    if (item.lines.width) res.lineWidth = latexTreeToString(item.lines.width);
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

export function latexTreeToString(e: Aug.Latex.AnyRootOrChild) {
  switch (e.type) {
    case "Equation":
    case "Assignment":
      return childNodeToString(e.left, e) + "=" + childNodeToString(e.right, e);
    case "FunctionDefinition":
      return (
        funcToString(e.symbol, e.argSymbols, e) +
        "=" +
        childNodeToString(e.definition, e)
      );
    case "Visualization":
      // Lower case handles "Stats" → "stats" etc
      return funcToString(e.callee, e.args, e);
    case "Regression":
      return (
        childNodeToString(e.left, e) + "\\sim " + childNodeToString(e.right, e)
      );
    default:
      return childNodeToString(e, null);
  }
}

function columnEntryToString(e: Aug.Latex.AnyRootOrChild): string {
  if (e.type === "Identifier" && e.symbol === "N_aN") return "";
  return latexTreeToString(e);
}

function childNodeToString(
  e: Aug.Latex.AnyChild,
  parent: Aug.Latex.AnyRootOrChild | null,
  path?: string | undefined
): string {
  const inner = childNodeToStringNoParen(e);
  if (rawNeedsParens(e, parent, path)) return wrapParen(inner);
  return inner;
}

function childNodeToStringNoParen(e: Aug.Latex.AnyChild): string {
  switch (e.type) {
    case "Constant": {
      const res = e.value.toString();
      return res.includes("e") ? "(" + res.replace("e", "*10^{") + "})" : res;
    }
    case "Identifier":
      return identifierToString(e);
    case "FunctionCall":
      return funcToString(e.callee, e.args, e);
    case "Integral":
      return (
        `\\int_{${childNodeToString(e.start, e)}}` +
        `^{${childNodeToString(e.end, e)}}` +
        childNodeToString(e.integrand, e, "integrand") +
        "d" +
        identifierToString(e.differential)
      );
    case "Derivative":
      return (
        `\\frac{d}{d${identifierToString(e.variable)}}` +
        childNodeToString(e.arg, e)
      );
    case "Prime":
      return (
        identifierToString(e.arg.callee) +
        "'".repeat(e.order) +
        wrapParen(bareSeq(e.arg.args, e.arg))
      );
    case "List":
      return wrapBracket(bareSeq(e.args, e));
    case "Range":
      return wrapBracket(
        bareSeq(e.start, e, { alwaysBeforeComma: true }) +
          "..." +
          bareSeq(e.end, e)
      );
    case "ListAccess":
      return (
        childNodeToString(e.list, e, "list") +
        (e.index.type === "Range" || e.index.type === "List"
          ? childNodeToString(e.index, e)
          : wrapBracket(childNodeToString(e.index, e)))
      );
    case "DotAccess":
      return (
        childNodeToString(e.object, e, "object") +
        "." +
        childNodeToString(e.property, e)
      );
    case "OrderedPairAccess":
      return childNodeToString(e.point, e, "object") + "." + e.index;
    case "Seq":
      // needsParen handles wrapping in paren for parenWrapped
      return bareSeq(e.args, e);
    case "UpdateRule":
      return (
        identifierToString(e.variable) +
        "\\to " +
        childNodeToString(e.expression, e)
      );
    case "ListComprehension":
      return wrapBracket(
        childNodeToString(e.expr, e) +
          "\\operatorname{for}" +
          bareSeq(e.assignments, e)
      );
    case "Substitution":
      return (
        childNodeToString(e.body, e) +
        "\\operatorname{with}" +
        bareSeq(e.assignments, e)
      );
    case "Piecewise": {
      const piecewiseParts: string[] = [];
      let curr: Aug.Latex.AnyChild = e;
      while (curr.type === "Piecewise") {
        if (curr.condition === true) {
          curr = curr.consequent;
          break;
        }
        let part = childNodeToString(curr.condition, curr);
        if (!Aug.Latex.isConstant(curr.consequent, 1)) {
          part +=
            ":" +
            childNodeToString(
              curr.consequent,
              curr,
              beforeComma(
                curr.alternate.type === "Piecewise" ||
                  !Aug.Latex.isConstant(curr.alternate, NaN)
              )
            );
        }
        piecewiseParts.push(part);
        curr = curr.alternate;
      }
      if (!Aug.Latex.isConstant(curr, NaN)) {
        // check handles trivial piecewise such as {else: 1}
        if (piecewiseParts.length === 0) return childNodeToString(curr, e);
        piecewiseParts.push(childNodeToString(curr, e));
      }
      return "\\left\\{" + piecewiseParts.join(",") + "\\right\\}";
    }
    case "RepeatedOperator": {
      const prefix = e.name === "Product" ? "\\prod" : "\\sum";
      return (
        prefix +
        `_{${identifierToString(e.index)}=${childNodeToString(e.start, e)}}` +
        `^{${childNodeToString(e.end, e)}}` +
        childNodeToString(e.expression, e, "term")
      );
    }
    case "BinaryOperator": {
      const binopLeft = childNodeToString(e.left, e, "left");
      const binopRight = childNodeToString(e.right, e, "right");
      switch (e.name) {
        case "Add":
          return binopLeft + "+" + binopRight;
        case "Subtract":
          return binopLeft + "-" + binopRight;
        case "Multiply":
          return binopLeft + "\\cdot " + binopRight;
        case "Divide":
          return `\\frac{${binopLeft}}{${binopRight}}`;
        case "Exponent":
          return binopLeft + "^{" + binopRight + "}";
      }
    }
    // eslint-disable-next-line no-fallthrough
    case "Negative":
      return "-" + childNodeToString(e.arg, e);
    case "Comparator":
      return (
        childNodeToString(e.left, e) +
        comparatorMap[e.operator] +
        childNodeToString(e.right, e)
      );
    case "DoubleInequality":
      return (
        childNodeToString(e.left, e) +
        comparatorMap[e.leftOperator] +
        childNodeToString(e.middle, e) +
        comparatorMap[e.rightOperator] +
        childNodeToString(e.right, e)
      );
    case "AssignmentExpression":
      return (
        identifierToString(e.variable) +
        "=" +
        childNodeToString(e.expression, e)
      );
    default:
      e satisfies never;
      throw new Error(
        `Programming Error: Unexpected Aug node ${(e as any).type}`
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

function bareSeq(
  e: Aug.Latex.AnyChild[],
  parent: Aug.Latex.AnyRootOrChild,
  { alwaysBeforeComma } = { alwaysBeforeComma: false }
): string {
  return e
    .map((f, i) =>
      childNodeToString(
        f,
        parent,
        beforeComma(alwaysBeforeComma || i < e.length - 1)
      )
    )
    .join(",");
}

function beforeComma(beforeComma: boolean) {
  return beforeComma ? "before-comma" : "last-element";
}

function funcToString(
  callee: Aug.Latex.Identifier,
  args: Aug.Latex.AnyChild[],
  parent: Aug.Latex.AnyRootOrChild
): string {
  if (isFactorialBang(callee, args)) {
    return childNodeToString(args[0], parent, "factorial") + "!";
  } else if (callee.symbol === "abs" && args.length === 1) {
    return `\\left|${bareSeq(args, parent)}\\right|`;
  } else if (callee.symbol === "sqrt" && args.length === 1) {
    return `\\sqrt{${bareSeq(args, parent)}}`;
  } else if (callee.symbol === "nthroot" && [1, 2].includes(args.length)) {
    if (args.length === 1) return `\\sqrt{${bareSeq(args, parent)}}`;
    return `\\sqrt[${childNodeToString(args[1], parent)}]{${bareSeq(
      [...args.slice(0, 1), ...args.slice(2)],
      parent
    )}}`;
  } else if (callee.symbol === "l_ogbase" && [1, 2].includes(args.length)) {
    if (args.length === 1) return "\\log" + wrapParen(bareSeq(args, parent));
    return (
      `\\log_{${childNodeToString(args[args.length - 1], parent)}}` +
      wrapParen(bareSeq(args.slice(0, args.length - 1), parent))
    );
  } else {
    return identifierToString(callee) + wrapParen(bareSeq(args, parent));
  }
}

export function isFactorialBang(
  callee: Aug.Latex.Identifier,
  args: Aug.Latex.AnyChild[]
) {
  return callee.symbol === "factorial" && args.length === 1;
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
