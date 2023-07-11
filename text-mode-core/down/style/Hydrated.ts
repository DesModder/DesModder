import { AnyChild as Expr } from "../../aug/AugLatex";
import type { LabelOrientation } from "@desmodder/graph-state";

export type AnyHydrated =
  | Settings
  | Ticker
  | ItemBase
  | NonFolderBase
  | ColumnExpressionCommon
  | Clickable
  | Expression
  | Regression
  | Table
  | Column
  | Image
  | Folder;

export type AnyHydratedValue =
  | number
  | boolean
  | string
  | Expr
  | undefined
  | null;

export interface Settings {
  viewport: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
  squareAxes: boolean;
  randomSeed: string;
  xAxisLabel: string;
  yAxisLabel: string;
  xAxisArrowMode: "NONE" | "POSITIVE" | "BOTH";
  yAxisArrowMode: "NONE" | "POSITIVE" | "BOTH";
  xAxisMinorSubdivisions: number;
  yAxisMinorSubdivisions: number;
  xAxisStep: number;
  yAxisStep: number;
  degreeMode: boolean;
  showGrid: boolean;
  showXAxis: boolean;
  showYAxis: boolean;
  xAxisNumbers: boolean;
  yAxisNumbers: boolean;
  polarNumbers: boolean;
  restrictGridToFirstQuadrant: boolean;
  polarMode: boolean;
  lockViewport: boolean;
}

export interface Ticker {
  minStep: Expr;
  playing: boolean;
}

export interface ItemBase {
  secret: boolean;
}

export interface NonFolderBase extends ItemBase {
  pinned: boolean;
}

export interface ColumnExpressionCommon {
  color: Expr | string;
  hidden: boolean;
  points?:
    | {
        opacity: Expr;
        size: Expr;
        style: "POINT" | "OPEN" | "CROSS";
        drag: "NONE" | "X" | "Y" | "XY" | "AUTO";
      }
    | boolean;
  lines?:
    | {
        opacity: Expr;
        width: Expr;
        style: "SOLID" | "DASHED" | "DOTTED";
      }
    | boolean;
}

export interface Clickable {
  onClick: Expr | null;
  clickDescription: string;
}

// TODO: split hydrated expr based on regression, function definition, etc.
export interface Expression
  extends NonFolderBase,
    ColumnExpressionCommon,
    Clickable {
  label?: {
    text: string;
    size: Expr;
    orientation: LabelOrientation;
    angle: Expr;
    outline: boolean;
    showOnHover: boolean;
    editableMode: "MATH" | "TEXT" | "NONE";
  };
  errorHidden: boolean;
  glesmos: boolean;
  fill?: Expr;
  displayEvaluationAsFraction: boolean;
  slider?: {
    playing: boolean;
    reversed: boolean;
    loopMode:
      | "LOOP_FORWARD_REVERSE"
      | "LOOP_FORWARD"
      | "PLAY_ONCE"
      | "PLAY_INDEFINITELY";
    period: number;
    min?: Expr;
    max?: Expr;
    step?: Expr;
  };
  domain?: {
    min?: Expr;
    max?: Expr;
  };
  cdf?: {
    min?: Expr;
    max?: Expr;
  };
  // TODO vizProps
  // vizProps:
}

export interface Regression extends NonFolderBase {
  errorHidden: boolean;
  logMode: boolean;
}

export interface Table extends NonFolderBase {}

export interface Column extends ColumnExpressionCommon {}

export interface Image extends NonFolderBase, Clickable {
  width: Expr;
  height: Expr;
  center: Expr;
  angle: Expr;
  opacity: Expr;
  foreground: boolean;
  draggable: boolean;
  url: string;
  hoveredImage: string;
  depressedImage: string;
}

export interface Folder extends ItemBase {
  hidden: boolean;
  collapsed: boolean;
}
