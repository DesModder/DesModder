import { DCGViewModule } from "#DCGView";
import {
  CheckboxComponent,
  DStaticMathquillViewComponent,
  ExpressionViewComponent,
  IconViewComponent,
  InlineMathInputViewComponent,
  MathQuillField,
  MathQuillViewComponent,
  SegmentedControlComponent,
  TooltipComponent,
  MathQuillConfig,
} from "#components";
import { Calc } from "./Calc";
import { ItemModel } from "./models";
import { GraphState } from "@desmodder/graph-state";
// Removed to avoid circular import:
// import { GenericSettings, PluginID } from "../plugins";
type PluginID = any;
type GenericSettings = any;
type DSM = any;

export interface DWindow extends Window {
  /** @deprecated Don't use Calc directly, unless you're doing global setup for
   * the whole extension. Reference a specific `calc` object instead. */
  Calc: Calc;
  DesModder: any;
  DSM: DSM;
  DesModderPreload?: {
    pluginsForceDisabled: Set<PluginID>;
    pluginsEnabled: Record<PluginID, boolean | undefined>;
    pluginSettings: Record<PluginID, GenericSettings | undefined>;
  };
  Desmos: {
    Private: {
      Fragile: typeof Fragile;
      Mathtools: Mathtools;
    };
    MathQuill: {
      config: (config: MathQuillConfig) => DWindow["Desmos"]["MathQuill"];
    };
  };
}

interface Mathtools {
  Label: {
    truncatedLatexLabel: (
      label: string,
      labelOptions: {
        smallCutoff: 0.00001;
        bigCutoff: 1000000;
        digits: 5;
        displayAsFraction: false;
      }
    ) => string;
  };
  migrateToLatest: (s: GraphState) => GraphState;
}

declare let window: DWindow;

export default window;

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
    getFocusedMathquill: () => MathQuillField | undefined;
  };
  InlineMathInputView: typeof InlineMathInputViewComponent;
  StaticMathquillView: typeof DStaticMathquillViewComponent;
  Tooltip: typeof TooltipComponent;
  ExpressionView: typeof ExpressionViewComponent;
  ImageIconView: typeof IconViewComponent;
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
  getQueryParams: () => Record<string, string | true>;
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

/**
 * Use `Console.warn` and related methods for logs that should be released
 * Use `console.log` (lowercase) when you're debugging, to avoid accidental commit
 * Use `/* eslint-disable no-console` and lowercase `console.log` on node scripts
 */
export const Console = ((globalThis ?? window) as any).console;
