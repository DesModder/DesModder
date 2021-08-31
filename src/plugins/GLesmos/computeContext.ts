import { Calc, desmosRequire, ItemModel } from "desmodder";
import {
  AnyNode,
  FunctionDefinition,
  ChildExprNode,
  Constant,
  Seed,
} from "parsing/parsenode";
const Context = desmosRequire("core/math/context").Context;

// core/math/expression_types
type ExprType =
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

type Operator = "=" | ">" | ">=" | "<" | "<=";

interface EvalStatus {
  // incomplete
  assignment?: string;
  is_single_identifier?: boolean;
  is_graphable?: boolean;
  color_latex_valid?: boolean;
  label_angle_valid?: boolean;
  label_angle_value: number;
  label_size_valid?: boolean;
  line_opacity_valid?: boolean;
  line_width_valid?: boolean;
  point_opacity_valid?: boolean;
  point_size_valid?: boolean;
  operator?: Operator;
  expression_type?: ExprType;
}

export interface ComputedContext {
  // incomplete
  evaluationMode: "graphing";
  analysis: {
    [K: string]: {
      concreteTree: unknown;
      evaluationState: EvalStatus;
      policy: unknown;
      rawTree: AnyNode;
    };
  };
  currentStatus: {
    [K: string]: EvalStatus;
  };
  frame: {
    [K: string]: FunctionDefinition | ChildExprNode | ParentFrameEntry;
    // FunctionDefinition for functions only
    // ChildExprNode for ans and variables
  };
  parentFrame: {
    [K: string]: ParentFrameEntry;
    globalRandomSeed: Seed;
  };
  statements: {
    // Could probably be narrowed
    [K: string]: Statement;
  };
}

// parentFrame has built-in functions and constants
// abs: {isFunction: true}
// e: Constant
// trigAngleMultiplier: Constant
type ParentFrameEntry = { isFunction: true } | Constant | Seed;

// be careful of NaN
type MetaNum = number[] | number;

export type Statement = AnyNode & {
  metaData: ComputedMetadata;
  userData: ItemModel;
};

export interface ComputedMetadata {
  colorLatex?: ChildExprNode;
  colorLatexValue?: string | string[]; // e.g. #ff2200 or a list of these
  computedFillOpacity?: MetaNum;
  computedLabelAngle?: MetaNum;
  computedLabelSize?: MetaNum;
  computedLineOpacity?: MetaNum;
  computedLineWidth?: MetaNum;
  computedPointOpacity?: MetaNum;
  computedPointSize?: MetaNum;
  extraDepNodes?: ChildExprNode[];
  labelSize?: ChildExprNode[];
}

export default function computeContext() {
  const context = new Context();
  const changeSet = {
    isCompleteState: true,
    statements: {} as { [K: string]: ItemModel },
  };
  for (let stmt of Calc.controller.getAllItemModels()) {
    // stmt should be cloned, but core/lib/deepCopy threw an error
    changeSet.statements[stmt.id] = stmt;
  }
  context.processChangeSet(changeSet);
  context.updateAnalysis();
  return context as ComputedContext;
}
