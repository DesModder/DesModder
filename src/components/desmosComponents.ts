import { ClassComponent } from 'DCGView'
import { desmosRequire } from 'globals/window'

export const Pillbox: ClassComponent = desmosRequire('main/pillbox-view').default
export const Checkbox: ClassComponent = desmosRequire('dcgview-helpers/checkbox').Checkbox

interface MathQuillField {
  keystroke (key: string, e: KeyboardEvent): void,
  latex () : string
}

abstract class MathQuillViewComponent extends ClassComponent<{
  latex: string,
  capExpressionSize: number | false,
  config: {autoOperatorNames: string},
  isFocused: boolean,
  getAriaLabel: string,
  getAriaPostLabel: string,
  onUserChangedLatex: (s: string) => void,
  onUserPressedKey?: (key: string, e: KeyboardEvent) => void,
  hasError?: boolean,
  selectOnFocus?: boolean,
  needsSystemKeypad?: boolean,
  onFocusedChanged?: () => void,
  noFadeout?: boolean
}> {}

export const MathQuillView: typeof MathQuillViewComponent & {
  getFocusedMathquill (): MathQuillField
} = desmosRequire('dcgview-helpers/mathquill-view').default

abstract class ForComponent<T> extends ClassComponent<{
  each: Array<T>,
  key(t: T): (string | number)
}> {}

export const {
  If, For, IfDefined, IfElse, Input, Switch, SwitchUnion, Textarea
} = desmosRequire('dcgview').Components as {
  For: typeof ForComponent,
  If: typeof ClassComponent,
  // I don't know how to use the rest of these
  IfDefined: typeof ClassComponent,
  IfElse: typeof ClassComponent,
  Input: typeof ClassComponent,
  Switch: typeof ClassComponent,
  SwitchUnion: typeof ClassComponent,
  Textarea: typeof ClassComponent,
}

abstract class DStaticMathquillViewComponent extends ClassComponent<{
  latex: string,
  config: any
}> {}

export const DStaticMathquillView: typeof DStaticMathquillViewComponent
  = desmosRequire('dcgview-helpers/static-mathquill-view').default

abstract class TooltipComponent extends ClassComponent<{
  tooltip: string,
  gravity?: 'n' | 'e' | 's' | 'w'
}> {}

export const Tooltip: typeof TooltipComponent
  = desmosRequire('shared-components/tooltip').Tooltip
