/**
 * This file includes type definition for internal graph state models.
 * These have more information than the graph state related to getState and setState.
 */
import { ClassComponent } from "#DCGView";
import { CalcController } from ".";
import { GolfStats } from "../plugins/code-golf/golf-model";

interface BasicSetExpression {
  id: string;
  latex?: string;
  color?: string;
  lineStyle?: "SOLID" | "DASHED" | "DOTTED";
  lineWidth?: number | string;
  lineOpacity?: number | string;
  pointStyle?: "POINT" | "OPEN" | "CROSS";
  pointSize?: number | string;
  pointOpacity?: number | string;
  fillOpacity?: number | string;
  points?: boolean;
  lines?: boolean;
  hidden?: boolean;
  shouldGraph?: boolean;
  dragMode?: "X" | "Y" | "XY" | "NONE" | "AUTO";
}

interface ItemModelBase {
  id: string;
  controller: CalcController;
  index: number;
  renderShell: boolean;
  isHiddenFromUI: boolean;
  filteredBySearch?: boolean;
  readonly?: boolean;
  dsmGolfStats?: GolfStats;
  dsmEnableGolfDespiteLength?: boolean;
}

interface NonfolderItemModelBase extends ItemModelBase {
  folderId?: string;
  secret?: boolean;
  error?: any;
  formula?: {
    expression_type:
      | "X_OR_Y"
      // Soon, X_OR_Y will be removed in favor of the following two:
      | "X_OR_Y_EQUATION"
      | "X_OR_Y_INEQUALITY"
      | "SINGLE_POINT"
      | "POINT_LIST"
      | "PARAMETRIC"
      | "POLAR"
      | "IMPLICIT"
      // Soon, IMPLICIT will be removed in favor of the following two:
      | "IMPLICIT_EQUATION"
      | "IMPLICIT_INEQUALITY"
      | "POLYGON"
      | "HISTOGRAM"
      | "DOTPLOT"
      | "BOXPLOT"
      | "TTEST"
      | "STATS"
      | "CUBE"
      | "SPHERE"
      // There are many possible expression types due to 3d. No point writing them all out.
      | string;
    is_graphable: boolean;
    is_inequality: boolean;
    action_value?: Record<string, string>;
  };
  dcgView?: ClassComponent;
}

interface BaseClickable {
  enabled?: boolean;
  // description is the screen reader label
  description?: string;
  latex?: string;
}

export interface ExpressionModel
  extends BasicSetExpression,
    NonfolderItemModelBase {
  type?: "expression";
  fill?: boolean;
  secret?: boolean;
  sliderBounds?: {
    min: string;
    max: string;
    step?: string | undefined;
  };
  parametricDomain?: {
    min: string;
    max: string;
  };
  polarDomain?: {
    min: string;
    max: string;
  };
  label?: string;
  showLabel?: boolean;
  labelSize?: "small" | "medium" | "large";
  labelOrientation?:
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
  clickableInfo?: BaseClickable;
  shouldGraph?: boolean;
}

interface TableColumn extends BasicSetExpression {
  values?: string[];
}

export interface TableModel extends NonfolderItemModelBase {
  type: "table";
  columns: TableColumn[];
  columnModels: { draggable: boolean }[];
}

export interface TextModel extends NonfolderItemModelBase {
  type: "text";
  text?: string;
}

export interface ImageModel extends NonfolderItemModelBase {
  type: "image";
  image_url: string;
  angle?: string;
  center?: string;
  height?: string;
  width?: string;
  name?: string;
  opacity?: string;
  clickableInfo?: BaseClickable & {
    hoveredImage?: string;
    depressedImage?: string;
  };
}

export interface FolderModel extends ItemModelBase {
  type: "folder";
  folderId?: undefined;
  title?: string;
  secret?: boolean;
  error?: any;
}

export type ItemModel =
  | ExpressionModel
  | TableModel
  | TextModel
  | ImageModel
  | FolderModel;
