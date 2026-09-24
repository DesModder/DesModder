/**
 * Everything Physics Lab keeps, whether or not its panel is open.
 *
 * The split exists on this plugin's first day because a slope field is a thing
 * the user switched on, and closing a popover is not a request to switch it
 * off. The panel is a view over this; only disabling the plugin destroys it.
 *
 * The shape follows Vector Tools' controller rather than inventing a second
 * arrangement: one normalised config, compiled to a `FlowField`, handed to an
 * overlay that owns its own canvas and writes nothing to the graph. What is
 * different is that none of it is Vector Tools' — the renderer now lives in
 * `src/field-rendering`, and both plugins draw through it.
 */
import { buildConfigFromGlobals, parseLatex } from "../../../text-mode-core";
import type { Aug, Config } from "../../../text-mode-core";
import { ArrowOverlay } from "../../field-rendering/ArrowOverlay";
import type { ArrowOptions } from "../../field-rendering/ArrowRenderer";
import { NO_COLOR_ADJUST } from "../../field-rendering/palettes";
import {
  compileFieldComponentToGLSL,
  EMPTY_ENVIRONMENT,
  type FieldEnvironment,
} from "../../field-rendering/latexToGLSL";
import type { FlowField } from "../../field-rendering/field";
import {
  environmentsDiffer,
  scanDefinitions,
} from "../../field-rendering/environment";
import { mentions, renameIdentifier } from "../../field-rendering/identifiers";
import { evaluateExact, toLatex, toNumber } from "./symbolic/exact";
import { solveFirstOrder, type ODEResult } from "./symbolic/ode";
import { resolvePrimes, solveSecondOrder } from "./symbolic/secondOrder";
import { recognizeDecimal } from "./symbolic/recognize";
import { particularConstant, type InitialResult } from "./symbolic/initial";
import {
  differentiate,
  DifferentiationError,
  hintsFor,
  RULE_DERIVATIONS,
  RULE_FORMULAS,
  similarExample,
  type Derivation,
  type DerivationNode,
} from "./symbolic/differentiate";
import { integrate, IntegrationError } from "./symbolic/integrate";
import { seriesAntiderivative, SeriesError } from "./symbolic/series";
import {
  add,
  agreesOnSamples,
  condense,
  evaluate,
  fold as simplifyTree,
  freshName,
  id,
  numericDerivative,
  topLevelTerms,
  toLatex as toLatexTree,
  type Bindings,
} from "../../symbolic";

import {
  defaultPhysicsLabConfig,
  normalizePhysicsLabConfig,
  SERIES_TERMS_MAX,
  SERIES_TERMS_MIN,
  thinSlopeGrid,
  validateSlopeField,
  type AnswerForm,
  type DetailLevel,
  type PanelTab,
  type PhysicsLabConfig,
  type SlopeValidation,
} from "./model";

import type PhysicsLab from ".";

type Node = Aug.Latex.AnyChild;

/** Forgets the practice problem, because the question it belonged to is gone. */
function resetPractice(config: PhysicsLabConfig) {
  config.derivative.attemptLatex = "";
  config.derivative.hintsShown = 0;
  config.derivative.showAnswer = false;
  config.derivative.checked = false;
}

/** A row with nothing in it, for the kinds that carry only a result. */
function blankRow(key: string, kind: RowKind, depth: number): ShownStep {
  return {
    key,
    kind,
    label: "",
    title: "",
    task: "",
    focus: "",
    recognition: "",
    detail: "",
    formula: "",
    derivation: [],
    substitutions: [],
    intermediate: "",
    latex: "",
    lines: [],
    depth,
    major: false,
    deep: false,
  };
}

/** As much of Desmos's `HelperExpression` as reading one number needs. */
interface ValueHelper {
  numericValue: number;
  observe: (event: string, callback: () => void) => void;
}

/** The slope field draws on its own canvas, beside whatever else is over the graph. */
export const SLOPE_CANVAS_ID = "dsm-physics-lab-slope-canvas";

/** Long enough that a burst of evaluator changes settles into one rescan. */
const ENVIRONMENT_REFRESH_DELAY_MS = 80;

type SlopeCompilation =
  | { ok: true; field: FlowField }
  | { ok: false; error: string };

/**
 * One row of the rendered derivation.
 *
 * Rows rather than steps, because a derivation step becomes more than one thing
 * on screen. A rule that has sub-derivations is announced, then its children are
 * worked, and only then is its own result assembled — and that last part is a
 * row of its own, placed after the children rather than beside the
 * announcement. Written any other way the explanation uses a result before it
 * has explained where the result came from, which is the difference between a
 * derivation and a summary of one.
 */
export type RowKind = "rule" | "substitute" | "assemble";

export interface ShownStep {
  key: string;
  kind: RowKind;
  /** Position in the derivation tree: `1`, `1a`, `1b-i`. Empty on a non-rule row. */
  label: string;
  title: string;
  /** "Differentiate u" — what sub-problem this is, in the parent's words. */
  task: string;
  /** The subexpression being worked on, so the reader knows which part. */
  focus: string;
  /** The structure that was recognised — why this rule and not another. */
  recognition: string;
  /** What applying it does here. Empty when the formula beside it says so. */
  detail: string;
  /** The rule in general, where it has a form worth memorising. */
  formula: string;
  /** Where the rule comes from. Shown only in the full view. */
  derivation: { key: string; latex: string; note: string }[];
  /** The names the rule gave the pieces, already rendered. */
  substitutions: { symbol: string; latex: string }[];
  /**
   * The rule applied with its sub-derivatives still written as `d/dx(…)`.
   *
   * The line a worked solution actually shows. Jumping from the product rule
   * straight to a fully expanded answer hides the move being taught.
   */
  intermediate: string;
  /** What this row produced. Empty on a rule row whose children follow. */
  latex: string;
  /** `latex` split over lines when one line would be too wide. */
  lines: string[];
  depth: number;
  /** A structural decision rather than a sub-problem, for the panel's emphasis. */
  major: boolean;
  /** Below the standard view's depth, so it waits to be asked for. */
  deep: boolean;
}

/** What the Derivative tab shows. */
export type DerivationView =
  | {
      ok: true;
      /** The derivative as the rules leave it, tidied. */
      resultLatex: string;
      resultLines: string[];
      /**
       * The same derivative with common factors pulled out, when that found
       * anything. Empty when it did not, which is how the panel knows to offer
       * no choice rather than two identical forms.
       */
      factoredLatex: string;
      factoredLines: string[];
      /** What the factoriser did, so the shorter form is not a puzzle. */
      factorNotes: { key: string; text: string; latex: string }[];
      /** The derivative before tidying, when tidying changed anything. */
      rawLatex: string;
      rawLines: string[];
      /** What the derivation had to assume, as comparisons to render. */
      domain: string[];
      shown: ShownStep[];
      example?: WorkedExample;
    }
  | { ok: false; error: string };

