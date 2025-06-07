import { ItemModel } from "./models";
import { GraphState, ItemState, Product } from "../../graph-state";
import { MathQuillField } from "#components";
import { Matrix3 } from "./matrix3";
import type { DispatchedEvent } from "./extra-actions";

export type { DispatchedEvent };

export type VanillaDispatchedEvent =
  | {
      type:
        | "close-item-settings-menu"
        | "close-graph-settings"
        | "open-expression-search"
        | "close-expression-search"
        | "toggle-ticker"
        | "re-randomize"
        | "toggle-lock-viewport"
        | "grapher/drag-end"
        | "set-axis-limit-latex"
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
        | "update-expression-search-str"
        | "ui/container-resized"
        | "toggle-complex-mode"
        | "new-expression"
        | "new-expression-at-end";
    }
  | {
      type: "commit-user-requested-viewport";
      viewport: Viewport;
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
  | { type: "new-images"; files: File[] | FileList; id?: string }
  | {
      type: "image-upload-success";
      token: keyof CalcController["__pendingImageUploads"];
      url: string;
      width: `${number}`;
      height: `${number}`;
      name: string;
      id?: string;
    }
  | {
      type: "image-upload-error";
      token: keyof CalcController["__pendingImageUploads"];
      error: true;
    }
  | {
      type: "toast/show";
      toast: Toast;
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
  mygraphsController: {
    graphsController: {
      getCurrentGraphTitle: () => string | undefined;
    };
  };
}

export interface Toast {
  message: string;
  undoCallback?: () => void;
  toastStyle?: "error";
  /** Number of ms, non-positive means never hide (until "x" close button) */
  hideAfter?: number;
}

export interface Viewport {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
}

type ViewportClass = Viewport & { __isViewportClass: unknown };

export interface Grapher3d {
  controls: {
    worldRotation3D: Matrix3;
    axis3D: readonly [number, number, number];
    speed3D: number;
    lastRotateTime: number;
    copyWorldRotationToWorld: () => void;
    onTapStart: () => void;
    onTapMove: () => void;
    onTapUp: () => void;
    onMouseWheel: () => void;
  };
  viewportController: {
    animateToOrientation: (m: Matrix3) => void;
  };
  transition: {
    duration: number;
  };
}

export type Scale = "linear" | "logarithmic";

interface CalcPrivate {
  focusedMathQuill:
    | {
        mq: MathQuillField;
        typedText: (text: string) => void;
      }
    | undefined;
  /// / undocumented, may break
  controller: {
    rootElt: HTMLElement;
    isNarrow: () => boolean;
    handleDispatchedAction: (evt: DispatchedEvent) => void;
    _toplevelReplaceItemAt: (
      index: number,
      model: ItemModel,
      shouldFocus: boolean
    ) => void;
    _hasUnsavedChanges: boolean;
    createItemModel: (modelTemplate: ItemState) => ItemModel;
    isGraphSettingsOpen: () => boolean;
    graphSettings: {
      config: {
        product: Product;
        settingsMenu: boolean;
      };
      squareAxes: boolean;
      setProperty: (k: "squareAxes", v: boolean) => void;
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
    getDegreeMode: () => boolean;
    getExpressionSearchOpen: () => boolean;
    generateId: () => string;
    // returns a subscript that occurs nowhere else in the graph
    updateViews: () => void;
    updateTheComputedWorld: () => void;
    commitUndoRedoSynchronously: (e: { type: string }) => void;
    evaluator: {
      workerPoolConnection: {
        killWorker: () => void;
        sendMessage: (payload: unknown) => void;
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

      drawLayers: { layer: number; drawOrder: string[]; drawSet: string[] }[];
    };
    _addItemToEndFromAPI: (item: ItemModel) => void;
    _showToast: (toast: Toast) => void;
    removeListOfItems: (ids: string[]) => {
      // Might only return a subset of the models corresponding to `ids`
      // if some of the `ids` correspond to readonly expressions.
      deletedItems: ItemModel[];
      readonlyItemsNotDeleted: number;
    };
    getViewState: () => {
      viewport: Viewport;
      xAxisScale: Scale;
      yAxisScale: Scale;
    };
    /** Mark UI tick required to convert render shells to full item lines */
    markTickRequiredNextFrame: () => void;
    getPlayingSliders: () => { latex: string }[];
    _tickSliders: (nowTimestamp: number) => void;
    geometryGettingStartedMessageState: string;
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
    is3dProduct: () => boolean;
    grapher3d?: Grapher3d;
    getGrapher: () => {
      // Same API as the `Calc.asyncScreenshot` method, but this doesn't
      // create and wait for a shared calculator, so this is
      // actually a synchronous screenshot but with the extra
      // permitted options from the `asyncScreenshot` API.
      asyncScreenshot: Desmos.Calculator["asyncScreenshot"];
      // 2d only?
      viewportController: {
        setViewport: (vp: ViewportClass) => void;
      };
    };
    __nextItemId: number;
    __pendingImageUploads: Record<`${number}`, true>;
    isUploadingImages: () => boolean;
    areImagesEnabled: () => boolean;
    scrollSelectedItemIntoView: () => void;
    s: (identifier: string, placeables?: Record<string, any> | null) => string;
    runAfterDispatch: (cb: () => void) => void;
    getDefaultViewport: () => {
      constructor: { fromObject: (vp: Viewport) => ViewportClass };
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

export type Calc = CalcPrivate & Desmos.Calculator;
export type CalcController = Calc["controller"];
