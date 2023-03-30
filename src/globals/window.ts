import { DCGViewModule } from "../DCGView";
import {
  CheckboxComponent,
  DStaticMathquillViewComponent,
  InlineMathInputViewComponent,
  MathQuillField,
  MathQuillViewComponent,
  SegmentedControlComponent,
  TooltipComponent,
} from "../components/desmosComponents";
import CalcType from "./Calc";
import { ItemModel } from "./models";

interface windowConfig extends Window {
  Calc: CalcType;
  DesModder: any;
  DesModderForceDisabled?: Set<string>;
}

declare let window: windowConfig;

export default window;

// defer access of Calc.controller, Calc.observe, etc. to when they are called
// avoid Calc === undefined but window.Calc !== undefined
export const Calc = new Proxy(
  {},
  {
    get(_target, prop) {
      if (window.Calc === undefined) return undefined;
      if (prop in window.Calc) {
        return window.Calc[prop as keyof typeof window.Calc];
      }
    },
  }
) as CalcType;

export const Fragile = new Proxy(
  {},
  {
    get(_target, prop) {
      if ((window as any).Desmos === undefined) return undefined;
      const fragile = (window as any).Desmos?.Private?.Fragile;
      if (fragile === undefined) return undefined;
      return fragile[prop];
    },
  }
) as {
  DCGView: DCGViewModule;
  PromptSliderView: any;
  Checkbox: typeof CheckboxComponent;
  SegmentedControl: typeof SegmentedControlComponent;
  MathquillView: typeof MathQuillViewComponent & {
    // static abstract getFocusedMathquill()
    getFocusedMathquill: () => MathQuillField;
  };
  InlineMathInputView: typeof InlineMathInputViewComponent;
  StaticMathquillView: typeof DStaticMathquillViewComponent;
  Tooltip: typeof TooltipComponent;
  ExpressionOptionsMenuView: {
    prototype: {
      getSections: {
        apply: (m: { model: ItemModel }) => Section[];
      };
    };
  };
  evaluateLatex: (s: string, isDegreeMode: boolean) => number;
  Keys: {
    lookup: (e: KeyboardEvent) => string;
    lookupChar: (e: KeyboardEvent) => string;
    isUndo: (e: KeyboardEvent) => boolean;
    isRedo: (e: KeyboardEvent) => boolean;
    isHelp: (e: KeyboardEvent) => boolean;
  };
  jQuery: any;
  getQueryParams: () => Record<string, string | true>;
  getReconciledExpressionProps: (
    type: string,
    model?: ItemModel
  ) => {
    points: boolean;
    lines: boolean;
    fill: boolean;
  };
  List: {
    removeItemById: (listModel: any, id: string) => void;
    moveItemsTo: (listModel: any, from: number, to: number, n: number) => void;
  };
  currentLanguage: () => string;
};

type Section = "colors-only" | "lines" | "points" | "fill" | "label" | "drag";

export const Private = new Proxy(
  {},
  {
    get(_target, prop) {
      if ((window as any).Desmos === undefined) return undefined;
      const priv = (window as any).Desmos.Private;
      if (priv === undefined) return undefined;
      return priv[prop];
    },
  }
) as any;

/* Object.fromEntries based on https://dev.to/svehla/typescript-object-fromentries-389c */
type DeepWriteable<T> = { -readonly [P in keyof T]: DeepWriteable<T[P]> };
type FromEntries<T> = T extends [infer Key, any][]
  ? {
      [K in Key extends string ? Key : string]: Extract<T[number], [K, any]>[1];
    }
  : { [key in string]: any };

export type FromEntriesWithReadOnly<T> = FromEntries<DeepWriteable<T>>;

declare global {
  interface ObjectConstructor {
    // eslint-disable-next-line @typescript-eslint/method-signature-style
    fromEntries<T>(obj: T): FromEntriesWithReadOnly<T>;
  }
}
