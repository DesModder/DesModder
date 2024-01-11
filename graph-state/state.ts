/**
 * Reference sources:
 *  - core/types/*
 *  - graphing-calc/models/*
 *  - core/graphing-calc/json/*
 *  - core/graphing-calc/migrations/*
 *  - main/graph_settings
 *  - https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/desmos/index.d.ts
 */
export interface GraphState {
  // TODO-graph-state: Version 11.
  version: 9;
  randomSeed?: string;
  graph: GrapherState;
  expressions: {
    list: ItemState[];
    ticker?: Ticker;
  };
}

export interface Ticker {
  handlerLatex?: Latex;
  minStepLatex?: Latex;
  open?: boolean;
  playing?: boolean;
}

export type ArrowMode = "NONE" | "POSITIVE" | "BOTH";

export type Product = "graphing" | "geometry-calculator" | "graphing-3d";

export interface GrapherState {
  product?: Product;
  viewport: {
    xmin?: number;
    ymin?: number;
    xmax?: number;
    ymax?: number;
  };
  // {x,y}AxisMinorSubdivisions appears to be either 5 or 0 (disabled)
  // but Desmos accepts other subdivisions
  xAxisMinorSubdivisions?: number;
  yAxisMinorSubdivisions?: number;
  degreeMode?: boolean;
  showGrid?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  // the UI appears to only have xAxisNumbers = yAxisNumbers = polarNumbers
  xAxisNumbers?: boolean;
  yAxisNumbers?: boolean;
  polarNumbers?: boolean;
  // {x,y}AxisStep are interesting. The user can put any LaTeX, but the result is stored as a
  // number and displayed as a number or multiple of pi
  xAxisStep?: number;
  yAxisStep?: number;
  xAxisArrowMode?: ArrowMode;
  yAxisArrowMode?: ArrowMode;
  xAxisLabel?: string;
  yAxisLabel?: string;
  squareAxes?: boolean;
  restrictGridToFirstQuadrant?: boolean;
  polarMode?: boolean;
  userLockedViewport?: boolean;
  threeDMode?: boolean;
}

type Latex = string;
type ID = string;

export type ItemState = NonFolderState | FolderState;

export type NonFolderState =
  | ExpressionState
  | ImageState
  | TableState
  | TextState;

interface BaseItemState {
  id: ID;
  secret?: boolean;
}

interface BaseNonFolderState extends BaseItemState {
  folderId?: ID;
}

export type LineStyle = "SOLID" | "DASHED" | "DOTTED";
export type PointStyle = "POINT" | "OPEN" | "CROSS";
export type DragMode = "NONE" | "X" | "Y" | "XY" | "AUTO";
export type LabelSize = "SMALL" | "MEDIUM" | "LARGE" | Latex;
export type LabelOrientation =
  | "default"
  | "center"
  | "center_auto"
  | "auto_center"
  | "above"
  | "above_left"
  | "above_right"
  | "above_auto"
  | "below"
  | "below_left"
  | "below_right"
  | "below_auto"
  | "left"
  | "auto_left"
  | "right"
  | "auto_right";

export interface Domain {
  min: Latex;
  max: Latex;
}

export interface BaseClickable {
  enabled?: boolean;
  // description is the screen reader label
  description?: string;
  latex?: Latex;
}
interface ExpressionStateWithoutColumn extends BaseNonFolderState {
  type: "expression";
  showLabel?: boolean;
  fill?: boolean;
  fillOpacity?: Latex;
  label?: string;
  labelSize?: LabelSize;
  labelOrientation?: LabelOrientation;
  labelAngle?: Latex;
  suppressTextOutline?: boolean;
  // interactiveLabel is show-on-hover
  interactiveLabel?: boolean;
  editableLabelMode?: "MATH" | "TEXT";
  residualVariable?: Latex;
  regressionParameters?: Record<Latex, number>;
  isLogModeRegression?: boolean;
  displayEvaluationAsFraction?: boolean;
  slider?: {
    hardMin?: boolean;
    hardMax?: boolean;
    animationPeriod?: number;
    loopMode?:
      | "LOOP_FORWARD_REVERSE"
      | "LOOP_FORWARD"
      | "PLAY_ONCE"
      | "PLAY_INDEFINITELY";
    playDirection?: 1 | -1;
    isPlaying?: boolean;
    min?: Latex;
    max?: Latex;
    step?: Latex;
  };
  polarDomain?: Domain;
  parametricDomain?: Domain;
  // seems like `domain` may be the same as `parametricDomain`
  domain?: Domain;
  cdf?: {
    show: boolean;
    min?: Latex;
    max?: Latex;
  };
  vizProps?: {
    // -- Applies to boxplot only:
    // axisOffset=offset and breadth=height (boxplots only)
    breadth?: Latex;
    axisOffset?: Latex;
    alignedAxis?: "x" | "y";
    showBoxplotOutliers?: boolean;
    // -- Applies to dotplot only:
    // the string "binned" is never actually checked,
    // just inferred by the absence of "exact"
    dotplotXMode?: "exact" | "binned";
    // -- applies to dotplot and histogram only:
    binAlignment?: "left" | "center";
    // -- applies to histogram only:
    // the string "count" is never actually checked,
    // just inferred by the absence of "relative" and "density"
    histogramMode?: "count" | "relative" | "density";
  };
  clickableInfo?: BaseClickable;
}

export type ExpressionState = ExpressionStateWithoutColumn &
  ColumnExpressionShared;

export interface ImageState extends BaseNonFolderState {
  type: "image";
  image_url: string;
  name?: string;
  width?: Latex;
  height?: Latex;
  hidden?: boolean;
  center?: Latex;
  angle?: Latex;
  opacity?: Latex;
  foreground?: boolean;
  draggable?: boolean;
  clickableInfo?: BaseClickable & {
    hoveredImage?: string;
    depressedImage?: string;
  };
}

export type TableColumn = {
  id: ID;
  values: Latex[];
} & ColumnExpressionShared;

export interface ColumnExpressionShared {
  color: string;
  latex?: Latex;
  hidden?: boolean;
  points?: boolean;
  lines?: boolean;
  dragMode?: DragMode;
  lineStyle?: LineStyle;
  pointStyle?: PointStyle;
  colorLatex?: Latex;
  lineOpacity?: Latex;
  lineWidth?: Latex;
  pointSize?: Latex;
  pointOpacity?: Latex;
}

export interface TableState extends BaseNonFolderState {
  type: "table";
  columns: TableColumn[];
}

export interface FolderState extends BaseItemState {
  type: "folder";
  hidden?: boolean;
  collapsed?: boolean;
  title?: string;
}

export interface TextState extends BaseNonFolderState {
  type: "text";
  text?: string;
}
