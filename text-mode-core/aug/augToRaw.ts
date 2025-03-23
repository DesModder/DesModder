// eslint-disable-next-line @desmodder/eslint-rules/no-reach-past-exports
import type Metadata from "../../metadata/interface";
// eslint-disable-next-line @desmodder/eslint-rules/no-reach-past-exports
import { changeExprInMetadata, isBlankMetadata } from "../../metadata/manage";
import { Config } from "../TextModeConfig";
import { isConstant } from "./AugLatex";
import Aug from "./AugState";
import { latexTreeToString } from "./augLatexToRaw";
import type * as Graph from "#graph-state";

export default function augToRaw(
  cfg: Config,
  aug: Aug.State
): Graph.GraphState {
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
          ...augNonFolderToRaw(cfg, child),
          folderId: expr.id,
        });
      }
    } else {
      list.push(augNonFolderToRaw(cfg, expr));
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
  const { randomSeed } = aug.settings;
  delete aug.settings.randomSeed;
  const res: Graph.GraphState = {
    // TODO-graph-state: version 11? Not sure if it changes any behavior (due to migrations).
    version: 9,
    randomSeed,
    graph: {
      ...aug.settings,
      threeDMode: aug.settings.product === "graphing-3d",
    },
    expressions: {
      list,
      ticker:
        aug.expressions.ticker && augTickerToRaw(cfg, aug.expressions.ticker),
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

function augTickerToRaw(cfg: Config, ticker: Aug.TickerAug) {
  return {
    handlerLatex: latexTreeToString(cfg, ticker.handlerLatex),
    minStepLatex: latexTreeToString(cfg, ticker.minStepLatex),
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

function augNonFolderToRaw(
  cfg: Config,
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
        ...columnExpressionCommon(cfg, item),
        fill: shouldFill,
        fillOpacity: shouldFill
          ? latexTreeToStringMaybe(cfg, item.fillOpacity)
          : undefined,
        residualVariable: latexTreeToStringMaybe(
          cfg,
          item.regression?.residualVariable
        ),
        regressionParameters: Object.fromEntries(
          [...(item.regression?.regressionParameters.entries() ?? [])].map(
            ([k, v]) => [latexTreeToString(cfg, k), v]
          )
        ),
        isLogModeRegression: item.regression?.isLogMode,
        ...(item.label
          ? {
              label: item.label.text,
              showLabel: true,
              labelSize: latexTreeToString(cfg, item.label.size),
              labelOrientation: item.label.orientation,
              labelAngle: latexTreeToString(cfg, item.label.angle),
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
          min: latexTreeToStringMaybe(cfg, item.slider.min),
          hardMax:
            !!item.slider.max && item.slider.loopMode !== "PLAY_INDEFINITELY",
          max: latexTreeToStringMaybe(cfg, item.slider.max),
          step: latexTreeToStringMaybe(cfg, item.slider.step),
        },
        displayEvaluationAsFraction: item.displayEvaluationAsFraction,
        polarDomain: item.polarDomain && latexMapDomain(cfg, item.polarDomain),
        parametricDomain:
          item.parametricDomain && latexMapDomain(cfg, item.parametricDomain),
        parametricDomain3Du:
          item.parametricDomain3Du &&
          latexMapDomain(cfg, item.parametricDomain3Du),
        parametricDomain3Dv:
          item.parametricDomain3Dv &&
          latexMapDomain(cfg, item.parametricDomain3Dv),
        parametricDomain3Dr:
          item.parametricDomain3Dr &&
          latexMapDomain(cfg, item.parametricDomain3Dr),
        parametricDomain3Dphi:
          item.parametricDomain3Dphi &&
          latexMapDomain(cfg, item.parametricDomain3Dphi),
        domain:
          item.parametricDomain && latexMapDomain(cfg, item.parametricDomain),
        cdf: item.cdf && {
          show: true,
          min: latexTreeToStringMaybe(cfg, item.cdf.min),
          max: latexTreeToStringMaybe(cfg, item.cdf.max),
        },
        vizProps: {
          breadth: latexTreeToStringMaybe(cfg, item.vizProps.boxplot?.breadth),
          axisOffset: latexTreeToStringMaybe(
            cfg,
            item.vizProps.boxplot?.axisOffset
          ),
          alignedAxis: item.vizProps.boxplot?.alignedAxis,
          showBoxplotOutliers: item.vizProps.boxplot?.showOutliers,
          dotplotXMode: item.vizProps.dotplotMode,
          binAlignment: item.vizProps.binAlignment,
          histogramMode: item.vizProps.histogramMode,
        },
        clickableInfo: item.clickableInfo && {
          enabled: true,
          description: item.clickableInfo.description,
          latex: latexTreeToString(cfg, item.clickableInfo.latex),
        },
      };
    }
    case "image":
      return {
        ...base,
        type: "image",
        image_url: item.image_url,
        name: item.name,
        width: latexTreeToString(cfg, item.width),
        height: latexTreeToString(cfg, item.height),
        hidden: Aug.Latex.isConstant(item.opacity, 0),
        center: latexTreeToString(cfg, item.center),
        angle: latexTreeToString(cfg, item.angle),
        opacity: latexTreeToString(cfg, item.opacity),
        foreground: item.foreground,
        draggable: item.draggable,
        clickableInfo: item.clickableInfo && {
          enabled: true,
          description: item.clickableInfo.description,
          latex: latexTreeToString(cfg, item.clickableInfo.latex),
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
                ? column.values.map((e) => columnEntryToString(cfg, e))
                : [""],
            id: column.id,
            ...columnExpressionCommon(cfg, column),
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

function latexMapDomain(cfg: Config, domain: Aug.DomainAug | undefined) {
  if (!domain) {
    return undefined;
  } else {
    return {
      min: domain.min ? latexTreeToString(cfg, domain.min) : "",
      max: domain.max ? latexTreeToString(cfg, domain.max) : "",
    };
  }
}

function columnExpressionCommon(
  cfg: Config,
  item: Aug.TableColumnAug | Aug.ExpressionAug
) {
  const res: Graph.ColumnExpressionShared = {
    color: "",
    hidden: item.hidden,
    latex: latexTreeToStringMaybe(cfg, item.latex),
  };
  if (typeof item.color === "string") {
    res.color = item.color;
  } else {
    // default to red if latex
    res.color = "#c74440";
    res.colorLatex = latexTreeToString(cfg, item.color);
  }
  if (item.points) {
    res.points =
      !isConstant(item.points.opacity, 0) && !isConstant(item.points.size, 0);
    if (item.points.opacity)
      res.pointOpacity = latexTreeToString(cfg, item.points.opacity);
    if (item.points.size)
      res.pointSize = latexTreeToString(cfg, item.points.size);
    res.pointStyle = item.points.style;
    res.dragMode = item.points.dragMode;
  }
  if (item.lines) {
    res.lines =
      !isConstant(item.lines.opacity, 0) && !isConstant(item.lines.width, 0);
    if (item.lines.opacity)
      res.lineOpacity = latexTreeToString(cfg, item.lines.opacity);
    if (item.lines.width)
      res.lineWidth = latexTreeToString(cfg, item.lines.width);
    res.lineStyle = item.lines.style;
  }
  return res;
}

function latexTreeToStringMaybe(
  cfg: Config,
  e: Aug.Latex.AnyRootOrChild | undefined
) {
  if (!e) return undefined;
  return latexTreeToString(cfg, e);
}

function columnEntryToString(cfg: Config, e: Aug.Latex.AnyRootOrChild): string {
  if (e.type === "Identifier" && e.symbol === "N_aN") return "";
  return latexTreeToString(cfg, e);
}
