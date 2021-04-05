interface DispatchedEvent {
  type: string,
  [key: string]: any
}

interface windowConfig extends Window {
  require(s: string): any,
  Calc: {
    controller: {
      getPillboxBackgroundColor(): string,
      isGraphSettingsOpen(): boolean,
      dispatch(e: DispatchedEvent): void
    }
  },
  DesModder: any
}

declare var window: windowConfig

export default window
