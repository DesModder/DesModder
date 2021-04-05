import { ClassComponent } from 'DCGView'
import window from 'globals/window'

type TCC = typeof ClassComponent

export const Pillbox: TCC = window.require('main/pillbox-view').default
export const Checkbox: TCC = window.require('dcgview-helpers/checkbox').Checkbox
export const MathQuillView: TCC = window.require('dcgview-helpers/mathquill-view').default
export const {
  If, For, IfDefined, IfElse, Input, Switch, SwitchUnion, Textarea
} = window.require('dcgview').Components as {[key: string]: TCC}

export const StaticMathquillView: TCC = window.require('dcgview-helpers/static-mathquill-view').default
export const Tooltip: TCC = window.require('shared-components/tooltip').Tooltip
