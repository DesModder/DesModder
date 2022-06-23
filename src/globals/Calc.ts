import { GraphState } from "@desmodder/graph-state";
import { ItemModel } from "./models";
import "desmos";

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
        | "resize-exp-list";
    }
  | {
      type:
        | "action-single-step"
        | "toggle-item-hidden"
        | "duplicate-folder"
        | "duplicate-expression";
      id: string;
    }
  | {
      type: "set-focus-location";
      location: { type: string };
    }
  | {
      type: "on-evaluator-changes";
      changes: {
        [id: string]: EvaluatorChange;
      };
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
  /** New number value for slider change or action update */
  constant_value?: number;
  raw_slider_value?: string;
  /** New list value for action update */
  zero_values?: [{ val: number | number[] }];
  /** New point positions, OR viewport panned with draggable point on top */
  move_strategy?: unknown;
  /** New action to be applied on the next click. Ignore */
  action_value?: unknown;
  /** Regression metadata */
  regression?: unknown;
}

interface CalcPrivate {
  //// undocumented, may break
  myGraphsWrapper: {
    graphsController: {
      getCurrentGraphTitle(): string | undefined;
    };
  };
  controller: {
    // _removeExpressionSynchronously(model: ItemModel): void;
    _toplevelReplaceItemAt(
      index: number,
      model: ItemModel,
      shouldFocus: boolean
    ): void;
    createItemModel(modelTemplate: any): ItemModel;
    getPillboxBackgroundColor(): string;
    isGraphSettingsOpen(): boolean;
    dispatch(e: DispatchedEvent): void;
    getExpressionSearchStr(): string;
    dispatcher: {
      register(func: (e: DispatchedEvent) => void): string;
      unregister(id: string): void;
    };
    getTickerPlaying?(): boolean;
    // The item models returned are actually much more detailed
    getSelectedItem(): ItemModel | undefined;
    getItemModel(id: any): ItemModel | undefined;
    getItemModelByIndex(index: number): ItemModel | undefined;
    getAllItemModels(): ItemModel[];
    stopAllSliders(): void;
    isKeypadOpen(): boolean;
    getKeypadHeight(): number;
    isDegreeMode(): boolean;
    getExpressionSearchOpen(): boolean;
    generateId(): string;
    // returns a subscript that occurs nowhere else in the graph
    generateTableXSubscript(): number;
    updateViews(): void;
    updateTheComputedWorld(): void;
    commitUndoRedoSynchronously(e: { type: string }): void;
    evaluator: {
      workerPoolConnection: {
        killWorker(): void;
      };
    };
    listModel: unknown;
    _addItemToEndFromAPI(item: ItemModel): void;
    _showToast(toast: { message: string; undoCallback?: () => void }): void;
    getViewState(): {
      viewport: {
        xmin: number;
        ymin: number;
        xmax: number;
        ymax: number;
      };
    };
  };
  //// public

  // ** state manipulation
  getState(): GraphState;
  // "Warning: Calculator states should be treated as opaque values.
  // Manipulating states directly may produce a result that cannot be loaded
  // by GraphingCalculator.setState."
  setState(
    state: GraphState,
    opts?: {
      allowUndo?: boolean;
      remapColors?: boolean;
    }
  ): void;
}

type Calc = CalcPrivate & Desmos.Calculator;
export default Calc;