/** A second problem of the same shape, and the scaffolding to attempt it. */
export interface WorkedExample {
  source: string;
  result: string;
  /** Progressive: a question about the shape, then the pieces, then the hard part. */
  hints: { key: string; text: string; show: string[] }[];
}

/** How a reader's attempt at the practice problem compares with the answer. */
export type AttemptVerdict = "correct" | "wrong" | "unreadable";

/**
 * Where an attempt is marked.
 *
 * Inside the first positive arch of `sin 3x`, so the variable powers the
 * default expression is built around are real there. An answer that is only
 * undefined on this stretch is reported as unreadable rather than wrong.
 */
const ATTEMPT_SAMPLES = [0.21, 0.37, 0.53, 0.69, 0.85];

/** Beyond this many drawn glyphs an expression is stacked rather than run on. */
const ANSWER_LINE_GLYPHS = 30;

/** How much shorter tidying has to make an answer before it is worth a row. */
const TIDY_GLYPHS = 3;

/**
 * How deep the standard view goes.
 *
 * One level: the outermost rule and the sub-problems it creates, which is the
 * shape of the expression. Everything below that is how each sub-problem was
 * finished, and the full view is where that lives. Both render the same tree,
 * so the setting changes the depth drawn and nothing else — there is no second
 * derivation that could disagree with the first.
 */
const STANDARD_DEPTH = 1;

/**
 * Roughly how wide a piece of LaTeX draws, in glyphs.
 *
 * Every command collapses to one character because that is about what it
 * renders as, and the grouping braces to none because they render as nothing.
 */
function visibleLength(latex: string): number {
  return latex
    .replace(/\\operatorname\{([a-zA-Z]+)\}/g, "$1")
    .replace(/\\left|\\right/g, "")
    .replace(/\\[a-zA-Z]+/g, "f")
    .replace(/[{}]/g, "").length;
}

/**
 * The label a child gets, given its parent's.
 *
 * Numbers, then letters, then roman numerals, which is how a worked solution
 * on paper numbers itself. Past that it goes back to digits: a derivation four
 * levels deep has bigger problems than its labelling scheme.
 */
function childLabel(parent: string, depth: number, index: number): string {
  if (depth === 0) return parent + String.fromCharCode(97 + (index % 26));
  if (depth === 1) return `${parent}-${ROMAN[index] ?? String(index + 1)}`;
  return `${parent}.${index + 1}`;
}

const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];

/**
 * A series antiderivative, ready to read and ready to plot.
 *
 * Both spellings are kept because they answer different questions. The sum is
 * the antiderivative — one expression, exact, and what goes into the graph.
 * The first few terms written out are what makes it recognisable: nobody reads
 * a general term and sees the shape of the function, and everybody recognises
 * `x + x³/3 + x⁵/10` as something that climbs.
 */
export interface SeriesView {
  /** The general term, as an expression in the index. */
  termLatex: string;
  /** The whole sum, with a finite upper bound, for the expression list. */
  sumLatex: string;
  /** The first few terms, added up. */
  partialLatex: string;
  /** Where the series converges, in words. */
  interval: string;
  /** How many terms the plottable sum carries. */
  terms: number;
}

/**
 * Whether the antiderivative was checked against the integrand.
 *
 * Every answer here is differentiated back numerically before it is shown, and
 * an answer that fails is not shown at all. What this reports is the case in
 * between: an integrand with a free parameter in it — `1/(x²+a²)` before `a`
 * exists in the graph — evaluates to nothing at every sample, so there was
 * nothing to check. That is not the same as having checked it, and the panel
 * says so rather than claiming a verification that never happened.
 */
export type IntegralCheck = "checked" | "unchecked";

/** What the Integral tab has to show for one integrand. */
export type IntegralView =
  | {
      ok: true;
      /** The antiderivative with its constant, as LaTeX Desmos parses. */
      latex: string;
      /** The same, broken across lines when it is too long for one. */
      lines: string[];
      check: IntegralCheck;
    }
  | {
      ok: false;
      /** Why there is no elementary antiderivative, in words. */
      error: string;
      /**
       * The series antiderivative, when the integrand has one.
       *
       * Only ever offered on a refusal. A series is an exact answer and a
       * worse one to read: `∫e^x dx` has a perfectly good series and nobody
       * wants it, so it is what the panel falls back to rather than what it
       * shows beside a closed form.
       */
      series?: SeriesView;
    };

/**
 * Where an antiderivative is checked.
 *
 * All positive, and that is the load-bearing part. `∫dx/(x√(x²-1))` comes back
 * as `arccos(1/x)`, which every table gives and which differentiates to the
 * integrand for `x > 1` and to *minus* it for `x < -1` — the sign a `√(x²)`
 * loses is real, and it is a question about which branch the answer is on
 * rather than about whether the answer is right. A check that sampled both
 * signs would call that answer wrong and hide it, which is the opposite of
 * what this is for.
 *
 * Spread either side of 1 because the domains here divide there: the circle
 * substitutions need |x| < 1 and the secant ones need |x| > 1. Points where
 * either side is undefined are skipped, so a spread that crosses a
 * singularity costs a sample rather than a verdict.
 */
const INTEGRAL_SAMPLES = [0.13, 0.37, 0.62, 0.91, 1.4, 2.3, 3.7];

/** What the exact-value reader can say about one expression. */
export interface ExactReading {
  /** The exact form, as LaTeX Desmos parses. */
  latex: string;
  /** The same value as a double, for showing beside it. */
  value: number;
  /** True when the exact form is just a number and adds nothing to read. */
  trivial: boolean;
  /**
   * Significant digits matched, when this came from reading a decimal
   * backwards rather than from evaluating an expression.
   *
   * Undefined for a derived value. The distinction has to reach the panel: a
   * value computed from an expression is a fact about it, and a value matched
   * against twelve digits is a candidate that happens to agree with all of
   * them. Saying the same thing about both would be a lie about one.
   */
  matched?: number;
}

