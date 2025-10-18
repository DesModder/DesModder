import { DCGViewModule } from "../DCGView";
import Node from "#parsing/parsenode.ts";
import DSM from "#DSM";
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
} from "../components/desmosComponents";
import { GenericSettings, PluginID } from "../plugins";
import { ItemModel, ValueType, ValueTypeMap } from "./models";
import { GraphState } from "../../graph-state";
import { GraphLibraryEntry } from "#plugins/graph-library/index.ts";

export interface DWindow extends Window {
  DesModder: any;
  DSM: DSM;
  DesModderPreload?: {
    pluginsForceDisabled: Set<PluginID>;
    pluginsEnabled: Record<PluginID, boolean | undefined>;
    pluginSettings: Record<PluginID, GenericSettings | undefined>;
    graphLibrary: GraphLibraryEntry[];
  };
  DesModderFragile: {
    ExpressionView: ExpressionViewComponent;
    ImageIconView: typeof IconViewComponent;
  };
  Desmos: Desmos;
}

type DesmosPublic = typeof Desmos;
interface Desmos extends DesmosPublic {
  Private: {
    Fragile: Fragile;
    Mathtools: Mathtools;
    Parser: Parser;
    MathquillConfig: MathquillConfig;
  };
  MathQuill: {
    config: (config: MathQuillConfig) => Desmos["MathQuill"];
  };
}

export interface LabelOptionsBase {
  zeroCutoff?: number;
  smallCutoff?: number;
  bigCutoff?: number;
  digits?: number;
  displayAsFraction?: boolean;
  addEllipses?: boolean;
  spaceConstrained?: boolean;
  scientificNotationDigits?: number;
}

type ComponentEmitType = "decimalString" | "latex" | (string & {});

interface Mathtools {
  Label: {
    truncatedLatexLabel: (
      label: ValueTypeMap[ValueType.Number],
      labelOptions?: LabelOptionsBase
    ) => string;
    pointLabel: (
      label: ValueTypeMap[ValueType.Point],
      labelOptions?: LabelOptionsBase,
      emitComponentsAs?: ComponentEmitType
    ) => string;
    point3dLabel: (
      label: ValueTypeMap[ValueType.Point3D],
      labelOptions?: LabelOptionsBase,
      emitComponentsAs?: ComponentEmitType
    ) => string;
    complexNumberLabel: (
      label: ValueTypeMap[ValueType.Complex],
      labelOptions?: LabelOptionsBase & {
        alwaysEmitImaginary?: boolean;
      },
      emitComponentsAs?: ComponentEmitType
    ) => string;
  };
  migrateToLatest: (s: GraphState) => GraphState;
}

export interface Parser {
  parse: (
    s: string,
    config?: {
      allowDt?: boolean;
      allowIndex?: boolean;
      disallowFrac?: boolean;
      trailingComma?: boolean;
      seedPrefix?: string;
      allowIntervalComprehensions?: boolean;
      disableParentheses?: boolean;
      disabledFeatures?: string[];
    }
  ) => Node;
}

interface MathquillConfig {
  getAutoCommands: (options?: {
    disallowAns?: boolean;
    disallowFrac?: boolean;
    additionalCommands?: string[];
  }) => string;
  getAutoOperators: (options?: {
    additionalOperators?: string[];
    includeGeometryFunctions?: boolean;
    include3DFunctions?: boolean;
    newStats?: boolean;
  }) => string;
}

declare let window: DWindow;

export default window;

interface Fragile {
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
  ExpressionOptionsMenuView: {
    prototype: {
      getSections: {
        apply: (m: { model: ItemModel }) => Section[];
      };
    };
  };
  evaluateLatex: (s: string, getDegreeMode: boolean) => number;
  Keys: {
    lookup: (e: KeyboardEvent) => string;
    lookupChar: (e: KeyboardEvent) => string;
    isUndo: (e: KeyboardEvent) => boolean;
    isRedo: (e: KeyboardEvent) => boolean;
    isHelp: (e: KeyboardEvent) => boolean;
  };
  List: {
    removeItemById: (listModel: any, id: string) => void;
    moveItemsTo: (listModel: any, from: number, to: number, n: number) => void;
  };
  currentLanguage: () => string;
  glslHeader: string;
}

export const Fragile = new Proxy(
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  {} as Fragile,
  {
    get(_target, prop: keyof Fragile) {
      return window.Desmos?.Private?.Fragile?.[prop];
    },
  }
);

type Section = "colors-only" | "lines" | "points" | "fill" | "label" | "drag";

type Private = Desmos["Private"];
export const Private = new Proxy(
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  {} as Private,
  {
    get(_target, prop: keyof Private) {
      return window.Desmos?.Private?.[prop];
    },
  }
);

/* Object.fromEntries based on https://dev.to/svehla/typescript-object-fromentries-389c */
type DeepWriteable<T> = { -readonly [P in keyof T]: DeepWriteable<T[P]> };
type FromEntries<T> = T extends [infer Key, any][]
  ? {
      [K in Key extends string ? Key : string]: Extract<T[number], [K, any]>[1];
    }
  : Record<string, any>;

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
