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
  rootViewNode: HTMLElement;
}

export enum ValueType {
  Any = 0,
  Number = 1,
  Bool = 2,
  Complex = 38,
  ListOfComplex = 39,
  Point = 3,
  Point3D = 100,
  Distribution = 4,
  Action = 5,
  ListOfAny = 6,
  ListOfNumber = 7,
  ListOfBool = 8,
  ListOfPoint = 9,
  ListOfPoint3D = 101,
  ListOfDistribution = 10,
  EmptyList = 11,
  RGBColor = 14,
  ListOfColor = 15,
  // omitted
}

interface FormulaBase {
  exported_variables?: string[];
  is_graphable: boolean;
  action_value?: Record<string, string>;
}

interface NonfolderItemModelBase extends ItemModelBase {
  folderId?: string;
  secret?: boolean;
  error?: any;
  formula?: FormulaBase;
  dcgView?: ClassComponent;
}

interface ValueTypeMap {
  [ValueType.EmptyList]: [];
  [ValueType.Number]: number;
  [ValueType.ListOfNumber]: number[];
  [ValueType.Point]: [number, number];
  [ValueType.ListOfPoint]: [number, number][];
  [ValueType.Point3D]: [number, number, number];
  [ValueType.ListOfPoint3D]: [number, number, number][];
  [ValueType.Complex]: [number, number];
  [ValueType.ListOfComplex]: [number, number][];
  [ValueType.RGBColor]: [number, number, number];
  [ValueType.ListOfColor]: [number, number, number][];
  [key: number]: unknown;
}

export type TypedConstantValue<T extends ValueType = ValueType> = T extends T
  ? {
      valueType: T;
      value: ValueTypeMap[T];
    }
  : never;

export interface ExpressionFormula extends FormulaBase {
  is_inequality?: boolean;
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
    | (string & {});
  typed_constant_value?: TypedConstantValue | undefined;
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
  formula?: ExpressionFormula;
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