export default class PhysicsLabSession {
  private parseConfig?: Config;
  private config = defaultPhysicsLabConfig();
  private readonly parameterHelpers = new Map<string, ValueHelper>();
  private environment: FieldEnvironment = EMPTY_ENVIRONMENT;
  private environmentTimer?: ReturnType<typeof setTimeout>;
  private dispatcherID?: string;
  private thinned = false;
  /**
   * Which field is on the graph. One overlay, because the two use different
   * coordinate systems — a slope field is (x, y) and a phase plane is (y, y′)
   * — and drawing both at once would put two meanings on one pair of axes.
   */
  private drawing: "none" | "slope" | "phase" = "none";
  private solutionCache?: { latex: string; result: ODEResult };
  private secondCache?: { latex: string; result: ODEResult };
  private integralCache?: { key: string; result: IntegralView };
  private derivativeCache?: {
    key: string;
    result: DerivationView;
    /** What an attempt at the practice problem is marked against. */
    exampleDerivative?: Node;
  };

  private readonly overlay = new ArrowOverlay(this.plugin.calc, {
    // Its own canvas id: Vector Tools may be drawing its own arrows at the same
    // time, and an id is unique to a document.
    canvasId: SLOPE_CANVAS_ID,
    onError: (message) => {
      this.message = message;
      this.plugin.rerenderPanel();
    },
    onRecovered: () => {
      this.message = "";
      this.plugin.rerenderPanel();
    },
  });

  /** The last thing that went wrong, for the panel to show. */
  message = "";

  constructor(readonly plugin: PhysicsLab) {
    this.config = normalizePhysicsLabConfig(
      readStoredConfig(plugin.settings.serializedConfig)
    );
    // `setExpression` does not emit `set-item-latex`; a definition typed
    // anywhere in the list arrives as `on-evaluator-changes`, and that event
    // also fires on every frame of an animating slider. So this coalesces
    // rather than debounces — a debounce under a steady stream never comes due.
    this.dispatcherID = this.plugin.cc.dispatcher.register((event) => {
      if (event.type !== "on-evaluator-changes") return;
      this.pushParameterValues();
      if (this.environmentTimer !== undefined) return;
      this.environmentTimer = setTimeout(() => {
        this.environmentTimer = undefined;
        this.refreshEnvironment();
      }, ENVIRONMENT_REFRESH_DELAY_MS);
    });
  }

  // ---- configuration -----------------------------------------------------

  getConfig(): PhysicsLabConfig {
    return this.config;
  }

  /**
   * Applies a change and redraws.
   *
   * Every write goes through here so there is one place that persists, one that
   * restarts the overlay, and one that re-renders — three things that were easy
   * to forget individually.
   */
  updateConfig(mutate: (config: PhysicsLabConfig) => void) {
    const next = structuredClone(this.config);
    mutate(next);
    this.config = normalizePhysicsLabConfig(next);
    this.plugin.setSetting("serializedConfig", JSON.stringify(this.config));
    // Redraw whichever field is up, so a settings change is visible at once.
    if (this.drawing === "slope") this.startSlopeField();
    else if (this.drawing === "phase") this.startPhasePlane();
    this.plugin.rerenderPanel();
  }

  setPanelTab(tab: PanelTab) {
    this.updateConfig((config) => {
      config.panel.tab = tab;
    });
  }

  get validation(): SlopeValidation {
    return validateSlopeField(this.config.slope);
  }

  // ---- the slope field ---------------------------------------------------

  get isDrawing() {
    return this.drawing === "slope" && this.overlay.isRunning;
  }

  get isDrawingPhase() {
    return this.drawing === "phase" && this.overlay.isRunning;
  }

  /**
   * The status line under the slope field controls.
   *
   * It says when the grid was thinned, because a field that quietly drew a
   * tenth of what was asked for and said nothing would read as the renderer
   * being wrong rather than as a setting being on.
   */
  get status() {
    if (this.message !== "") return this.message;
    if (!this.overlay.isRunning) return "";
    const marks = this.overlay.arrowCount;
    if (this.thinned)
      return `Drawing ${marks.toLocaleString()} marks — sampled coarsely to stay readable. Turn off the density limit to draw all of them.`;
    return `Drawing ${marks.toLocaleString()} marks.`;
  }

  toggleSlopeField() {
    if (this.drawing === "slope") {
      this.stopDrawing();
      return;
    }
    this.drawing = "slope";
    this.startSlopeField();
    this.plugin.rerenderPanel();
  }

  /**
   * The phase plane, which is the picture a second-order equation does have.
   *
   * There is no direction field for `y'' = f(y, y')` in (x, y): the slope at a
   * point depends on the velocity there as well, so a point on the plane does
   * not determine a direction and there is nothing to draw. Against y and y'
   * there is — writing the equation as the pair `y' = v`, `v' = f(y, v)` makes
   * it a first-order system, and a system in two variables is exactly what the
   * arrow renderer already draws.
   *
   * Arrows here, not the slope field's headless marks. A slope field mark has
   * no arrowhead because dy/dx is a slope and a slope has no direction; a phase
   * plane trajectory runs one way in time, and leaving the head off would throw
   * that away.
   */
  togglePhasePlane() {
    if (this.drawing === "phase") {
      this.stopDrawing();
      return;
    }
    this.drawing = "phase";
    this.startPhasePlane();
    this.plugin.rerenderPanel();
  }

  private stopDrawing() {
    this.drawing = "none";
    this.overlay.stop();
    this.plugin.rerenderPanel();
  }

  private startPhasePlane() {
    const compiled = this.compilePhase();
    if (!compiled.ok) {
      this.message = compiled.error;
      this.drawing = "none";
      this.overlay.stop();
      return;
    }
    this.message = "";
    this.overlay.start(compiled.field, this.phaseOptions);
    this.syncParameterValues(compiled.field.params ?? []);
  }

  /**
   * `y'' = f(y, v)` as the system `(y', v') = (v, f)`, in the graph's own
   * coordinates.
   *
   * The graph's x is y and the graph's y is v, so the horizontal component is
   * simply the graph's y — the first equation of the pair, written out. The
   * user's f is renamed into those coordinates rather than string-replaced:
   * `renameIdentifier` scans identifiers properly, so a `v` inside a subscript
   * or a function name is left alone.
   */
  private compilePhase(): SlopeCompilation {
    const source = resolvePrimes(this.config.secondOrder.fLatex);
    if (source.trim() === "")
      return { ok: false, error: "Enter the second-order equation first." };
    // A non-autonomous equation has no phase plane: the field would move with x,
    // and the plane has no axis left to put x on.
    if (mentions(source, "x")) {
      return {
        ok: false,
        error:
          "This equation depends on x, so its phase plane would change with x and there is no axis left to show that on.",
      };
    }
    const renamed = renameIdentifier(
      renameIdentifier(source, "y", "x"),
      "v",
      "y"
    );
    // dy/dt = v, which in the graph's coordinates is the graph's own y.
    const p = compileFieldComponentToGLSL("y", this.environment);
    if (!p.ok) return { ok: false, error: p.error };
    const q = compileFieldComponentToGLSL(renamed, this.environment);
    if (!q.ok) return { ok: false, error: `f: ${q.error}` };
    return {
      ok: true,
      field: {
        kind: "components",
        p: p.glsl,
        q: q.glsl,
        helpers: q.helpers,
        params: q.params,
        usesTime: q.usesTime,
      },
    };
  }

