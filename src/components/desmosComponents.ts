import { ClassComponent, DCGView } from "DCGView";
import { Calc, Fragile } from "globals/window";

abstract class CheckboxComponent extends ClassComponent<{
  checked: boolean;
  disabled?: boolean;
  small?: boolean;
  ariaLabel: string;
  onChange: (checked: boolean) => void;
}> {}

export const Checkbox: typeof CheckboxComponent = Fragile.Checkbox;

abstract class SegmentedControlComponent extends ClassComponent<{
  ariaGroupLabel: string;
  minButtonWidth?: number;
  disabled?: boolean;
  theme?: "mini" | "default";
  staticConfig: {
    key: string;
    label: () => string;
    ariaLabel?: () => string;
    selected: () => boolean;
    onSelect: () => void;
    icon?: () => string;
    tooltip?: () => unknown;
    tooltipGravity?: () => unknown;
    class?: () => string;
    focusHelperOptions?: unknown;
  }[];
}> {}

export const DesmosSegmentedControl: typeof SegmentedControlComponent =
  Fragile.SegmentedControl;

interface MathQuillField {
  keystroke: (key: string, e: KeyboardEvent) => void;
  latex: () => string;
}

abstract class MathQuillViewComponent extends ClassComponent<{
  latex: string;
  capExpressionSize: number | false;
  config: { autoOperatorNames: string };
  isFocused: boolean;
  getAriaLabel: string;
  getAriaPostLabel: string;
  onUserChangedLatex: (s: string) => void;
  onUserPressedKey?: (key: string, e: KeyboardEvent) => void;
  hasError?: boolean;
  selectOnFocus?: boolean;
  needsSystemKeypad?: boolean;
  onFocusedChanged?: (isFocused: boolean) => void;
  noFadeout?: boolean;
}> {}

export const MathQuillView: typeof MathQuillViewComponent & {
  // static abstract getFocusedMathquill()
  getFocusedMathquill: () => MathQuillField;
} = Fragile.MathquillView;

abstract class InlineMathInputViewComponent extends ClassComponent<{
  latex: string;
  // capExpressionSize: number | false;
  // config: { autoOperatorNames: string };
  isFocused: boolean;
  ariaLabel: string;
  // ariaPostLabel: string;
  placeholder?: string;
  handleLatexChanged: (s: string) => void;
  handlePressedKey?: (key: string, e: KeyboardEvent) => void;
  hasError?: boolean;
  selectOnFocus?: boolean;
  needsSystemKeypad?: boolean;
  handleFocusChanged?: (isFocused: boolean) => void;
  noFadeout?: boolean;
  readonly: boolean;
  controller: typeof Calc.controller;
}> {}

/** General InlineMathInputView, without any defaults filled in */
export const InlineMathInputViewGeneral: typeof InlineMathInputViewComponent =
  Fragile.InlineMathInputView;

export const {
  If,
  For,
  IfDefined,
  IfElse,
  Input,
  Switch,
  SwitchUnion,
  Textarea,
} = DCGView.Components;

abstract class DStaticMathquillViewComponent extends ClassComponent<{
  latex: string;
  config: any;
}> {}

export const DStaticMathquillView: typeof DStaticMathquillViewComponent =
  Fragile.StaticMathquillView;

abstract class TooltipComponent extends ClassComponent<{
  tooltip: string;
  gravity?: "n" | "e" | "s" | "w";
}> {}

export const Tooltip: typeof TooltipComponent = Fragile.Tooltip;
