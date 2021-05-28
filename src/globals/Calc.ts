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
  dragMode?: "X" | "Y" | "XY" | "NONE" | "AUTO";
}

interface ItemModelBase {
  id: string;
  folderId?: string;
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
  labelOrientation?: "above" | "below" | "left" | "right" | "default";
}

interface TableColumn extends BasicSetExpression {
  values?: string[];
}

export interface TableModel extends ItemModelBase {
  type: "table";
  columns: TableColumn[];
}

export interface SimulationModel extends ItemModelBase {
  type: "simulation";
  clickableInfo?: {
    description?: string;
    rules: Array<{
      id: string;
      expression: string;
      assignment: string;
    }>;
  };
}

type ItemModel = SimulationModel | ExpressionModel | TableModel;

interface GraphState {
  expressions: {
    list: ItemModel[];
  };
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
    getPillboxBackgroundColor(): string;
    isGraphSettingsOpen(): boolean;
    dispatch(e: DispatchedEvent): void;
    getExpressionSearchStr(): string;
    dispatcher: {
      register(func: (e: DispatchedEvent) => void): DispatchListenerID;
      unregister(id: DispatchListenerID): void;
    };
    getItemModel(id: any): ItemModel;
    stopPlayingSimulation(): void;
    stopAllSliders(): void;
    isKeypadOpen(): boolean;
    getKeypadHeight(): number;
    isDegreeMode(): boolean;
    getExpressionSearchOpen(): boolean;
    generateId(): string;
    // returns a subscript that occurs nowhere else in the graph
    generateTableXSubscript(): number;
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
