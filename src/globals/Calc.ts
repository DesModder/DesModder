interface DispatchedEvent {
  type: string;
  [key: string]: any;
}

type DispatchListenerID = string;

interface ScreenshotOptions {
  width?: number;
  height?: number;
  targetPixelRatio?: number;
  preserveAxisLabels?: boolean;
}

interface AsyncScreenshotOptions extends ScreenshotOptions {
  format?: "png" | "svg";
  mode?: "contain" | "stretch" | "preserveX" | "preserveY";
  mathBounds?: {
    top?: number;
    left?: number;
    bottom?: number;
    right?: number;
  };
  showLabels: boolean;
}

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
  folderId?: string;
  secret?: boolean;
  error?: any;
  formula?: {
    expression_type:
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
    is_graphable: boolean;
    is_inequality: boolean;
    action_value?: {
      [K: string]: string;
    };
  };
}

interface BaseClickable {
  enabled?: boolean;
  // description is the screen reader label
  description?: string;
  latex?: string;
}

export interface ExpressionModel extends BasicSetExpression, ItemModelBase {
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
}

interface TableColumn extends BasicSetExpression {
  values?: string[];
}

export interface TableModel extends ItemModelBase {
  type: "table";
  columns: TableColumn[];
}

export interface TextModel extends ItemModelBase {
  type: "text";
  text?: string;
}

export interface ImageModel extends ItemModelBase {
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

export interface FolderModel {
  type: "folder";
  // cannot have a folderId
  id: string;
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

interface GraphState {
  version: 9;
  expressions: {
    list: ItemModel[];
    ticker?: Ticker;
  };
}

interface Ticker {
  handlerLatex?: string;
  minStepLatex?: string;
  open?: boolean;
  playing?: boolean;
}

type SetExpressionObject = ExpressionModel | TableModel;

type HelperType = "numericValue" | "listValue";

export interface HelperExpression {
  numericValue: number | typeof NaN;
  listValue: number[] | undefined;
  observe(v: HelperType, callback: () => void): void;
  unobserve(v: HelperType): void;
}

export interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface AugmentedBounds extends Bounds {
  width: number;
  height: number;
}

interface PublicCalculatorOptions {
  // https://www.desmos.com/api/v1.7/docs/index.html#document-graphing-calculator-constructor
  keypad: boolean;
  graphpaper: boolean;
  expressions: boolean;
  settingsMenu: boolean;
  zoomButtons: boolean;
  showResetButtonOnGraphpaper: boolean;
  expressionsTopbar: boolean;
  capExpressionSize: boolean;
  pointsOfInterest: boolean;
  trace: boolean;
  border: boolean;
  lockViewport: boolean;
  expressionsCollapsed: boolean;
  administerSecretFolders: boolean;
  advancedStyling: boolean;
  clickableObjects: boolean;
  images: boolean;
  // imageUploadCallback: omitted
  folders: boolean;
  notes: boolean;
  sliders: boolean;
  links: boolean;
  qwertyKeyboard: boolean;
  restrictedFunctions: boolean;
  forceEnableGeometryFunctions: boolean;
  pasteGraphLink: boolean;
  pasteTableData: boolean;
  degreeMode: boolean;
  clearIntoDegreeMode: boolean;
  autosize: boolean;
  plotSingleVariableImplicitEquations: boolean;
  plotImplicits: boolean;
  plotInequalities: boolean;
  // colors: omitted
  invertedColors: boolean;
  functionDefinition: boolean;
  projectorMode: boolean;
  decimalToFraction: boolean;
  fontSize: number;
  language: string; // over-generic
  backgroundColor: string;
  textColor: string;
  distributions: boolean;
  brailleMode: "none" | "nemeth" | "ueb";
  sixKeyInput: boolean;
  brailleControls: boolean;
  zoomFit: boolean;
  forceLogModeRegressions: boolean;
}

interface PrivateCalculatorOptions {
  showHamburger: boolean;
  disableScrollFix: boolean;
  branding: boolean;
  redrawSlowly: boolean;
  onlyTraceSelected: boolean;
  disableMouseInteractions: boolean;
  nativeOnscreenKeypad: boolean;
  plaidMode: boolean;
  // pasteGraphLinkCallback: omitted,
  editOnWeb: boolean;
  crossOriginSaveTest: boolean;
  enableTabindex: boolean;
  audioTraceReverseExpressions: boolean;
  transparentBackground: boolean;
}

type CalculatorOptions = PrivateCalculatorOptions & PublicCalculatorOptions;

type CalculatorOptionsAssign = {
  [Prop in keyof CalculatorOptions]?: CalculatorOptions[Prop];
};

export default interface Calc {
  //// undocumented, may break
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
  };
  selectedExpressionId: string;
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
  setExpression(obj: SetExpressionObject): void;
  setExpressions(objs: SetExpressionObject[]): void;
  removeExpression(obj: SetExpressionObject): void;
  removeExpressions(objs: SetExpressionObject[]): void;

  // ** screenshots
  screenshot(opts: ScreenshotOptions): string;
  asyncScreenshot(
    opts: AsyncScreenshotOptions,
    callback: (data: string) => void
  ): void;
  HelperExpression(obj: { latex: string }): HelperExpression;

  // ** bounds
  graphpaperBounds: {
    pixelCoordinates: AugmentedBounds;
    mathCoordinates: AugmentedBounds;
  };
  setMathBounds(bounds: Bounds): void;

  // ** events
  observe(v: "graphpaperBounds", callback: () => void): void;
  // should be observeEvent("change.namespace", callback) or similar
  observeEvent(v: string, callback: () => void): void;
  unobserveEvent(v: string): void;

  // ** graph settings
  settings: CalculatorOptions;
  updateSettings(s: CalculatorOptionsAssign): void;
}