  private get phaseOptions(): ArrowOptions {
    const { phase, slope } = this.config;
    const spacing = Math.min(
      Math.abs(phase.domain.x.max - phase.domain.x.min) /
        Math.max(1, phase.columns - 1),
      Math.abs(phase.domain.y.max - phase.domain.y.min) /
        Math.max(1, phase.rows - 1)
    );
    return {
      // Neutral: the saturation and contrast knobs are Vector Tools' own, and
      // this picture has no control offering them.
      ...NO_COLOR_ADJUST,
      columns: phase.columns,
      rows: phase.rows,
      domain: {
        xMin: phase.domain.x.min,
        xMax: phase.domain.x.max,
        yMin: phase.domain.y.min,
        yMax: phase.domain.y.max,
      },
      // Every arrow the same length, because near an equilibrium the speed goes
      // to zero and a field scaled by magnitude vanishes exactly where the
      // interesting behaviour is.
      lengthMode: "direction-only",
      targetLength: 0.7 * spacing,
      scale: 1,
      maximumLength: 0.7 * spacing,
      compression: 1,
      headSize: 0.28 * spacing,
      headAngle: Math.PI / 7,
      centered: false,
      shaftWidth: slope.lineWidth,
      colorMode: slope.colorMode,
      palette: slope.palette,
      fixedColor: slope.fixedColor,
      opacity: 1,
      rangeMode: slope.rangeMode,
      rangeMinimum: slope.rangeMinimum,
      rangeMaximum: slope.rangeMaximum,
    };
  }

  private startSlopeField() {
    const { validation } = this;
    if (!validation.ok) {
      this.message = validation.issues[0].message;
      this.overlay.stop();
      return;
    }
    this.refreshEnvironmentNow();
    const compiled = this.compile();
    if (!compiled.ok) {
      this.message = compiled.error;
      this.overlay.stop();
      return;
    }
    this.message = "";
    this.overlay.start(compiled.field, this.arrowOptions);
    this.syncParameterValues(compiled.field.params ?? []);
  }

  /**
   * The slope field as a vector field, which is all it ever was.
   *
   * dy/dx = f(x, y) is the direction field of (1, f), so there is no separate
   * slope-field renderer here and there should not be one: the marks are the
   * arrows, drawn at one length because only the direction carries information,
   * with the head taken off and the mark centred on its sample point.
   */
  private compile(): SlopeCompilation {
    // The horizontal component is the `dx` in `dy/dx`, and it is 1 by
    // construction rather than by choice.
    const p = compileFieldComponentToGLSL("1", this.environment);
    if (!p.ok) return { ok: false, error: p.error };
    const q = compileFieldComponentToGLSL(
      this.config.slope.fLatex,
      this.environment
    );
    if (!q.ok) return { ok: false, error: `f(x, y): ${q.error}` };
    return {
      ok: true,
      field: {
        kind: "components",
        p: p.glsl,
        q: q.glsl,
        helpers: q.helpers,
        params: q.params,
        usesTime: q.usesTime,
      },
    };
  }

  private get arrowOptions(): ArrowOptions {
    const { slope } = this.config;
    const grid = slope.densityLimit
      ? thinSlopeGrid(slope.columns, slope.rows)
      : { columns: slope.columns, rows: slope.rows, thinned: false };
    this.thinned = grid.thinned;
    const spacing = Math.min(
      Math.abs(slope.domain.x.max - slope.domain.x.min) /
        Math.max(1, grid.columns - 1),
      Math.abs(slope.domain.y.max - slope.domain.y.min) /
        Math.max(1, grid.rows - 1)
    );
    return {
      // Neutral: the saturation and contrast knobs are Vector Tools' own, and
      // this picture has no control offering them.
      ...NO_COLOR_ADJUST,
      columns: grid.columns,
      rows: grid.rows,
      domain: {
        xMin: slope.domain.x.min,
        xMax: slope.domain.x.max,
        yMin: slope.domain.y.min,
        yMax: slope.domain.y.max,
      },
      // Every mark the same length: a slope field says which way, never how
      // fast, and a mark whose length varied would be claiming something about
      // the equation that the equation does not say.
      lengthMode: "direction-only",
      targetLength: slope.markLength * spacing,
      scale: 1,
      maximumLength: slope.markLength * spacing,
      compression: 1,
      // No head, and centred on the sample point — the two things that turn an
      // arrow into a tangent mark.
      headSize: 0,
      headAngle: 0,
      centered: true,
      shaftWidth: slope.lineWidth,
      colorMode: slope.colorMode,
      palette: slope.palette,
      fixedColor: slope.fixedColor,
      opacity: 1,
      rangeMode: slope.rangeMode,
      rangeMinimum: slope.rangeMinimum,
      rangeMaximum: slope.rangeMaximum,
    };
  }

  // ---- what the field borrows from the rest of the graph ------------------

  private refreshEnvironmentNow() {
    this.environment = this.scan();
  }

  /**
   * The item models rather than `getState()`: this runs on evaluator changes,
   * which include every frame of an animating slider, and serialising the whole
   * graph that often would be most of the cost of the feature.
   */
  private scan() {
    return scanDefinitions(this.plugin.cc.getAllItemModels());
  }

  private refreshEnvironment() {
    const next = this.scan();
    if (!environmentsDiffer(this.environment, next)) return;
    this.environment = next;
    // A definition the field reads has changed shape, so the shader it compiled
    // to is no longer the right one.
    if (this.overlay.isRunning) this.startSlopeField();
    this.plugin.rerenderPanel();
  }

  private syncParameterValues(names: readonly string[]) {
    const values = new Map<string, number>();
    for (const name of names) {
      let helper = this.parameterHelpers.get(name);
      if (helper === undefined) {
        helper = this.plugin.calc.HelperExpression({
          latex: name,
        }) as unknown as ValueHelper;
        // A slider being dragged reports here rather than through the
        // expression list, and this is what keeps the field moving with it.
        helper.observe("numericValue", () => this.pushParameterValues());
        this.parameterHelpers.set(name, helper);
      }
      values.set(name, helper.numericValue);
    }
    this.overlay.setParameters(values);
  }

