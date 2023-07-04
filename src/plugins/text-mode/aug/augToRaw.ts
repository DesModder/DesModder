import { isConstant } from "./AugLatex";
import Aug from "./AugState";
import { latexTreeToString } from "./augLatexToRaw";
import * as Graph from "@desmodder/graph-state";
import Metadata from "plugins/manage-metadata/interface";
import {
  changeExprInMetadata,
  isBlankMetadata,
} from "plugins/manage-metadata/manage";

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

export function augNonFolderToRaw(
  item: Aug.NonFolderAug
): Graph.NonFolderState {
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
            ([k, v]) => [latexTreeToString(k), v]
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

function latexTreeToStringMaybe(e: Aug.Latex.AnyRootOrChild | undefined) {
  if (!e) return undefined;
  return latexTreeToString(e);
}

function columnEntryToString(e: Aug.Latex.AnyRootOrChild): string {
  if (e.type === "Identifier" && e.symbol === "N_aN") return "";
  return latexTreeToString(e);
}
