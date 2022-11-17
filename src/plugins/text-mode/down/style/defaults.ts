import { number } from "../TextAST";
import * as Hydrated from "./Hydrated";

export const settings: Hydrated.Settings = {
  viewport: {
    xmin: -10,
    ymin: -10,
    xmax: 10,
    ymax: 10,
  },
  squareAxes: true,
  // empty randomSeed will be filled in later in the process
  randomSeed: "",
  xAxisLabel: "",
  yAxisLabel: "",
  xAxisArrowMode: "NONE",
  yAxisArrowMode: "NONE",
  xAxisMinorSubdivisions: 0,
  yAxisMinorSubdivisions: 0,
  xAxisStep: 0,
  yAxisStep: 0,
  degreeMode: false,
  showGrid: true,
  showXAxis: true,
  showYAxis: true,
  xAxisNumbers: true,
  yAxisNumbers: true,
  polarNumbers: true,
  restrictGridToFirstQuadrant: false,
  polarMode: false,
  lockViewport: false,
};

export const ticker: Hydrated.Ticker = {
  minStep: number(0),
  playing: false,
};

const base: Hydrated.Base = {
  // empty ID will be filled in later in the process
  id: "",
};

const itemBase: Hydrated.ItemBase = {
  ...base,
  secret: false,
};

const nonFolderBase: Hydrated.NonFolderBase = {
  ...itemBase,
  pinned: false,
};

const columnExpressionCommon: Hydrated.ColumnExpressionCommon = {
  // empty color will be filled in later in the process
  color: "",
  hidden: false,
  points: {
    opacity: number(0.9),
    size: number(9),
    style: "POINT",
    drag: "NONE",
  },
  lines: {
    opacity: number(0.9),
    width: number(2.5),
    style: "SOLID",
  },
};

const clickable: Hydrated.Clickable = {
  onClick: null,
  clickDescription: "",
};

const expression = {
  ...nonFolderBase,
  ...columnExpressionCommon,
  ...clickable,
  label: {
    text: "",
    size: number(1),
    orientation: "default",
    angle: number(0),
    outline: true,
    showOnHover: false,
    editableMode: "NONE",
  },
  errorHidden: false,
  glesmos: false,
  fill: number(0),
  logMode: false,
  displayEvaluationAsFraction: false,
  slider: {
    playing: false,
    reversed: false,
    loopMode: "LOOP_FORWARD_REVERSE",
    period: 4000,
    min: number(-10),
    max: number(10),
    step: number(0),
  },
  cdf: {
    min: {
      type: "PrefixExpression",
      op: "-",
      expr: { type: "Identifier", name: "infty" },
    },
    max: { type: "Identifier", name: "infty" },
  },
  // TODO vizProps
  // vizProps
} as const;

export const polarExpression: Hydrated.Expression = {
  ...expression,
  domain: {
    min: number(0),
    max: {
      type: "BinaryExpression",
      op: "*",
      left: number(12),
      right: { type: "Identifier", name: "pi" },
    },
  },
};

export const nonpolarExpression: Hydrated.Expression = {
  ...expression,
  domain: {
    min: number(0),
    max: number(1),
  },
};

export const regression: Hydrated.Regression = {
  ...nonFolderBase,
  errorHidden: false,
  logMode: false,
};

export const table: Hydrated.Table = nonFolderBase;

export const column: Hydrated.Column = {
  ...base,
  ...columnExpressionCommon,
};

export const image: Hydrated.Image = {
  ...nonFolderBase,
  ...clickable,
  width: number(10),
  height: number(10),
  center: {
    type: "SequenceExpression",
    left: number(0),
    right: number(0),
    parenWrapped: true,
  },
  angle: number(0),
  opacity: number(1),
  foreground: false,
  draggable: false,
  url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdjYGBg+A8AAQQBAHAgZQsAAAAASUVORK5CYII=",
  hoveredImage: "",
  depressedImage: "",
};

export const text: Hydrated.NonFolderBase = nonFolderBase;

export const folder: Hydrated.Folder = {
  ...itemBase,
  hidden: false,
  collapsed: false,
};
