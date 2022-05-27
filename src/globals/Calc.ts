import { GraphState } from "@desmodder/graph-state";
import { ItemModel } from "./models";
import "desmos";

interface DispatchedEvent {
  type: string;
  [key: string]: any;
}

type DispatchListenerID = string;

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
      register(func: (e: DispatchedEvent) => void): DispatchListenerID;
      unregister(id: DispatchListenerID): void;
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
    _showToast(toast: { message: string }): void;
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
