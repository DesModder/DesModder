/**
 * This file includes type definition for internal graph state models.
 * These have more information than the graph state related to getState and setState.
 */

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
  folderId?: string;
  secret?: boolean;
  error?: any;
  formula?: {
    expression_type:
      | "X_OR_Y"
      | "SINGLE_POINT"
      | "POINT_LIST"
      | "PARAMETRIC"
      | "POLAR"
      | "IMPLICIT"
      | "POLYGON"
      | "HISTOGRAM"
      | "DOTPLOT"
      | "BOXPLOT"
      | "TTEST"
      | "STATS"
      | "CUBE"
      | "SPHERE";
    is_graphable: boolean;
    is_inequality: boolean;
    action_value?: Record<string, string>;
  };
}

interface BaseClickable {
  enabled?: boolean;
  // description is the screen reader label
  description?: string;
  latex?: string;
}

export interface ExpressionModel extends BasicSetExpression, ItemModelBase {
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
}

interface TableColumn extends BasicSetExpression {
  values?: string[];
}

export interface TableModel extends ItemModelBase {
  type: "table";
  columns: TableColumn[];
  columnModels: { draggable: boolean }[];
}

export interface TextModel extends ItemModelBase {
  type: "text";
  text?: string;
}

export interface ImageModel extends ItemModelBase {
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

export interface FolderModel {
  type: "folder";
  // cannot have a folderId
  id: string;
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
