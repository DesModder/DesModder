import { ItemModel } from "./models";
import { GraphState } from "@desmodder/graph-state";
import { MathQuillField } from "#components";

export type DispatchedEvent =
  | {
      type:
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
        | "undo"
        | "tick"
        | "redo"
        | "tick-ticker"
        | "keypad/functions"
        | "commit-geo-objects"
        | "upward-delete-selected-expression"
        | "downward-delete-selected-expression"
        | "ui/container-resized";
    }
  | {
      type: "keypad/set-minimized";
      minimized: boolean;
    }
  | {
      type:
        | "action-single-step"
        | "duplicate-folder"
        | "duplicate-expression"
        | "convert-image-to-draggable"
        | "create-sliders-for-item"
        | "toggle-item-hidden"
        | "delete-item-and-animate-out"
        | "move-focus-to-item";
      id: string;
    }
  | {
      /** This is somewhat a super type of all the `DispatchedEvent`s. It's here
       * to avoid annotating tons of types for modify.ts. This should really be
       * `type: "set-slider-minlatex" | (100 others)`, but that's unmaintainable.
       * A second best would be `type: "string"`, but that screws with the
       * other types being useful. */
      type: "__dummy-IDEvent";
      id?: string;
    }
  | {
      type: "set-selected-id";
      id: string;
      // Added to avoid feedback loop. Desmos will pass this through ignored.
      dsmFromTextModeSelection?: boolean;
    }
  | {
      type: "set-focus-location";
      location: { type: "expression"; id: string } | { type: string };
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
    }
  | {
      // Note: this has more parameters. I just haven't found a need for them yet.
      type: "set-item-latex";
      latex: string;
      id: string;
    }
  | {
      type: "on-special-key-pressed";
      key: string;
      // used in compact-view plugin
      forceSwitchExpr?: boolean;
    }
  | {
      type: "update-all-selected-items";
      update: {
        // folderId is 'move these objects to folder'
        // Everything else is simply styling
        prop: "folderId" | string;
      };
    }
  | { type: "set-folder-collapsed"; id: string; isCollapsed: boolean }
  | { type: "set-item-colorLatex"; id: string; colorLatex: string }
  | { type: "set-note-text"; id: string; text: string };

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
  focusedMathQuill:
    | {
        mq: MathQuillField;
      }
    | undefined;
  /// / undocumented, may break
  controller: {
    rootElt: HTMLElement;
    isNarrow: () => boolean;
    // _removeExpressionSynchronously(model: ItemModel): void;
    handleDispatchedAction: (evt: DispatchedEvent) => void;
    _toplevelReplaceItemAt: (
      index: number,
      model: ItemModel,
      shouldFocus: boolean
    ) => void;
    createItemModel: (modelTemplate: any) => ItemModel;
    getPillboxBackgroundColor: () => string;
    isGraphSettingsOpen: () => boolean;
    graphSettings: {
      config: {
        product: string;
      };
    };
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
    getAllSelectedItems: () => ItemModel[];
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
      notifyWhenSynced: (cb: () => void) => void;
    };
    listModel: {
      // add properties as needed
      __itemModelArray: {
        id: string;
        colorLatex: string;
        folderId: string;
        type: "folder" | "expression";
      }[];
      __itemIdToModel: Record<string, ItemModel>;

      drawOrder: string[];
    };
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
    /** Returns a function to call to unsubscribe */
    subscribeToChanges: (cb: () => void) => () => void;
    getBackgroundColor: () => string;
    isInEditListMode: () => boolean;
    getMathquillConfig: (e: { additionalOperators?: string[] }) => {
      autoOperatorNames: string;
      autoCommands: string;
    };
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
