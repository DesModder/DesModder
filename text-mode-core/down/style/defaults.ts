import { constant } from "../../aug/AugLatex";
import * as Hydrated from "./Hydrated";

export const settings: Hydrated.Settings = {
  viewport: {},
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
  // TODO-graph-state: Do we want the default to be empty, then filled in with grapher type?
  product: "graphing",
  axis3D: [0, 0, 1],
  speed3D: 0,
  worldRotation3D: [
    -0.5132799671593364, -0.8314696123025455, -0.212607523691814,
    0.7681777567114166, -0.555570233019602, 0.3181896451432085,
    -0.3826834323650897, 0, 0.9238795325112867,
  ],
};

export const ticker: Hydrated.Ticker = {
  minStep: constant(0),
  playing: false,
};

const itemBase: Hydrated.ItemBase = {
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
    opacity: constant(0.9),
    size: constant(9),
    style: "POINT",
    drag: "NONE",
  },
  lines: {
    opacity: constant(0.9),
    width: constant(2.5),
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
    size: constant(1),
    orientation: "default",
    angle: constant(0),
    outline: true,
    showOnHover: false,
    editableMode: "NONE",
  },
  errorHidden: false,
  glesmos: false,
  fill: undefined,
  logMode: false,
  displayEvaluationAsFraction: false,
  slider: {
    playing: false,
    reversed: false,
    loopMode: "LOOP_FORWARD_REVERSE",
    period: 4000,
    min: undefined,
    max: undefined,
    step: undefined,
  },
  cdf: {
    min: undefined,
    max: undefined,
  },
  // TODO vizProps
  // vizProps
} as const;

export const polarExpression: Hydrated.Expression = {
  ...expression,
  domain: {
    min: undefined,
    max: undefined,
  },
};

export const nonpolarExpression: Hydrated.Expression = {
  ...expression,
  domain: {
    min: undefined,
    max: undefined,
  },
};

export const regression: Hydrated.Regression = {
  ...nonFolderBase,
  errorHidden: false,
  logMode: false,
};

export const table: Hydrated.Table = nonFolderBase;

export const column: Hydrated.Column = {
  ...columnExpressionCommon,
};

export const image: Hydrated.Image = {
  ...nonFolderBase,
  ...clickable,
  width: constant(10),
  height: constant(10),
  center: {
    type: "Seq",
    args: [constant(0), constant(0)],
    parenWrapped: true,
  },
  angle: constant(0),
  opacity: constant(1),
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
