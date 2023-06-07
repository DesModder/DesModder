import { ItemModel } from "./models";
import { GraphState } from "@desmodder/graph-state";

export const exprMetadata = [
  "set-expression-properties-from-api",
  "set-slider-isplaying",
  "set-slider-dragging",
  "set-slider-minlatex",
  "set-slider-maxlatex",
  "set-slider-steplatex",
  "set-slider-animationperiod",
  "set-image-name",
  "set-image-draggable",
  "set-image-opacity",
  "set-image-in-foreground",
  "set-item-dragmode",
  "set-item-points",
  "set-item-pointstyle",
  "set-item-lines",
  "set-item-linestyle",
  "set-item-arrow-mode",
  "set-item-labelSize",
  "set-item-labelangle",
  "set-item-label-orientation",
  "set-suppress-text-outline",
  "set-item-interactive-label",
  "set-item-editable-label-mode",
  "set-show-cdf",
  "set-cdf-min",
  "set-cdf-max",
  "toggle-item-hidden",
  "set-item-label",
  "set-item-showlabel",
  "set-item-color",
  "set-item-description",
  "set-item-fill",
  "set-item-fillopacity",
  "set-item-lineopacity",
  "set-item-pointopacity",
  "set-item-pointsize",
  "set-item-linewidth",
  "set-item-colorlatex",
  "set-item-secret",
  "set-item-readonly",
  "set-visualization-prop",
  "set-clickableinfo-rule-latex",
  "set-hovered-image",
  "set-depressed-image",
] as const;

// Text Mode TODO (completionism):
//   | "add-item-to-end-from-api"
//   | "set-expression-properties"
//   | "insert-several-expressions"
//   | "set-folder-collapsed"
//   | "set-all-folders-collapsed"
// Text Mode TODO (tables):
//   | "set-tablecolumn-color"
//   | "set-tablecolumn-colorlatex"
//   | "toggle-tablecolumn-hidden"
//   | "set-tablecolumn-dragmode"
//   | "set-tablecolumn-lines"
//   | "set-tablecolumn-points"
//   | "set-tablecolumn-linestyle"
//   | "set-tablecolumn-linewidth"
//   | "set-tablecolumn-lineopacity"
//   | "set-tablecolumn-pointsize"
//   | "set-tablecolumn-pointopacity"
//   | "set-tablecolumn-pointstyle"
// Text Mode TODO (images):
// | "set-image-mq-attribute"
// Text Mode TODO (Geometry?):
//   | "update-all-selected-items"
//   | "toggle-label-for-all-selected-points"
// Text Mode TODO (maybe more reliable than on-evaluator-changes?):
//   | "on-move-points"
//   | "start-moving-points"
//   | "stop-moving-points"

export type DispatchedEvent =
  | {
      type:
        | "keypad/set-minimized"
        | "close-graph-settings"
        | "open-expression-search"
        | "close-expression-search"
        | "toggle-ticker"
        | "re-randomize"
        | "toggle-lock-viewport"
        | "grapher/drag-end"
        | "set-axis-limit-latex"
        | "commit-user-requested-viewport"
        | "zoom"
        | "set-graph-settings"
        | "resize-exp-list"
        | "set-none-selected"
        | "toggle-graph-settings"
        | "clear-unsaved-changes"
        | "undo";
    }
  | {
      type:
        | "action-single-step"
        | "duplicate-folder"
        | "duplicate-expression"
        | "convert-image-to-draggable"
        | (typeof exprMetadata)[number];
      id: string;
    }
  | {
      type: "set-selected-id";
      id: string;
      // Added to avoid feedback loop. Desmos will pass this through ignored.
      dsmFromTextModeSelection?: boolean;
    }
  | {
      type: "set-focus-location";
      location: { type: string };
    }
  | {
      type: "on-evaluator-changes";
      changes: Record<string, EvaluatorChange>;
      timingData: TimingData;
    }
  | {
      type: "set-state";
      opts: {
        allowUndo?: boolean;
        // Added to avoid feedback loop. Desmos will pass this through ignored.
        fromTextMode?: boolean;
      };
      state: GraphState;
    };

/**
 * Evaluator change: a change set associated with a single id, passed back from
 * the evaluator. Do not use these values for any logic because Desmos has some
 * more complicated handling; instead, use them to filter for relevant evaluator
 * changes and know what might have changed without waiting for an update from
 * Calc.observeEvent("change", ...), which heavily throttles updates.
 *
 * Other changes not given in the change event (so don't use it alone): log
 * mode regression, regression residual variable, regression parameters,
 * displayed table columns, more?
 */
