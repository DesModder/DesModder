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
  ErrorType = 12,
  SeedType = 13,
  RGBColor = 14,
  ListOfColor = 15,
  Polygon = 16,
  ListOfPolygon = 17,
  Segment = 18,
  ListOfSegment = 19,
  Circle = 20,
  ListOfCircle = 21,
  Arc = 22,
  ListOfArc = 23,
  Line = 24,
  ListOfLine = 25,
  Ray = 26,
  ListOfRay = 27,
  Vector = 34,
  ListOfVector = 35,
  Restriction = 36,
  ListOfRestriction = 37,
  AngleMarker = 28,
  ListOfAngleMarker = 29,
  DirectedAngleMarker = 30,
  ListOfDirectedAngleMarker = 31,
  Transformation = 32,
  ListOfTransformation = 33,
  Segment3D = 102,
  ListOfSegment3D = 103,
  Triangle3D = 104,
  ListOfTriangle3D = 105,
  Sphere3D = 106,
  ListOfSphere3D = 107,
  Vector3D = 108,
  ListOfVector3D = 109,
  Tone = 50,
  ListOfTone = 51,
  ConfidenceInterval = 60,
  ListOfConfidenceInterval = 61,
  OneSampleTInference = 62,
  ListOfOneSampleTInference = 63,
  TwoSampleTInference = 64,
  ListOfTwoSampleTInference = 65,
  RegressionTInference = 76,
  ListOfRegressionTInference = 77,
  OneSampleZInference = 66,
  ListOfOneSampleZInference = 67,
  TwoSampleZInference = 68,
  ListOfTwoSampleZInference = 69,
  OneProportionZInference = 70,
  ListOfOneProportionZInference = 71,
  TwoProportionZInference = 72,
  ListOfTwoProportionZInference = 73,
  HypothesisTest = 74,
  ListOfHypothesisTest = 75,
  ChiSquareGoodnessOfFit = 78,
  ListOfChiSquareGoodnessOfFit = 79,
  ChiSquareIndependence = 80,
  ListOfChiSquareIndependence = 81,
  MapIntervalPoint = 200,
  MapIntervalComplex = 208,
  MapIntervalPoint3D = 201,
  MapInterval2DPoint = 202,
  MapInterval2DComplex = 209,
  MapInterval2DPoint3D = 203,
  ListOfMapIntervalPoint = 204,
  ListOfMapIntervalComplex = 210,
  ListOfMapIntervalPoint3D = 205,
  ListOfMapInterval2DPoint = 206,
  ListOfMapInterval2DComplex = 211,
  ListOfMapInterval2DPoint3D = 207,
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
  [ValueType.Any]: unknown;
  [ValueType.Number]: number;
  [ValueType.Bool]: boolean;
  [ValueType.Complex]: [re: number, im: number];
  [ValueType.ListOfComplex]: Array<ValueTypeMap[ValueType.Complex]>;
  [ValueType.Point]: [x: number, y: number];
  [ValueType.Point3D]: [x: number, y: number, z: number];
  // [ValueType.Distribution]: unknown;
  [ValueType.Action]: {
    type: "Action";
    updateRules: Record<
      string,
      TypedConstantValue<Exclude<ValueType, ValueType.Action>>
    >;
  };
  [ValueType.ListOfAny]: Array<ValueTypeMap[ValueType.Any]>;
  [ValueType.ListOfNumber]: Array<ValueTypeMap[ValueType.Number]>;
  [ValueType.ListOfBool]: Array<ValueTypeMap[ValueType.Bool]>;
  [ValueType.ListOfPoint]: Array<ValueTypeMap[ValueType.Point]>;
  [ValueType.ListOfPoint3D]: Array<ValueTypeMap[ValueType.Point3D]>;
  // [ValueType.ListOfDistribution]: Array<ValueTypeMap[ValueType.Distribution]>;
  [ValueType.EmptyList]: [];
  // couldn't be deduced; may not appear in typed_constant_value.
  // [ValueType.ErrorType]: unknown;
  // [ValueType.SeedType]: unknown;
  [ValueType.RGBColor]: [r: number, g: number, b: number];
  [ValueType.ListOfColor]: Array<ValueTypeMap[ValueType.RGBColor]>;
  [ValueType.Polygon]: Array<ValueTypeMap[ValueType.Point]>;
  [ValueType.ListOfPolygon]: Array<ValueTypeMap[ValueType.Polygon]>;
  [ValueType.Segment]: [
    start: ValueTypeMap[ValueType.Point],
    end: ValueTypeMap[ValueType.Point],
  ];
  [ValueType.ListOfSegment]: Array<ValueTypeMap[ValueType.Segment]>;
  [ValueType.Circle]: [center: ValueTypeMap[ValueType.Point], radius: number];
  [ValueType.ListOfCircle]: Array<ValueTypeMap[ValueType.Circle]>;
  [ValueType.Arc]: [
    p0: ValueTypeMap[ValueType.Point],
    p1: ValueTypeMap[ValueType.Point],
    p2: ValueTypeMap[ValueType.Point],
  ];
  [ValueType.ListOfArc]: Array<ValueTypeMap[ValueType.Arc]>;
  [ValueType.Line]: [
    p0: ValueTypeMap[ValueType.Point],
    p1: ValueTypeMap[ValueType.Point],
  ];
  [ValueType.ListOfLine]: Array<ValueTypeMap[ValueType.Line]>;
  [ValueType.Ray]: [
    origin: ValueTypeMap[ValueType.Point],
    direction: ValueTypeMap[ValueType.Point],
  ];
  [ValueType.ListOfRay]: Array<ValueTypeMap[ValueType.Ray]>;
  [ValueType.Vector]: [
    start: ValueTypeMap[ValueType.Point],
    end: ValueTypeMap[ValueType.Point],
  ];
  [ValueType.ListOfVector]: Array<ValueTypeMap[ValueType.Vector]>;
  // [ValueType.Restriction]: unknown;
  // [ValueType.ListOfRestriction]: Array<ValueTypeMap[ValueType.Restriction]>;
  [ValueType.AngleMarker]: [
    vertex: ValueTypeMap[ValueType.Point],
    startRad: number,
    sweepRad: number,
    trigAngleMultiplier: number,
  ];
  [ValueType.ListOfAngleMarker]: Array<ValueTypeMap[ValueType.AngleMarker]>;
  [ValueType.DirectedAngleMarker]: [
    vertex: ValueTypeMap[ValueType.Point],
    startRad: number,
    sweepRad: number,
    trigAngleMultiplier: number,
  ];
  [ValueType.ListOfDirectedAngleMarker]: Array<
    ValueTypeMap[ValueType.DirectedAngleMarker]
  >;
  [ValueType.Transformation]: [
    linear: ValueTypeMap[ValueType.Complex],
    translate: ValueTypeMap[ValueType.Complex],
    conjugate: boolean,
  ];
  [ValueType.ListOfTransformation]: Array<
    ValueTypeMap[ValueType.Transformation]
  >;
  [ValueType.Segment3D]: [
    start: ValueTypeMap[ValueType.Point3D],
    end: ValueTypeMap[ValueType.Point3D],
  ];
  [ValueType.ListOfSegment3D]: Array<ValueTypeMap[ValueType.Segment3D]>;
  [ValueType.Triangle3D]: [
    p0: ValueTypeMap[ValueType.Point3D],
    p1: ValueTypeMap[ValueType.Point3D],
    p2: ValueTypeMap[ValueType.Point3D],
  ];
  [ValueType.ListOfTriangle3D]: Array<ValueTypeMap[ValueType.Triangle3D]>;
  [ValueType.Sphere3D]: [
    center: ValueTypeMap[ValueType.Point3D],
    radius: number,
  ];
  [ValueType.ListOfSphere3D]: Array<ValueTypeMap[ValueType.Sphere3D]>;
  [ValueType.Vector3D]: [
    start: ValueTypeMap[ValueType.Point3D],
    end: ValueTypeMap[ValueType.Point3D],
  ];
  [ValueType.ListOfVector3D]: Array<ValueTypeMap[ValueType.Vector3D]>;
  [ValueType.Tone]: [frequency: number, gain: number];
  [ValueType.ListOfTone]: Array<ValueTypeMap[ValueType.Tone]>;
  // [ValueType.ConfidenceInterval]: unknown;
  // [ValueType.ListOfConfidenceInterval]: Array<
  //   ValueTypeMap[ValueType.ConfidenceInterval]
  // >;
  // [ValueType.OneSampleTInference]: unknown;
  // [ValueType.ListOfOneSampleTInference]: Array<
  //   ValueTypeMap[ValueType.OneSampleTInference]
  // >;
  // [ValueType.TwoSampleTInference]: unknown;
  // [ValueType.ListOfTwoSampleTInference]: Array<
  //   ValueTypeMap[ValueType.TwoSampleTInference]
  // >;
  // [ValueType.RegressionTInference]: unknown;
  // [ValueType.ListOfRegressionTInference]: Array<
  //   ValueTypeMap[ValueType.RegressionTInference]
  // >;
  // [ValueType.OneSampleZInference]: unknown;
  // [ValueType.ListOfOneSampleZInference]: Array<
  //   ValueTypeMap[ValueType.OneSampleZInference]
  // >;
  // [ValueType.TwoSampleZInference]: unknown;
  // [ValueType.ListOfTwoSampleZInference]: Array<
  //   ValueTypeMap[ValueType.TwoSampleZInference]
  // >;
  // [ValueType.OneProportionZInference]: unknown;
  // [ValueType.ListOfOneProportionZInference]: Array<
  //   ValueTypeMap[ValueType.OneProportionZInference]
  // >;
  // [ValueType.TwoProportionZInference]: unknown;
  // [ValueType.ListOfTwoProportionZInference]: Array<
  //   ValueTypeMap[ValueType.TwoProportionZInference]
  // >;
  // [ValueType.HypothesisTest]: unknown;
  // [ValueType.ListOfHypothesisTest]: Array<
  //   ValueTypeMap[ValueType.HypothesisTest]
  // >;
  // [ValueType.ChiSquareGoodnessOfFit]: unknown;
  // [ValueType.ListOfChiSquareGoodnessOfFit]: Array<
  //   ValueTypeMap[ValueType.ChiSquareGoodnessOfFit]
  // >;
  // [ValueType.ChiSquareIndependence]: unknown;
  // [ValueType.ListOfChiSquareIndependence]: Array<
  //   ValueTypeMap[ValueType.ChiSquareIndependence]
  // >;
  // [ValueType.MapIntervalPoint]: unknown;
  // [ValueType.MapIntervalComplex]: unknown;
  // [ValueType.MapIntervalPoint3D]: unknown;
  // [ValueType.MapInterval2DPoint]: unknown;
  // [ValueType.MapInterval2DComplex]: unknown;
  // [ValueType.MapInterval2DPoint3D]: unknown;
  // [ValueType.ListOfMapIntervalPoint]: Array<
  //   ValueTypeMap[ValueType.MapIntervalPoint]
  // >;
  // [ValueType.ListOfMapIntervalComplex]: Array<
  //   ValueTypeMap[ValueType.MapIntervalComplex]
  // >;
  // [ValueType.ListOfMapIntervalPoint3D]: Array<
  //   ValueTypeMap[ValueType.MapIntervalPoint3D]
  // >;
  // [ValueType.ListOfMapInterval2DPoint]: Array<
  //   ValueTypeMap[ValueType.MapInterval2DPoint]
  // >;
  // [ValueType.ListOfMapInterval2DComplex]: Array<
  //   ValueTypeMap[ValueType.MapInterval2DComplex]
  // >;
  // [ValueType.ListOfMapInterval2DPoint3D]: Array<
  //   ValueTypeMap[ValueType.MapInterval2DPoint3D]
  // >;
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
