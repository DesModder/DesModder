/**
 * This file gives the type definitions for the augmented graph state.
 *
 * AugState is similar in structure to raw GraphState, but
 *  - latex is represented by a tree structure (similar to that of src/parsing/parsenode.ts)
 *    instead of a string
 *  - expressions are stored inside folders, not in a linear structure
 *    - but folders still cannot be nested in each other
 *  - DesModder metadata is stored on each expression
 *  - Certain constructs are consolidated for simplicity
 *    - The `lines` property is removed in favor of `lineOpacity: 0`
 *    - The `fill` property is removed in favor of `fillOpacity: 0`
 *    - The `colorLatex` property is combined into `color`
 *  - more changes
 *
 * All changes are mentioned near their position in the type definitions, with
 * the exception of requiring properties that were optional, which are not all mentioned.
 *
 * AugState necessarily does not represent everything in raw GraphState. For example, it does not
 * store the handler of a hidden ticker. However, converting to AugState and back to GraphState
 * should produce no visual/functional difference.
 */
import * as Latex from "./AugLatex";
import * as Aug from "./AugState";

export * as Latex from "./AugLatex";

export default Aug;

export interface State {
  version: 9;
  settings: GraphSettings;
  expressions: {
    list: ItemAug[];
    ticker?: TickerAug;
  };
}

export interface GraphSettings {
  randomSeed?: string;
  viewport: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
  /**
   * Minor subdivisions should be from 0 to 5, inclusive
   * 0 = auto
   * 1 = no minor grid lines
   * 2 to 5 = that many minor or major grid lines per major grid line
   */
  xAxisMinorSubdivisions?: number;
  yAxisMinorSubdivisions?: number;
  degreeMode?: boolean;
  showGrid?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  xAxisNumbers?: boolean;
  yAxisNumbers?: boolean;
  polarNumbers?: boolean;
  /**
   * The UI lets users type in any latex for the axis steps, but they get stored as numbers
   * 0 = auto
   */
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
}

export type ArrowMode = "NONE" | "POSITIVE" | "BOTH";

export interface TickerAug {
  // The `open` property is removed in favor of an undefined `aug.expressions.ticker`
  handlerLatex: Latex.AnyChild;
  // minStepLatex of 0 corresponds to undefined
  minStepLatex: Latex.AnyChild;
  playing: boolean;
}

export type NonFolderAug = ExpressionAug | ImageAug | TableAug | TextAug;
export type ItemAug = FolderAug | NonFolderAug;

export interface BaseItemAug {
  id: string;
  secret: boolean;
  /**
   * The error flag is set to true when the Desmos to Aug conversion encounters
   * a parse error. If `item.type==="text"`, then `item.text` gives an error
   * message.
   *
   * The error flag is ignored in the conversion of Aug back to Desmos.
   */
  error?: boolean;
}

export interface BaseNonFolderAug extends BaseItemAug {
  // pinned is a DesModder flag
  pinned: boolean;
}

export interface ExpressionAug extends BaseNonFolderAug {
  type: "expression";
  color: string | Latex.Identifier;
  latex?: Latex.AnyRootOrChild;
  // label=undefined corresponds to label: false in Raw
  label?: LabelStyle;
  hidden: boolean;
  // errorHidden and glesmos are DesModder flags
  errorHidden: boolean;
  glesmos: boolean;
  points?: PointStyle;
  lines?: LineStyle;
  // fillOpacity=0 corresponds to fill: false in Raw
  fillOpacity: Latex.AnyChild;
  regression?: RegressionData;
  displayEvaluationAsFraction: boolean;
  slider: SliderData;
  polarDomain?: DomainAug;
  // In Raw GraphState, `domain` is the same as `parametricDomain` (migration)
  parametricDomain?: DomainAug;
  cdf?: {
    min?: Latex.AnyChild;
    max?: Latex.AnyChild;
  };
  vizProps: {
    boxplot?: {
      breadth: Latex.AnyChild;
      axisOffset: Latex.AnyChild;
      alignedAxis: "x" | "y";
      showOutliers: boolean;
    };
    // the string "binned" is never actually checked,
    // just inferred by the absence of "exact"
    dotplotMode?: "exact" | "binned";
    // -- applies to dotplot and histogram only:
    binAlignment?: "left" | "center";
    // -- applies to histogram only:
    // the string "count" is never actually checked,
    // just inferred by the absence of "relative" and "density"
    histogramMode?: "count" | "relative" | "density";
  };
  clickableInfo?: BaseClickable;
}

