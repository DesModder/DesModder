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
  ChiSquareGoodnessOfFit = 78,
  ListOfChiSquareGoodnessOfFit = 79,
  ChiSquareIndependence = 80,
  ListOfChiSquareIndependence = 81,
  ZSignificanceTest = 82,
  ListOfZSignificanceTest = 83,
  TSignificanceTest = 84,
  ListOfTSignificanceTest = 85,
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

// commented-out lines indicate that the value doesn't appear in typed_constant_value
export interface ValueTypeMap {
  [ValueType.Any]: unknown;
  [ValueType.Number]: number;
  [ValueType.Bool]: boolean;
  [ValueType.Complex]: [real: number, imag: number];
  [ValueType.ListOfComplex]: ValueTypeMap[ValueType.Complex][];
  [ValueType.Point]: [x: number, y: number];
  [ValueType.Point3D]: [x: number, y: number, z: number];
  // [ValueType.Distribution]: unknown;
  [ValueType.Action]: {
    type: "Action";
    updateRules: Record<string, TypedConstantValue<ActionRHSValueType>>;
  };
  [ValueType.ListOfAny]: ValueTypeMap[ValueType.Any][];
  [ValueType.ListOfNumber]: ValueTypeMap[ValueType.Number][];
  [ValueType.ListOfBool]: ValueTypeMap[ValueType.Bool][];
  [ValueType.ListOfPoint]: ValueTypeMap[ValueType.Point][];
  [ValueType.ListOfPoint3D]: ValueTypeMap[ValueType.Point3D][];
  // [ValueType.ListOfDistribution]: ValueTypeMap[ValueType.Distribution][];
  [ValueType.EmptyList]: [];
  // [ValueType.ErrorType]: unknown;
  // [ValueType.SeedType]: unknown;
  [ValueType.RGBColor]: [r: number, g: number, b: number];
  [ValueType.ListOfColor]: ValueTypeMap[ValueType.RGBColor][];
  [ValueType.Polygon]: ValueTypeMap[ValueType.Point][];
  [ValueType.ListOfPolygon]: ValueTypeMap[ValueType.Polygon][];
  [ValueType.Segment]: [
    start: ValueTypeMap[ValueType.Point],
    end: ValueTypeMap[ValueType.Point],
  ];
  [ValueType.ListOfSegment]: ValueTypeMap[ValueType.Segment][];
  [ValueType.Circle]: [center: ValueTypeMap[ValueType.Point], radius: number];
  [ValueType.ListOfCircle]: ValueTypeMap[ValueType.Circle][];
  [ValueType.Arc]: [
    p0: ValueTypeMap[ValueType.Point],
    p1: ValueTypeMap[ValueType.Point],
    p2: ValueTypeMap[ValueType.Point],
  ];
  [ValueType.ListOfArc]: ValueTypeMap[ValueType.Arc][];
  [ValueType.Line]: [
    p0: ValueTypeMap[ValueType.Point],
    p1: ValueTypeMap[ValueType.Point],
  ];
  [ValueType.ListOfLine]: ValueTypeMap[ValueType.Line][];
  [ValueType.Ray]: [
    origin: ValueTypeMap[ValueType.Point],
    direction: ValueTypeMap[ValueType.Point],
  ];
  [ValueType.ListOfRay]: ValueTypeMap[ValueType.Ray][];
  [ValueType.Vector]: [
    vector: ValueTypeMap[ValueType.Point],
    start: ValueTypeMap[ValueType.Point],
  ];
  [ValueType.ListOfVector]: ValueTypeMap[ValueType.Vector][];
  // [ValueType.Restriction]: unknown;
  // [ValueType.ListOfRestriction]: ValueTypeMap[ValueType.Restriction][];
  [ValueType.AngleMarker]: [
    vertex: ValueTypeMap[ValueType.Point],
    startRad: number,
    sweepRad: number,
    trigAngleMultiplier: number,
  ];
  [ValueType.ListOfAngleMarker]: ValueTypeMap[ValueType.AngleMarker][];
  [ValueType.DirectedAngleMarker]: [
    vertex: ValueTypeMap[ValueType.Point],
    startRad: number,
    sweepRad: number,
    trigAngleMultiplier: number,
  ];
  [ValueType.ListOfDirectedAngleMarker]: ValueTypeMap[ValueType.DirectedAngleMarker][];
  [ValueType.Transformation]: [
    linear: ValueTypeMap[ValueType.Complex],
    translate: ValueTypeMap[ValueType.Complex],
    conjugate: boolean,
  ];
  [ValueType.ListOfTransformation]: ValueTypeMap[ValueType.Transformation][];
  [ValueType.Segment3D]: [
    start: ValueTypeMap[ValueType.Point3D],
    end: ValueTypeMap[ValueType.Point3D],
  ];
  [ValueType.ListOfSegment3D]: ValueTypeMap[ValueType.Segment3D][];
  [ValueType.Triangle3D]: [
    p0: ValueTypeMap[ValueType.Point3D],
    p1: ValueTypeMap[ValueType.Point3D],
    p2: ValueTypeMap[ValueType.Point3D],
  ];
  [ValueType.ListOfTriangle3D]: ValueTypeMap[ValueType.Triangle3D][];
  [ValueType.Sphere3D]: [
    center: ValueTypeMap[ValueType.Point3D],
    radius: number,
  ];
  [ValueType.ListOfSphere3D]: ValueTypeMap[ValueType.Sphere3D][];
  [ValueType.Vector3D]: [
    vector: ValueTypeMap[ValueType.Point3D],
    start: ValueTypeMap[ValueType.Point3D],
  ];
  [ValueType.ListOfVector3D]: ValueTypeMap[ValueType.Vector3D][];
  [ValueType.Tone]: [frequency: number, gain: number];
  [ValueType.ListOfTone]: ValueTypeMap[ValueType.Tone][];
  [ValueType.ConfidenceInterval]: [
    min: number,
    max: number,
    standardError: number,
    dof: number,
  ];
  [ValueType.ListOfConfidenceInterval]: ValueTypeMap[ValueType.ConfidenceInterval][];
  [ValueType.OneSampleTInference]: [
    count: number,
    mean: number,
    stdev: number,
    dof: number,
  ];
  [ValueType.ListOfOneSampleTInference]: ValueTypeMap[ValueType.OneSampleTInference][];
  [ValueType.TwoSampleTInference]: [
    count1: number,
    mean1: number,
    stdev1: number,
    count2: number,
    mean2: number,
    stdev2: number,
    dof: number,
  ];
  [ValueType.ListOfTwoSampleTInference]: ValueTypeMap[ValueType.TwoSampleTInference][];
  [ValueType.RegressionTInference]: [
    pointEstimate: number,
    standardError: number,
    dof: number,
  ];
  [ValueType.ListOfRegressionTInference]: ValueTypeMap[ValueType.RegressionTInference][];
  [ValueType.OneSampleZInference]: [
    count: number,
    mean: number,
    stdevp: number,
  ];
  [ValueType.ListOfOneSampleZInference]: ValueTypeMap[ValueType.OneSampleZInference][];
  [ValueType.TwoSampleZInference]: [
    count1: number,
    mean1: number,
    stdevp1: number,
    count2: number,
    mean2: number,
    stdevp2: number,
  ];
  [ValueType.ListOfTwoSampleZInference]: ValueTypeMap[ValueType.TwoSampleZInference][];
  [ValueType.OneProportionZInference]: [successes: number, count: number];
  [ValueType.ListOfOneProportionZInference]: ValueTypeMap[ValueType.OneProportionZInference][];
  [ValueType.TwoProportionZInference]: [
    successes1: number,
    count1: number,
    successes2: number,
    count2: number,
  ];
  [ValueType.ListOfTwoProportionZInference]: ValueTypeMap[ValueType.TwoProportionZInference][];
  [ValueType.ChiSquareGoodnessOfFit]: [
    p: number,
    score: number,
    dof: number,
    observed: number[],
    expected: number[],
    contributions: number[],
    total: number,
  ];
  [ValueType.ListOfChiSquareGoodnessOfFit]: ValueTypeMap[ValueType.ChiSquareGoodnessOfFit][];
  [ValueType.ChiSquareIndependence]: [
    p: number,
    score: number,
    dof: number,
    observed: number[],
    expected: number[],
    contributions: number[],
    rows: number,
    columns: number,
    rowTotals: number[],
    columnTotals: number[],
    total: number,
  ];
  [ValueType.ListOfChiSquareIndependence]: ValueTypeMap[ValueType.ChiSquareIndependence][];
  [ValueType.ZSignificanceTest]: [
    p: number,
    score: number,
    hypothesis: number,
    pleft: number,
    pright: number,
  ];
  [ValueType.ListOfZSignificanceTest]: ValueTypeMap[ValueType.ZSignificanceTest][];
  [ValueType.TSignificanceTest]: [
    p: number,
    score: number,
    hypothesis: number,
    pleft: number,
    pright: number,
    dof: number,
  ];
  [ValueType.ListOfTSignificanceTest]: ValueTypeMap[ValueType.TSignificanceTest][];
  // [ValueType.MapIntervalPoint]: unknown;
  // [ValueType.MapIntervalComplex]: unknown;
  // [ValueType.MapIntervalPoint3D]: unknown;
  // [ValueType.MapInterval2DPoint]: unknown;
  // [ValueType.MapInterval2DComplex]: unknown;
  // [ValueType.MapInterval2DPoint3D]: unknown;
  // [ValueType.ListOfMapIntervalPoint]: ValueTypeMap[ValueType.MapIntervalPoint][];
  // [ValueType.ListOfMapIntervalComplex]: ValueTypeMap[ValueType.MapIntervalComplex][];
  // [ValueType.ListOfMapIntervalPoint3D]: ValueTypeMap[ValueType.MapIntervalPoint3D][];
  // [ValueType.ListOfMapInterval2DPoint]: ValueTypeMap[ValueType.MapInterval2DPoint][];
  // [ValueType.ListOfMapInterval2DComplex]: ValueTypeMap[ValueType.MapInterval2DComplex][];
  // [ValueType.ListOfMapInterval2DPoint3D]: ValueTypeMap[ValueType.MapInterval2DPoint3D][];
}

