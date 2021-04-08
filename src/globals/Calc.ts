interface DispatchedEvent {
  type: string,
  [key: string]: any
}

type DispatchListenerID = string

interface GraphState {
  expressions: {
    list: Array<{
      slider: any,
      label?: string,
      columns: any[],
      clickableInfo: {
        description?: string,
        rules: any[]
      },
      [k: string]: any
    }>
  }
}

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
    }
  },
  selectedExpressionId: string,
  //// public
  getState(): GraphState,
  // "Warning: Calculator states should be treated as opaque values.
  // Manipulating states directly may produce a result that cannot be loaded
  // by GraphingCalculator.setState."
  setState(state: GraphState, opts?: {
    allowUndo?: boolean,
    remapColors?: boolean
  }): void,
  screenshot(opts: ScreenshotOptions): string,
  asyncScreenshot(
    opts: AsyncScreenshotOptions,
    callback: (data: string) => void
  ): void
}