  /**
   * Re-reads the helpers already made. Deliberately does not re-render the
   * panel: this runs on every frame of a slider drag and nothing on the panel
   * shows a value.
   */
  private pushParameterValues() {
    if (this.parameterHelpers.size === 0) return;
    const values = new Map<string, number>();
    for (const [name, helper] of this.parameterHelpers)
      values.set(name, helper.numericValue);
    this.overlay.setParameters(values);
  }

  // ---- exact constants ----------------------------------------------------

  private get textModeConfig() {
    this.parseConfig ??= buildConfigFromGlobals(Desmos, this.plugin.calc);
    return this.parseConfig;
  }

  /**
   * The symbolic solution of the equation the slope field is drawing.
   *
   * Cached against the exact LaTeX it was solved from, because the panel reads
   * this on every render pass and solving involves parsing, integrating and
   * then verifying the answer numerically over eighteen sample points. Doing
   * that per keystroke would be felt.
   *
   * `undefined` means there is nothing typed yet; a result that is `ok: false`
   * means it was attempted and could not be done, which is worth showing.
   */
  get solution(): ODEResult | undefined {
    const latex = this.config.slope.fLatex;
    if (latex.trim() === "") return undefined;
    if (this.solutionCache?.latex === latex) return this.solutionCache.result;
    let result: ODEResult;
    try {
      const tree = parseLatex(this.textModeConfig, latex);
      result = solveFirstOrder(this.textModeConfig, tree);
    } catch {
      // Half-typed LaTeX does not parse, and that is the normal state of an
      // input somebody is still using rather than an error to report.
      result = { ok: false, error: "" };
    }
    this.solutionCache = { latex, result };
    return result;
  }

  /**
   * The solved second-order equation.
   *
   * Cached the same way and for the same reason as the first-order one: the
   * panel reads it on every render, and solving parses, takes exact
   * characteristic roots and then verifies the answer by differentiating it
   * twice over eighteen sample points.
   */
  get secondOrderSolution(): ODEResult | undefined {
    const latex = this.config.secondOrder.fLatex;
    if (latex.trim() === "") return undefined;
    if (this.secondCache?.latex === latex) return this.secondCache.result;
    let result: ODEResult;
    try {
      // The prime is rewritten here rather than in the panel, so what is
      // stored and shown stays the notation the user typed.
      const tree = parseLatex(this.textModeConfig, resolvePrimes(latex));
      result = solveSecondOrder(this.textModeConfig, tree);
    } catch {
      result = { ok: false, error: "" };
    }
    this.secondCache = { latex, result };
    return result;
  }

  /**
   * The constant that sends the general solution through the point given, or
   * `undefined` when no point has been entered.
   *
   * A general solution with a slider on it is the answer to the first half of
   * an exam question; this is the second half.
   */
  get particular(): InitialResult | undefined {
    const { xLatex, yLatex } = this.config.initial;
    if (xLatex.trim() === "" || yLatex.trim() === "") return undefined;
    const result = this.solution;
    if (result?.ok !== true) return undefined;
    try {
      const x0 = parseLatex(this.textModeConfig, xLatex);
      const y0 = parseLatex(this.textModeConfig, yLatex);
      return particularConstant(this.textModeConfig, result.solution, x0, y0);
    } catch {
      // Half-typed coordinates are the normal state of a field in use.
      return undefined;
    }
  }

  /**
   * Puts both the curve and its constant into the graph.
   *
   * `C = …` rather than the value substituted into the solution, because that
   * keeps the two expressions readable as what they are — the family, and the
   * member of it the condition picks. Desmos stops offering a slider once C is
   * defined, which is exactly right for a particular solution.
   */
  insertParticular() {
    const constant = this.particular;
    const general = this.solution;
    if (constant?.ok !== true || general?.ok !== true) return;
    this.plugin.calc.setExpression({
      latex: general.solution.latex,
      color: "#c74440",
    });
    this.plugin.calc.setExpression({ latex: constant.latex });
  }

  insertSecondOrderSolution() {
    const result = this.secondOrderSolution;
    if (result?.ok !== true) return;
    this.plugin.calc.setExpression({
      latex: result.solution.latex,
      color: "#c74440",
    });
  }

  /**
   * Puts the solution into the graph, over the field it solves.
   *
   * The constant of integration goes in as the undefined variable `C`, so
   * Desmos offers a slider for it — which turns one curve into the whole family
   * the general solution describes, laid over the marks it has to stay tangent
   * to.
   */
  insertSolution() {
    const result = this.solution;
    if (result?.ok !== true) return;
    this.plugin.calc.setExpression({
      latex: result.solution.latex,
      // Desmos's red, because Desmos's first colour is the same blue the slope
      // field defaults to, and a solution curve indistinguishable from the
      // marks it is meant to be tangent to defeats the point of drawing both.
      // A default, not a rule: it is an ordinary expression and recolouring it
      // is one click.
      color: "#c74440",
    });
  }

  /**
   * The exact value of an expression, or `undefined` when there is not one to
   * give.
   *
   * Undefined covers three situations on purpose and none of them is an error
   * worth showing: the LaTeX did not parse, it parsed but holds a variable, or
   * it is exact and this cannot represent it. In each case the honest thing on
   * screen is Desmos's own decimal and no second opinion.
   */
  exactValue(latex: string): ExactReading | undefined {
    if (latex.trim() === "") return undefined;

    // A bare decimal is read backwards instead of forwards. Taken literally it
    // is already exact — 9.86960440109 is that fraction over 10^11 — and saying
    // so is useless, because the number on screen is what somebody copied off
    // Desmos and the question is what it came from.
    const asDecimal = recognizeDecimal(latex);
    if (asDecimal !== undefined) {
      return {
        latex: toLatex(asDecimal.value),
        value: toNumber(asDecimal.value),
        trivial: false,
        matched: asDecimal.digits,
      };
    }

    let tree;
    try {
      tree = parseLatex(this.textModeConfig, latex);
    } catch {
      return undefined;
    }
    const value = evaluateExact(tree);
    if (value === undefined) return undefined;
    const exact = toLatex(value);
    return {
      latex: exact,
      value: toNumber(value),
      // A constant whose exact form is `7` is one Desmos already showed as 7.
      // Repeating it teaches nothing and makes the readout look broken on the
      // expressions where it has nothing to add.
      trivial: /^-?\d+$/.test(exact),
    };
  }