export type ConstantValueType = keyof ValueTypeMap;
export type TypedConstantValue<
  T extends ConstantValueType = ConstantValueType,
> = T extends T
  ? {
      valueType: T;
      value: ValueTypeMap[T];
    }
  : never;

export type ActionRHSValueType =
  | ValueType.EmptyList
  | OrListType<
      | ValueType.Number
      | ValueType.Complex
      | ValueType.Point
      | ValueType.Point3D
      | ValueType.RGBColor
      | ValueType.Polygon
      | ValueType.Segment
      | ValueType.Line
      | ValueType.Ray
      | ValueType.Vector
      | ValueType.Circle
      | ValueType.Arc
      | ValueType.AngleMarker
      | ValueType.Tone
      | ValueType.DirectedAngleMarker
    >;

type OrListType<T extends ListElementValueType> =
  | T
  | ReverseMap<ListElementTypeMap>[T];

type ReverseMap<T extends Record<keyof T, PropertyKey>> = {
  [K in keyof T as T[K]]: K;
};

export interface ListElementTypeMap {
  [ValueType.ListOfAny]: ValueType.Any;
  [ValueType.EmptyList]: ValueType.Number;
  [ValueType.ListOfNumber]: ValueType.Number;
  [ValueType.ListOfBool]: ValueType.Bool;
  [ValueType.ListOfComplex]: ValueType.Complex;
  [ValueType.ListOfRestriction]: ValueType.Restriction;
  [ValueType.ListOfPoint]: ValueType.Point;
  [ValueType.ListOfPoint3D]: ValueType.Point3D;
  [ValueType.ListOfDistribution]: ValueType.Distribution;
  [ValueType.ListOfColor]: ValueType.RGBColor;
  [ValueType.ListOfPolygon]: ValueType.Polygon;
  [ValueType.ListOfSegment]: ValueType.Segment;
  [ValueType.ListOfCircle]: ValueType.Circle;
  [ValueType.ListOfArc]: ValueType.Arc;
  [ValueType.ListOfLine]: ValueType.Line;
  [ValueType.ListOfRay]: ValueType.Ray;
  [ValueType.ListOfVector]: ValueType.Vector;
  [ValueType.ListOfAngleMarker]: ValueType.AngleMarker;
  [ValueType.ListOfDirectedAngleMarker]: ValueType.DirectedAngleMarker;
  [ValueType.ListOfTransformation]: ValueType.Transformation;
  [ValueType.ListOfSegment3D]: ValueType.Segment3D;
  [ValueType.ListOfVector3D]: ValueType.Vector3D;
  [ValueType.ListOfTriangle3D]: ValueType.Triangle3D;
  [ValueType.ListOfSphere3D]: ValueType.Sphere3D;
  [ValueType.ListOfTone]: ValueType.Tone;
  [ValueType.ListOfConfidenceInterval]: ValueType.ConfidenceInterval;
  [ValueType.ListOfOneSampleTInference]: ValueType.OneSampleTInference;
  [ValueType.ListOfTwoSampleTInference]: ValueType.TwoSampleTInference;
  [ValueType.ListOfRegressionTInference]: ValueType.RegressionTInference;
  [ValueType.ListOfOneSampleZInference]: ValueType.OneSampleZInference;
  [ValueType.ListOfTwoSampleZInference]: ValueType.TwoSampleZInference;
  [ValueType.ListOfOneProportionZInference]: ValueType.OneProportionZInference;
  [ValueType.ListOfTwoProportionZInference]: ValueType.TwoProportionZInference;
  [ValueType.ListOfZSignificanceTest]: ValueType.ZSignificanceTest;
  [ValueType.ListOfTSignificanceTest]: ValueType.TSignificanceTest;
  [ValueType.ListOfChiSquareGoodnessOfFit]: ValueType.ChiSquareGoodnessOfFit;
  [ValueType.ListOfChiSquareIndependence]: ValueType.ChiSquareIndependence;
  [ValueType.ListOfMapIntervalPoint]: ValueType.MapIntervalPoint;
  [ValueType.ListOfMapIntervalComplex]: ValueType.MapIntervalComplex;
  [ValueType.ListOfMapIntervalPoint3D]: ValueType.MapIntervalPoint3D;
  [ValueType.ListOfMapInterval2DPoint]: ValueType.MapInterval2DPoint;
  [ValueType.ListOfMapInterval2DComplex]: ValueType.MapInterval2DComplex;
  [ValueType.ListOfMapInterval2DPoint3D]: ValueType.MapInterval2DPoint3D;
}

export type ListValueType = keyof ListElementTypeMap;
export type ListElementValueType = ListElementTypeMap[ListValueType];

export type ConstantListValueType = Extract<ListValueType, ConstantValueType>;

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
