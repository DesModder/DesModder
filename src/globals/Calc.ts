interface DispatchedEvent {
  type: string,
  [key: string]: any
}

type DispatchListenerID = string

interface ScreenshotOptions {
  width?: number,
  height?: number,
  targetPixelRatio?: number,
  preserveAxisLabels?: boolean
}

interface AsyncScreenshotOptions extends ScreenshotOptions {
  format?: 'png' | 'svg',
  mode?: 'contain' | 'stretch' | 'preserveX' | 'preserveY',
  mathBounds?: {
    top?: number,
    left?: number,
    bottom?: number,
    right?: number
  },
  showLabels: boolean
}

interface BasicSetExpression {
  latex?: string,
  color?: string,
  lineStyle?: 'SOLID' | 'DASHED' | 'DOTTED',
  lineWidth?: number | string,
  lineOpacity?: number | string,
  pointStyle?: 'POINT' | 'OPEN' | 'CROSS',
  pointSize?: number | string,
  pointOpacity?: number | string,
  fillOpacity?: number | string,
  points?: boolean,
  lines?: boolean,
  hidden?: boolean,
  dragMode?: 'X' | 'Y' | 'XY' | 'NONE' | 'AUTO'
}

export interface ExpressionModel extends BasicSetExpression {
  type?: 'expression',
  fill?: boolean,
  secret?: boolean,
  sliderBounds?: {
    min: string,
    max: string,
    step?: string | undefined
  },
  parametricDomain?: {
    min: string,
    max: string
  },
  polarDomain?: {
    min: string,
    max: string
  },
  id?: string,
  label?: string,
  showLabel?: boolean,
  labelSize?: 'small' | 'medium' | 'large',
  labelOrientation?: 'above' | 'below' | 'left' | 'right' | 'default'
}

interface TableColumn extends BasicSetExpression {
  values?: string[],
}

export interface TableModel {
  type: 'table',
  columns: TableColumn[],
  id?: string
}

export interface SimulationModel {
  id: string,
  type: 'simulation',
  clickableInfo: {
    description?: string,
    rules: Array<{
      id: string,
      expression: string,
      assignment: string
    }>
  }
}

type ItemModel = SimulationModel | ExpressionModel | TableModel

interface GraphState {
  expressions: {
    list: ItemModel[]
  }
}

type SetExpressionObject = ExpressionModel | TableModel

type HelperType = 'numericValue' | 'listValue'

interface HelperExpression {
  numericValue: number | typeof NaN,
  listValue: number[] | undefined,
  observe (v: HelperType, callback: () => void): void,
  unobserve (v: HelperType): void
}

export interface Bounds {
  left: number,
  right: number,
  top: number,
  bottom: number
}

interface AugmentedBounds extends Bounds {
  width: number,
  height: number
}

export default interface Calc {
  //// undocumented, may break
  controller: {
    getPillboxBackgroundColor(): string,
    isGraphSettingsOpen(): boolean,
    dispatch(e: DispatchedEvent): void,
    getExpressionSearchStr(): string,
    dispatcher: {
      register(func: (e: DispatchedEvent) => void): DispatchListenerID,
      unregister(id: DispatchListenerID): void
    },
    getItemModel(id: any): ItemModel,
    stopPlayingSimulation(): void,
    stopAllSliders(): void,
    isKeypadOpen(): boolean,
    getKeypadHeight(): number
  },
  selectedExpressionId: string,
  //// public

  // ** state manipulation
  getState(): GraphState,
  // "Warning: Calculator states should be treated as opaque values.
  // Manipulating states directly may produce a result that cannot be loaded
  // by GraphingCalculator.setState."
  setState(state: GraphState, opts?: {
    allowUndo?: boolean,
    remapColors?: boolean
  }): void,
  setExpression(obj: SetExpressionObject): void,

  // ** screenshots
  screenshot(opts: ScreenshotOptions): string,
  asyncScreenshot(
    opts: AsyncScreenshotOptions,
    callback: (data: string) => void
  ): void,
  HelperExpression(obj: { latex: string }): HelperExpression,

  // ** bounds
  graphpaperBounds: {
    pixelCoordinates: AugmentedBounds,
    mathCoordinates: AugmentedBounds
  },
  setMathBounds(bounds: Bounds): void,
  observe(v: 'graphpaperBounds', callback: () => void): void
}