  /**
   * The derivative of an expression, with the steps taken to get it.
   *
   * Exposed on the session rather than kept inside the panel because the
   * derivation is the thing being built — the tab that shows it is a view over
   * this, the same way every other readout here is.
   */
  derivative(latex: string, variable = "x"): Derivation | undefined {
    if (latex.trim() === "") return undefined;
    try {
      const tree = parseLatex(this.textModeConfig, latex);
      return differentiate(this.textModeConfig, tree, variable);
    } catch {
      return undefined;
    }
  }

  /**
   * The derivation shown on the Derivative tab, with why it failed when it did.
   *
   * Cached against the expression for the same reason every other readout here
   * is: the panel reads it on each render pass, and a derivation parses, walks
   * the tree and emits LaTeX at every step. Doing that per keystroke would be
   * felt on a long expression.
   *
   * Every row of the tree is rendered, including the ones the standard view
   * hides. The detail level is therefore a filter the panel applies rather than
   * a second derivation — switching it cannot change an answer, because there
   * is only ever one.
   *
   * The error is kept rather than swallowed, because "the derivative of erf is
   * not known" is the useful thing to say and an empty panel is not.
   */
  get derivation(): DerivationView | undefined {
    const { fLatex, variable } = this.config.derivative;
    if (fLatex.trim() === "") return undefined;
    const key = `${variable} ${fLatex}`;
    if (this.derivativeCache?.key === key) return this.derivativeCache.result;

    let result: DerivationView;
    let exampleDerivative: Node | undefined;
    try {
      const tree = parseLatex(this.textModeConfig, fLatex);
      const derivation = differentiate(this.textModeConfig, tree, variable);
      const emit = (node: Node) => toLatexTree(this.textModeConfig, node);
      const resultLatex = emit(derivation.result);
      const rawLatex = emit(derivation.raw);
      const shorter = condense(derivation.result);
      const factoredLatex = emit(shorter.node);
      const example = this.workedExample(tree, variable);
      exampleDerivative = example?.derivative;
      result = {
        ok: true,
        resultLatex,
        resultLines: this.stack(derivation.result, resultLatex),
        // Offered rather than imposed. Neither form is more correct, and which
        // one a reader wants depends on what they are about to do with it.
        factoredLatex:
          shorter.notes.length === 0 || factoredLatex === resultLatex
            ? ""
            : factoredLatex,
        factoredLines: this.stack(shorter.node, factoredLatex),
        factorNotes: shorter.notes.map((note, index) => ({
          key: String(index),
          text: note.text,
          // A fixed identity where there is one, otherwise the actual factor.
          latex:
            note.latex !== ""
              ? note.latex
              : note.factor === undefined
                ? ""
                : emit(note.factor),
        })),
        // Only when tidying did something a reader would notice. The rules
        // produce `2x^{1}` where the answer is `2x`, and a row about that is a
        // row about nothing.
        rawLatex:
          visibleLength(rawLatex) > visibleLength(resultLatex) + TIDY_GLYPHS
            ? rawLatex
            : "",
        rawLines: this.stack(derivation.raw, rawLatex),
        domain: [
          ...new Set(
            derivation.domain.map(
              (condition) => `${emit(condition.expression)}>0`
            )
          ),
        ],
        shown: this.rows(derivation.root),
        example: example?.view,
      };
    } catch (error) {
      result = {
        ok: false,
        error:
          error instanceof DifferentiationError
            ? error.message
            : // Half-typed LaTeX does not parse, and that is the normal state of
              // an input somebody is still using rather than something to report.
              "",
      };
    }
    this.derivativeCache = { key, result, exampleDerivative };
    return result;
  }

  /**
   * The derivation tree flattened into rows, in the order it should be read.
   *
   * Flat rather than nested because the tree structure is carried by `depth`
   * and by the labels, and a flat list is what the panel can render: DCGView
   * builds a template once, so a genuinely recursive component would have to
   * rebuild itself every time the expression changed shape. Indentation and a
   * left rule draw the hierarchy from the depth, which costs nothing and
   * survives the panel being resized.
   *
   * The order is the whole point. A rule is announced, its children are worked,
   * and its own result is assembled afterwards in a row of its own — so no line
   * of the explanation uses a value the reader has not yet been shown how to
   * get.
   */
  private rows(root: DerivationNode): ShownStep[] {
    const out: ShownStep[] = [];
    const emit = (node: Node) => toLatexTree(this.textModeConfig, node);

    const walk = (
      step: DerivationNode,
      depth: number,
      label: string,
      role: string | undefined
    ) => {
      const hasChildren = step.children.length > 0;
      const produced = emit(simplifyTree(step.after));
      out.push({
        key: `${label}-rule`,
        kind: "rule",
        label,
        title: step.title,
        // Named by the parent where the parent named it, so a sub-derivation
        // reads as the piece it is rather than as the next thing in a list.
        task:
          depth === 0
            ? ""
            : role === undefined
              ? "Differentiate"
              : `Differentiate ${role}`,
        // Which subtree of the original this step is about. Without it a reader
        // three levels down has to reconstruct what is being differentiated.
        focus: depth === 0 ? "" : emit(step.before),
        recognition: step.recognition,
        detail: step.detail,
        formula: RULE_FORMULAS[step.rule] ?? "",
        derivation: (RULE_DERIVATIONS[step.rule] ?? []).map((line, index) => ({
          key: String(index),
          ...line,
        })),
        substitutions: step.substitutions.map((substitution) => ({
          symbol: substitution.symbol,
          latex: emit(substitution.value),
        })),
        intermediate:
          step.intermediate === undefined || step.importance !== "major"
            ? ""
            : emit(step.intermediate),
        // A rule with children does not state its result here: it has not been
        // earned yet. It arrives in the substitute row below its children.
        latex: hasChildren ? "" : produced,
        lines: hasChildren ? [] : this.stack(step.after, produced),
        depth,
        major: step.importance === "major",
        deep: depth > STANDARD_DEPTH,
      });

      step.children.forEach((child, index) => {
        walk(
          child,
          depth + 1,
          childLabel(label, depth, index),
          step.childRoles?.[index]
        );
      });

      // The root's assembly is the final row, where it is joined by the tidying
      // — "substitute back, then collect" is one movement and reads as one.
      if (hasChildren && depth > 0) {
        out.push({
          ...blankRow(`${label}-substitute`, "substitute", depth),
          title:
            role === undefined ? "Put it together" : `Put ${role}' together`,
          detail:
            "Substitute the derivatives just found back into the rule above.",
          latex: produced,
          lines: this.stack(step.after, produced),
          deep: depth > STANDARD_DEPTH,
        });
      }
    };

    walk(root, 0, "1", undefined);
    return out;
  }

