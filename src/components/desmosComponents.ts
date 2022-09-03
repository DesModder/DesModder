import { ClassComponent } from "DCGView";
import { Calc, desmosRequire } from "globals/window";

abstract class CheckboxComponent extends ClassComponent<{
  checked: boolean;
  disabled?: boolean;
  small?: boolean;
  ariaLabel: string;
  onChange: (checked: boolean) => void;
}> {}

export const Checkbox: typeof CheckboxComponent = desmosRequire(
  "dcgview-helpers/checkbox"
).Checkbox;

interface MathQuillField {
  keystroke(key: string, e: KeyboardEvent): void;
  latex(): string;
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
  getFocusedMathquill(): MathQuillField;
} = desmosRequire("dcgview-helpers/mathquill-view").default;

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

export const InlineMathInputView: typeof InlineMathInputViewComponent =
  desmosRequire("expressions/inline-math-input-view").InlineMathInputView;

abstract class ForComponent<T> extends ClassComponent<{
  each: Array<T>;
  key(t: T): string | number;
}> {}

interface IfElseSecondParam {
  true(): typeof ClassComponent;
  false(): typeof ClassComponent;
}

export const {
  If,
  For,
  IfDefined,
  IfElse,
  Input,
  Switch,
  SwitchUnion,
  Textarea,
} = desmosRequire("dcgview").Components as {
  For: typeof ForComponent;
  If: typeof ClassComponent;
  IfElse(p: () => boolean, v: IfElseSecondParam): typeof ClassComponent;
  // I don't know how to use the rest of these
  IfDefined: typeof ClassComponent;
  Input: typeof ClassComponent;
  Switch: typeof ClassComponent;
  SwitchUnion: typeof ClassComponent;
  Textarea: typeof ClassComponent;
};

abstract class DStaticMathquillViewComponent extends ClassComponent<{
  latex: string;
  config: any;
}> {}

export const DStaticMathquillView: typeof DStaticMathquillViewComponent =
  desmosRequire("dcgview-helpers/static-mathquill-view").default;

abstract class TooltipComponent extends ClassComponent<{
  tooltip: string;
  gravity?: "n" | "e" | "s" | "w";
}> {}

export const Tooltip: typeof TooltipComponent = desmosRequire(
  "shared-components/tooltip"
).Tooltip;