export interface TableColumnAug {
  type: "column";
  id: string;
  values: Latex.AnyChild[];
  color: string | Latex.Identifier;
  latex: Latex.AnyChild;
  hidden: boolean;
  points?: PointStyle;
  lines?: LineStyle;
}

export interface TableAug extends BaseNonFolderAug {
  type: "table";
  // The first column will always be set to hidden: true in Raw
  // regardless of its hidden value
  columns: TableColumnAug[];
}

export interface BaseClickable {
  // enabled is inferred by the presence of this object
  // description is the screen reader label. empty = undefined
  description: string;
  latex: Latex.AnyChild;
}

export interface DomainAug {
  min: Latex.AnyChild;
  max: Latex.AnyChild;
}

export interface RegressionData {
  residualVariable?: Latex.Identifier;
  regressionParameters: Map<Latex.Identifier, number>;
  isLogMode: boolean;
}

export interface LabelStyle {
  // TODO: replace text: string with (string | Identifier)[] or similar,
  // to handle string interpolation
  text: string;
  // size=0 also sets label: false
  size: Latex.AnyChild;
  orientation: LabelOrientation;
  // angle=0 is default
  angle: Latex.AnyChild;
  // outline is the negation of suppressTextOutline
  outline: boolean;
  showOnHover: boolean;
  // Raw uses editableMode === undefined to represent not-editable
  editableMode: "MATH" | "TEXT" | "NONE";
}

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

export interface PointStyle {
  // pointOpacity=0 or pointSize=0 corresponds to points: false in Raw
  opacity: Latex.AnyChild;
  size: Latex.AnyChild;
  style: "POINT" | "OPEN" | "CROSS";
  dragMode: "NONE" | "X" | "Y" | "XY" | "AUTO";
}

export interface LineStyle {
  // lineOpacity=0 or lineWidth=0 corresponds to lines: false in Raw
  opacity: Latex.AnyChild;
  width: Latex.AnyChild;
  style: "SOLID" | "DASHED" | "DOTTED";
}

export interface SliderData {
  // hardMin=true on Raw iff min is defined
  // hardMax=true on Raw iff max is defined
  period?: number;
  loopMode?:
    | "LOOP_FORWARD_REVERSE"
    | "LOOP_FORWARD"
    | "PLAY_ONCE"
    | "PLAY_INDEFINITELY";
  playDirection?: 1 | -1;
  isPlaying?: boolean;
  min?: Latex.AnyChild;
  max?: Latex.AnyChild;
  step?: Latex.AnyChild;
}

export interface ImageAug extends BaseNonFolderAug {
  type: "image";
  image_url: string;
  name: string;
  width: Latex.AnyChild;
  height: Latex.AnyChild;
  center: Latex.AnyChild;
  angle: Latex.AnyChild;
  // opacity=0 also sets hidden=false on Raw
  opacity: Latex.AnyChild;
  foreground: boolean;
  draggable: boolean;
  clickableInfo?: BaseClickable & {
    hoveredImage?: string;
    depressedImage?: string;
  };
}

export interface FolderAug extends BaseItemAug {
  type: "folder";
  hidden: boolean;
  collapsed: boolean;
  title: string;
  children: NonFolderAug[];
}

export interface TextAug extends BaseNonFolderAug {
  type: "text";
  text: string;
}