  /**
   * An expression over several lines, or none when it fits on one.
   *
   * Broken only at the top level, and only between terms: a break inside a
   * product or under a fraction bar would change what the expression looks
   * like it says.
   */
  private stack(node: Node, latex: string): string[] {
    const terms = topLevelTerms(node);
    if (terms.length < 2) return [];
    if (visibleLength(latex) <= ANSWER_LINE_GLYPHS) return [];
    return terms.map((entry, index) => {
      const body = toLatexTree(this.textModeConfig, entry.term);
      if (index === 0) return entry.negated ? `-${body}` : body;
      return `${entry.negated ? "-" : "+"}${body}`;
    });
  }

  /**
   * The same problem with different numbers, worked.
   *
   * Built from the user's own expression rather than chosen from a list, so it
   * is guaranteed to exercise the rules they were just shown. If the nudged
   * version somehow fails to differentiate it is dropped rather than reported —
   * a broken example beside a correct derivation is worse than no example.
   *
   * Its derivative comes back alongside the view because it is what an attempt
   * is marked against, and marking against a parsed string would be marking
   * against the panel rather than against the engine.
   */
  private workedExample(
    tree: Node,
    variable: string
  ): { view: WorkedExample; derivative: Node } | undefined {
    try {
      const example = similarExample(tree);
      const derived = differentiate(this.textModeConfig, example, variable);
      return {
        view: {
          source: toLatexTree(this.textModeConfig, example),
          result: toLatexTree(this.textModeConfig, derived.result),
          hints: hintsFor(derived.root).map((hint, index) => ({
            key: String(index),
            text: hint.text,
            show: hint.show.map((node) =>
              toLatexTree(this.textModeConfig, node)
            ),
          })),
        },
        derivative: derived.result,
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Whether the reader's attempt at the practice problem is the derivative.
   *
   * Compared numerically rather than symbolically, which is the only honest
   * comparison available: `3x²sin(4x) + 4x³cos(4x)` and the same thing with its
   * terms swapped and a factor pulled out are the same answer, and no amount of
   * string matching will agree that they are. Two expressions that take the
   * same value everywhere they are defined are the same function, and that is
   * the thing being marked.
   *
   * Withheld until the reader presses Check, because a verdict that updates on
   * every keystroke tells somebody halfway through typing that they are wrong.
   */
  get attemptVerdict(): AttemptVerdict | undefined {
    const attempt = this.config.derivative.attemptLatex.trim();
    if (attempt === "" || !this.config.derivative.checked) return undefined;
    // Reading the derivation is what fills the cache the answer lives in.
    if (this.derivation?.ok !== true) return undefined;
    const truth = this.derivativeCache?.exampleDerivative;
    if (truth === undefined) return undefined;

    let tree: Node;
    try {
      tree = parseLatex(this.textModeConfig, attempt);
    } catch {
      return "unreadable";
    }
    const { variable } = this.config.derivative;
    const samples = ATTEMPT_SAMPLES.map((value) => ({ [variable]: value }));
    // An expression that is undefined everywhere it is checked has not been
    // marked at all, and reporting that as wrong would be a lie about it.
    if (samples.every((bindings) => !Number.isFinite(evaluate(tree, bindings))))
      return "unreadable";
    return agreesOnSamples(
      (bindings) => evaluate(tree, bindings),
      (bindings) => evaluate(truth, bindings),
      samples,
      1e-7
    )
      ? "correct"
      : "wrong";
  }

  /**
   * A new expression to differentiate.
   *
   * Everything about the practice problem is cleared with it. The example is
   * regenerated from the new expression, so a revealed answer, a spent hint or
   * a half-typed attempt all belong to a question that no longer exists — and
   * an answer left on screen from the previous one reads as the answer to this
   * one.
   */
  setDerivativeExpression(fLatex: string) {
    this.updateConfig((config) => {
      config.derivative.fLatex = fLatex;
      resetPractice(config);
    });
  }

  setDerivativeVariable(variable: string) {
    this.updateConfig((config) => {
      config.derivative.variable = variable;
      resetPractice(config);
    });
  }

  setDetailLevel(detail: DetailLevel) {
    this.updateConfig((config) => {
      config.derivative.detail = detail;
    });
  }

  setAnswerForm(form: AnswerForm) {
    this.updateConfig((config) => {
      config.derivative.form = form;
    });
  }

  /** Editing an answer withdraws the verdict on the previous one. */
  setAttempt(attemptLatex: string) {
    this.updateConfig((config) => {
      config.derivative.attemptLatex = attemptLatex;
      config.derivative.checked = false;
    });
  }

  checkAttempt() {
    this.updateConfig((config) => {
      config.derivative.checked = true;
    });
  }

  revealHint() {
    this.updateConfig((config) => {
      config.derivative.hintsShown += 1;
    });
  }

  revealExampleAnswer() {
    this.updateConfig((config) => {
      config.derivative.showAnswer = true;
    });
  }

  /**
   * Puts the derivative into the graph beside whatever else is there.
   *
   * Whichever form is on screen. Adding the expanded one while the factored one
   * is displayed would put an expression into the list that does not match the
   * one the user was looking at when they pressed the button.
   */
  insertDerivative() {
    const found = this.derivation;
    if (found?.ok !== true) return;
    const factored =
      this.config.derivative.form === "factored" && found.factoredLatex !== "";
    this.plugin.calc.setExpression({
      latex: factored ? found.factoredLatex : found.resultLatex,
      color: "#c74440",
    });
  }

  /** The derivative as LaTeX, for putting straight into the graph. */
  derivativeLatex(latex: string, variable = "x"): string | undefined {
    const found = this.derivative(latex, variable);
    return found === undefined
      ? undefined
      : toLatexTree(this.textModeConfig, found.result);
  }

  /**
   * The antiderivative shown on the Integral tab, or why there is none.
   *
   * Cached against the integrand the same way the derivation is, and for a
   * stronger reason: integration is a search rather than a walk. Refusing
   * `∫e^{x²}dx` means trying every technique and failing at each, which is the
   * most expensive thing this engine does — and it is exactly what happens on
   * every keystroke of an expression somebody is halfway through typing.
   *
   * The constant of integration is added here rather than inside the
   * integrator, because only a caller knows whether it wants `+C` or a pair of
   * bounds. Its name is chosen against the integrand, so an integral that
   * already mentions `C` does not come back with two different things called
   * the same thing.
   */
  get integral(): IntegralView | undefined {
    const { fLatex, variable, terms } = this.config.integral;
    if (fLatex.trim() === "") return undefined;
    const key = `${variable} ${terms} ${fLatex}`;
    if (this.integralCache?.key === key) return this.integralCache.result;
    const result = this.computeIntegral(fLatex, variable, terms);
    this.integralCache = { key, result };
    return result;
  }

  private computeIntegral(
    fLatex: string,
    variable: string,
    terms: number
  ): IntegralView {
    let integrand: Node;
    try {
      integrand = parseLatex(this.textModeConfig, fLatex);
    } catch {
      // Half-typed LaTeX does not parse, and that is the normal state of an
      // input somebody is still using rather than something to report.
      return { ok: false, error: "" };
    }

    let refusal: string;
    try {
      const value = integrate(integrand, variable);
      const check = this.checkAntiderivative(value, integrand, variable);
      if (check !== "wrong") {
        const constant = freshName(integrand, ["C", "K", "D"]);
        const withConstant = add(value, id(constant));
        const latex = toLatexTree(this.textModeConfig, withConstant);
        return {
          ok: true,
          latex,
          lines: this.stack(withConstant, latex),
          check,
        };
      }
      // An answer that does not differentiate back to the integrand is worse
      // than no answer: it is wrong, and it is wrong in a form that looks
      // exactly like a right one. Nothing in the test suite produces this, and
      // if something ever does, this is the difference between finding out and
      // not.
      refusal =
        "The antiderivative found here does not differentiate back to what you typed, so it is not shown.";
    } catch (error) {
      if (!(error instanceof IntegrationError)) throw error;
      refusal = error.message;
    }

    return { ok: false, error: refusal, series: this.series(integrand, terms) };
  }

  /**
   * The series antiderivative, when the integrand has one this can build.
   *
   * Only reached on a refusal, and allowed to refuse in turn — most integrands
   * are not `c·xᵐ·f(a xᵏ)` for one of the eight series here, and the ones that
   * are are the ones nothing else can do at all.
   *
   * The variable is not passed through: a series is built about zero in the
   * variable the integrand is written in, which is the one the tab is set to.
   */
  private series(integrand: Node, terms: number): SeriesView | undefined {
    const { variable } = this.config.integral;
    try {
      const found = seriesAntiderivative(integrand, variable, terms);
      const emit = (node: Node) => toLatexTree(this.textModeConfig, node);
      return {
        termLatex: emit(found.term),
        sumLatex: emit(found.sum),
        partialLatex: emit(found.partial),
        interval: found.interval,
        terms,
      };
    } catch (error) {
      if (!(error instanceof SeriesError)) throw error;
      return undefined;
    }
  }

  /**
   * Whether the antiderivative differentiates back to the integrand.
   *
   * Numerically, by a central difference, which is the only check available
   * that does not assume the symbolic layer is right — differentiating the
   * answer with the same engine that produced it and comparing trees would
   * agree with itself whatever it had done.
   *
   * Three verdicts rather than two. An integrand mentioning a name the graph
   * has not defined evaluates to nothing everywhere, and a comparison with
   * nothing on one side is not a pass. Reporting that as checked would be the
   * one dishonest thing this readout could do.
   */
  private checkAntiderivative(
    value: Node,
    integrand: Node,
    variable: string
  ): IntegralCheck | "wrong" {
    const decided: Bindings[] = [];
    for (const at of INTEGRAL_SAMPLES) {
      const bindings = { [variable]: at };
      if (!Number.isFinite(evaluate(integrand, bindings))) continue;
      if (!Number.isFinite(numericDerivative(value, variable, bindings)))
        continue;
      decided.push(bindings);
    }
    if (decided.length < 3) return "unchecked";
    return agreesOnSamples(
      (bindings) => numericDerivative(value, variable, bindings),
      (bindings) => evaluate(integrand, bindings),
      decided
    )
      ? "checked"
      : "wrong";
  }

  /** A new integrand. */
  setIntegralExpression(fLatex: string) {
    this.updateConfig((config) => {
      config.integral.fLatex = fLatex;
    });
  }

  setIntegralVariable(variable: string) {
    this.updateConfig((config) => {
      config.integral.variable = variable;
    });
  }

  setSeriesTerms(terms: number) {
    this.updateConfig((config) => {
      config.integral.terms = Math.round(
        Math.min(SERIES_TERMS_MAX, Math.max(SERIES_TERMS_MIN, terms))
      );
    });
  }

  /**
   * Puts the antiderivative into the graph, constant and all.
   *
   * With the `+C` rather than without it, because Desmos offers a slider for
   * an undefined name and dragging that slider through the family of curves is
   * the whole picture an antiderivative describes.
   */
  insertIntegral() {
    const found = this.integral;
    if (found?.ok !== true) return;
    this.plugin.calc.setExpression({ latex: found.latex, color: "#388c46" });
  }

  /** Puts the series antiderivative into the graph, as its finite sum. */
  insertSeries() {
    const found = this.integral;
    if (found?.ok !== false || found.series === undefined) return;
    this.plugin.calc.setExpression({
      latex: found.series.sumLatex,
      color: "#388c46",
    });
  }

  /**
   * Vector Tools, if the user has it enabled.
   *
   * Physics Lab may build on Vector Tools and must work without it, so every
   * use goes through here and every caller handles `undefined`. Since the
   * renderer moved to `src/field-rendering`, nothing on the drawing path needs
   * this at all — which is the point.
   */
  get vectorTools() {
    return this.plugin.dsm.vectorTools;
  }

  /** Stops everything. Only disabling the plugin calls this. */
  destroy() {
    if (this.environmentTimer !== undefined)
      clearTimeout(this.environmentTimer);
    this.environmentTimer = undefined;
    if (this.dispatcherID !== undefined)
      this.plugin.cc.dispatcher.unregister(this.dispatcherID);
    this.dispatcherID = undefined;
    this.overlay.stop();
    this.parameterHelpers.clear();
    this.parseConfig = undefined;
  }
}

function readStoredConfig(serialized: string): unknown {
  if (serialized === "") return undefined;
  try {
    return JSON.parse(serialized);
  } catch {
    // A setting that cannot be parsed is one the user cannot get back to, so
    // it falls back to defaults rather than throwing on the way in.
    return undefined;
  }
}