interface EvaluatorChange {
  /**
   * (Expressions) New number value for slider change or action update, or
   * constant value of constant expression
   */
  constant_value?: number;
  /** (Expressions) New number value for slider change or action update */
  raw_slider_latex?: string;
  /** (Expressions) New list value for action update */
  zero_values?: [{ val: number | number[] }];
  /**
   * Expressions: [x, y] new point positions
   * Images: [width, height, x, y] movement of image
   * updateCoordinate = change latex; updateSlider = handle elsewhere
   */
  move_strategy?: { type: "updateCoordinate" | "updateSlider" }[];
  /** (Expressions, images, (ticker)?) New action to be applied on the next click. Ignore */
  action_value?: unknown;
  /** (Regression expressions) Regression metadata */
  regression?: unknown;
  /** (Tables) column changes from dragging points */
  column_data?: unknown[];
}

/**
 * Timing data for evaluator updates
 * What exactly is being cached is currently unknown
 * Most properties are self explanatory
 * publishAllStatuses is
 * timeInWorker is the total time taken across all parts of re-evaluation
 */
export interface TimingData {
  cacheHits: number;
  cacheMisses: number;
  cacheReads: number;
  cacheWrites: number;
  computeAllLabels: number;
  computeAriaDescriptions: number;
  graphAllChanges: number;
  processStatements: number;
  publishAllStatuses: number;
  timeInWorker: number;
  updateAnalysis: number;
  updateIntersections: number;
}

export interface TopLevelComponents {
  headerController: {
    graphsController: {
      getCurrentGraphTitle: () => string | undefined;
    };
  };
}

interface Toast {
  message: string;
  undoCallback?: () => void;
  toastStyle?: "error";
  /** Number of ms, non-positive means never hide (until "x" close button) */
  hideAfter?: number;
}

interface CalcPrivate {
  /// / undocumented, may break
  controller: {
    // _removeExpressionSynchronously(model: ItemModel): void;
    _toplevelReplaceItemAt: (
      index: number,
      model: ItemModel,
      shouldFocus: boolean
    ) => void;
    createItemModel: (modelTemplate: any) => ItemModel;
    getPillboxBackgroundColor: () => string;
    isGraphSettingsOpen: () => boolean;
    dispatch: (e: DispatchedEvent) => void;
    getExpressionSearchStr: () => string;
    dispatcher: {
      register: (func: (e: DispatchedEvent) => void) => string;
      unregister: (id: string) => void;
    };
    getTickerPlaying?: () => boolean;
    // The item models returned are actually much more detailed
    getSelectedItem: () => ItemModel | undefined;
    getItemModel: (id: any) => ItemModel | undefined;
    getItemModelByIndex: (index: number) => ItemModel | undefined;
    getAllItemModels: () => ItemModel[];
    stopAllSliders: () => void;
    isKeypadOpen: () => boolean;
    getKeypadHeight: () => number;
    isDegreeMode: () => boolean;
    getExpressionSearchOpen: () => boolean;
    generateId: () => string;
    // returns a subscript that occurs nowhere else in the graph
    generateTableXSubscript: () => number;
    updateViews: () => void;
    updateTheComputedWorld: () => void;
    commitUndoRedoSynchronously: (e: { type: string }) => void;
    evaluator: {
      workerPoolConnection: {
        killWorker: () => void;
      };
    };
    listModel: unknown;
    _addItemToEndFromAPI: (item: ItemModel) => void;
    _showToast: (toast: Toast) => void;
    getViewState: () => {
      viewport: {
        xmin: number;
        ymin: number;
        xmax: number;
        ymax: number;
      };
    };
    /** Mark UI tick required to convert render shells to full item lines */
    markTickRequiredNextFrame: () => void;
    getPlayingSliders: () => { latex: string }[];
    _tickSliders: (nowTimestamp: number) => void;
    computeMajorLayout: () => { grapher: { width: number } };
    isGeometry: () => boolean;
    isGeoUIActive: () => boolean;
    isNarrowGeometryHeader: () => boolean;
    expressionSearchOpen: boolean;
  };
  _calc: {
    globalHotkeys: TopLevelComponents;
  };
  /// / public

  // ** state manipulation
  getState: () => GraphState;
  // "Warning: Calculator states should be treated as opaque values.
  // Manipulating states directly may produce a result that cannot be loaded
  // by GraphingCalculator.setState."
  setState: (
    state: GraphState,
    opts?: {
      allowUndo?: boolean;
      remapColors?: boolean;
    }
  ) => void;
}

type Calc = CalcPrivate & Desmos.Calculator;
export default Calc;
