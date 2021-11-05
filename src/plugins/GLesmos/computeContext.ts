import { Calc, desmosRequire, ItemModel } from "desmodder";
import {
  AnyNode,
  FunctionDefinition,
  ChildExprNode,
  Constant,
  Seed,
  IRExpression,
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
  is_inequality?: boolean;
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

export interface Analysis {
  concreteTree:
    | IRExpression
    | {
        type: "error" | "SolvedEquation";
      };
  evaluationState: EvalStatus;
  policy: unknown;
  rawTree: AnyNode;
}

export interface ComputedContext {
  // incomplete
  evaluationMode: "graphing";
  analysis: {
    [K: string]: Analysis;
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

/*

TODO: instead of computeContext, use:

- send compiled code from worker
  - look into core/math/context -> processStatements
    - removeStatement:
      - currently: ??
      - ADD: pass message to remove cached info for statement
    - addStatement:
      - currently:
        - this.statements[id] = Parser.parse(e.latex, ...)
        - also same to polarDomain and friends
        - this._notifyGraphComputed(a, s.graph(t), e)
          - s = a BaseComparator or something else
          - a = id
          - t = parentFrame {trigAngleMultiplier: 1}
          - e = { graphs: {}, intersections: {} }
  - core/math/features/graph
    - no no no, this triggers even when the viewport moves
    - override BaseComparator.prototype.graph =
  - core/math/plotter
    - no no no, this triggers even when the viewport moves
    - might still be helpful for disabling unwanted implicit sampling
    - override IMPLICIT branch of computeGraphData (calls sampleImplicit)
  - really anything in this chain can be overriden to avoid disabling unwanted implicit sampling
  - needs to be compiled *after* analysis is updated (to reconcile dependencies etc.)
    - updateAnalysis in core/math/context: the big for loop with the switch block goes in dependency order
    - AHA!: over in core/math/statementanalysis (just a big constructor):
      - compile from this.concreteTree
      - but need to conditionally do it based on some glesmos flag somewhere
- handle worker messages in processChangeSet from main/evaluator
*/

/*
TODO:
½ pass glesmos in userData along with addStatement from the main thread
  - successfully passed, but toggling the glesmos sliders doesn't instantly trigger a message to the worker
  - maybe have to look into changing .glesmos props on expressions inside __itemModelArray
  - or manually trigger addStatement
½ compile the glesmos code from this.conreteTree in core/math/statementanalysis
  ⬚ check for glesmos flag enabled
  ⬚ check for no error
⬚ send compiled glesmos code back during passMessage
  - currently working up from getCompiledFunction call in Base.prototype._graph in core/math/features/graph
    → want to remove getCompiledFunction in favor of getCompiledGLesmos when wanted
    - keep in mind that getCompliedFunction is also called in getCompiledDerivative
  - confirm via breakpoint in require("main/evaluator").Evaluator→processChangeSet

⬚ handle worker messages (containing the compiled glesmos code) in processChangeSet from main/evaluator
⬚ removeStatement handling?
*/

export default function computeContext() {
  const context = new Context();
  const changeSet = {
    isCompleteState: true,
    statements: {} as { [K: string]: ItemModel },
  };
  for (let stmt of Calc.controller.getAllItemModels()) {
    if (stmt.type !== "expression") continue;
    // stmt should be cloned, but core/lib/deepCopy threw an error
    changeSet.statements[stmt.id] = stmt;
  }
  context.processChangeSet(changeSet);
  context.updateAnalysis();
  return context as ComputedContext;
}
