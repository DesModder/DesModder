import { ClassComponent, LooseProps } from 'DCGView'
import { desmosRequire } from 'globals/window'

type TCC = typeof ClassComponent

export const Pillbox: TCC = desmosRequire('main/pillbox-view').default
export const Checkbox: TCC = desmosRequire('dcgview-helpers/checkbox').Checkbox

type MaybeFunc<T> = (() => T) | T

interface MathQuillViewArgs extends LooseProps {
  latex: MaybeFunc<string>,
  capExpressionSize: MaybeFunc<number | false>,
  config: MaybeFunc<{autoOperatorNames: string}>,
  isFocused: MaybeFunc<boolean>,
  getAriaLabel: MaybeFunc<string>,
  getAriaPostLabel: MaybeFunc<string>,
  onUserChangedLatex: (s: string) => void,
  onUserPressedKey: (key: string, e: KeyboardEvent) => void,
}

interface MathQuillField {
  keystroke (key: string, e: KeyboardEvent): void,
  latex () : string
}

interface MathQuillViewType extends ClassComponent {
  new (props: MathQuillViewArgs): void,
  getFocusedMathquill: () => MathQuillField
}

export const MathQuillView: MathQuillViewType =
  desmosRequire('dcgview-helpers/mathquill-view').default

export const {
  If, For, IfDefined, IfElse, Input, Switch, SwitchUnion, Textarea
} = desmosRequire('dcgview').Components as {[key: string]: TCC}

export const StaticMathquillView: TCC = desmosRequire('dcgview-helpers/static-mathquill-view').default
export const Tooltip: TCC = desmosRequire('shared-components/tooltip').Tooltip
