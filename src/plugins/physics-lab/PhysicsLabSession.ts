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
import { EXTENDED_GREEK } from "#utils/greek.ts";
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
import {
  evaluateExact,
  toLatex,
  toNumber,
  fromInteger as toExact,
  toNode as exactToNode,
  toDecimal as toExactDecimal,
  type ExactValue,
  add as addExact,
  negate as negateExact,
  ZERO as EXACT_ZERO,
} from "./symbolic/exact";
import { solveFirstOrder, type ODEResult } from "./symbolic/ode";
import { resolvePrimes, solveSecondOrder } from "./symbolic/secondOrder";
import { recognizeDecimal, significantDigits } from "./symbolic/recognize";
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
import {
  describeMethod,
  implicitProducts,
  integrateWithMethod,
  IntegrationError,
  NonElementaryError,
} from "./symbolic/integrate";
import { seriesFallback, type PartKind } from "./symbolic/seriesSum";
import { quadratureSteps, type QuadratureResult } from "./symbolic/quadrature";
import {
  definiteIntegral,
  DefiniteError,
  interiorSingularity,
  type Approach,
  type Bound,
  type Limit,
} from "./symbolic/definite";
import {
  findLimit,
  numericEvidence,
  type IndeterminateForm,
  type LimitMethod,
} from "./symbolic/limit";
import { limitRoutes, type LimitStep } from "./symbolic/limitSteps";
import {
  add,
  agreesOnSamples,
  call as callNode,
  condense,
  evaluate,
  fold as simplifyTree,
  freshName,
  identifiersIn,
  normsToAbs,
  id,
  numericDerivative,
  topLevelTerms,
  toLatex as toLatexTree,
  visit as visitTree,
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
  type ExplainLevel,
  type LimitDirection,
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
  /** The general term, when there is one series with one; otherwise empty. */
  termLatex: string;
  /**
   * Each term of the integrand and how it was integrated: in closed form, as
   * a series with a general term, or as a series known only to some order.
   * Said per term because those are three different claims.
   */
  parts: { latex: string; kind: PartKind }[];
  /**
   * Set when part of the answer is a truncated series: the sum is exact below
   * `x^order` and claims nothing beyond it.
   */
  order?: number;
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

/**
 * A definite integral, as the Integral tab shows it.
 *
 * Only ever built on top of a checked antiderivative, and only ever exact:
 * the decimal is for reading beside the value, not in place of it.
 */
export type DefiniteView =
  | {
      ok: true;
      /** `\int_{a}^{b}f\,dx`, for the left of the equals sign. */
      statementLatex: string;
      /** The exact value, or `\infty` for a divergent integral. */
      valueLatex: string;
      /** The same value as a decimal, for reading beside it. */
      decimal: string;
      /** Said when it was improper or diverges; empty otherwise. */
      note: string;
      /**
       * Set when there was no antiderivative and the value came from a
       * numerical integration, matched to a closed form or not.
       */
      numeric?: boolean;
      /** Definitions the value needs in the graph: γ, ζ(3), G. */
      definitions?: { name: string; latex: string }[];
    }
  | {
      ok: false;
      error: string;
      /** Still being integrated numerically; nothing to say yet. */
      pending?: boolean;
    };

/** What the Integral tab has to show for one integrand. */
export type IntegralView =
  | {
      ok: true;
      /** The antiderivative with its constant, as LaTeX Desmos parses. */
      latex: string;
      /** The same, broken across lines when it is too long for one. */
      lines: string[];
      check: IntegralCheck;
      /**
       * The techniques that finished it, as recorded by the branch that
       * succeeded: "Integration by parts, then trigonometric substitution".
       */
      method: string;
      /** The integral between the bounds, when bounds are given. */
      definite?: DefiniteView;
    }
  | {
      ok: false;
      /** Why there is no elementary antiderivative, in words. */
      error: string;
      /**
       * The special function the antiderivative is written with, when it is
       * known not to be elementary. Undefined when the integrator merely
       * failed, which is a weaker thing to say and the panel says it that way.
       */
      special?: string;
      /**
       * The series antiderivative, when the integrand has one.
       *
       * Only ever offered on a refusal. A series is an exact answer and a
       * worse one to read: `∫e^x dx` has a perfectly good series and nobody
       * wants it, so it is what the panel falls back to rather than what it
       * shows beside a closed form.
       */
      series?: SeriesView;
      /**
       * The integral between the bounds, numerically, when there is no
       * antiderivative to evaluate it with.
       */
      definite?: DefiniteView;
    };

/** One one-sided limit, for showing the two sides of a limit that has none. */
export interface LimitSideView {
  /** The whole line: `\lim_{x\to0^{-}}f=-1`. */
  latex: string;
  /** What goes under `lim`: `x\to0^{-}`. */
  approachLatex: string;
  /** Just the value, for drawing where that side is headed. */
  valueLatex: string;
}

/**
 * One line of maths in an explanation: a limit, drawn with its approach
 * under `lim`, or plain maths.
 */
export interface LimitLineView {
  kind: "limit" | "math";
  approachLatex: string;
  latex: string;
  /** Whether the line starts with an equals sign, continuing the one above. */
  equals: boolean;
}

/**
 * One step of an explanation, at every depth at once. The panel shows `say`
 * always, `why` from the detailed level, and `proof` at the research level —
 * the same step, so the depths cannot disagree.
 */
export interface LimitStepView {
  say: string;
  lines: LimitLineView[];
  why: string;
  proof: string;
}

/** One way to the answer, as a textbook would take it. */
export interface LimitRouteView {
  id: string;
  name: string;
  steps: LimitStepView[];
}

/**
 * What the Limit tab has to show.
 *
 * Three outcomes, and the middle one is an answer. "Does not exist" is a
 * result somebody asked for as much as a number is — `|x|/x` at 0 is on every
 * worksheet because its answer is that there is none — and it arrives with
 * its reason. A refusal is different: it says nothing about the limit, only
 * about what this could decide.
 */
export type LimitView =
  | {
      status: "value";
      /** `\lim_{x\to a}f`, whole, for reading back. */
      statementLatex: string;
      /** What goes under `lim`, and what comes after it. */
      approachLatex: string;
      bodyLatex: string;
      /** The exact value, or `\pm\infty`. */
      valueLatex: string;
      /** The value as a decimal beside it; empty for an infinity. */
      decimal: string;
      finite: boolean;
      /**
       * Said under an infinite answer: it is a description of how the
       * function behaves, not a number the limit equals.
       */
      caption: string;
      /** The indeterminate form, as maths; empty when there is none. */
      formLatex: string;
      /** Every route to the answer, the one a course would use first. */
      routes: LimitRouteView[];
      /** The route being shown. */
      route: string;
      check: "consistent" | "inconclusive";
      /**
       * Decimal places the sampled values agree with the answer to, at the
       * closest distance tested; 0 for an infinity, which has no places.
       */
      digits: number;
      /** Said when the answer is narrower than what was asked. */
      note: string;
      /** Whether the endpoint convention changed anything here. */
      endpoint: boolean;
    }
  | {
      status: "none";
      /** Why there is no limit, in words. */
      reason: string;
      formLatex: string;
      /** The one-sided limits that exist, as evidence. */
      sides: LimitSideView[];
      /** The argument, at every depth. */
      steps: LimitStepView[];
      endpoint: boolean;
    }
  | {
      status: "refused";
      error: string;
      formLatex: string;
      /** Whichever one-sided limits were found, when not both were. */
      sides?: LimitSideView[];
    };

const sideView = (
  approachLatex: string,
  bodyLatex: string,
  valueLatex: string
): LimitSideView => ({
  latex: `\\lim_{${approachLatex}}${bodyLatex}=${valueLatex}`,
  approachLatex,
  valueLatex,
});

/** How each side is written after the point in `\lim_{x\to a}`. */
const SIDE_MARKS: Record<LimitDirection, string> = {
  both: "",
  left: "^{-}",
  right: "^{+}",
};

/** Each indeterminate form as it is written in a textbook. */
const FORM_LATEX: Record<IndeterminateForm, string> = {
  "0/0": "\\frac{0}{0}",
  "inf/inf": "\\frac{\\infty}{\\infty}",
  "0*inf": "0\\cdot\\infty",
  "inf-inf": "\\infty-\\infty",
  "1^inf": "1^{\\infty}",
  "0^0": "0^{0}",
  "inf^0": "\\infty^{0}",
};

/** Names that are values without anybody defining them. */
const KNOWN_CONSTANTS = ["e", "pi"];

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
  /** The decimal to show: fourteen places, every one of them right. */
  decimal: string;
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
  /**
   * For a match: how many digits it explains beyond what the formula takes
   * to write down. The larger, the less likely the match is a coincidence.
   */
  spare?: number;
  /**
   * The definitions the exact form needs before Desmos can evaluate it: γ,
   * ζ(3) and the rest have no name there until one is given.
   */
  definitions: { name: string; latex: string }[];
}

/**
 * How many digits a decimal needs before reading it backwards waits for a
 * pause in typing. Below this the search is quick enough to run on every
 * keystroke; above it, a search per digit typed would be felt.
 */
const SLOW_DECIMAL_DIGITS = 16;

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
  /** Numerical definite integrals already done, by integrand and bounds. */
  private readonly numericDefinite = new Map<
    string,
    QuadratureResult | "none"
  >();
  private numericJob?: { key: string; timer?: ReturnType<typeof setTimeout> };
  private limitCache?: { key: string; result: LimitView };
  private exactCache?: { latex: string; result: ExactReading | undefined };
  private exactTimer?: ReturnType<typeof setTimeout>;
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

  /**
   * Desmos's LaTeX config, with every Greek letter known by name.
   *
   * The writer spells a variable as a command only if it is one of
   * MathQuill's auto-commands, and Desmos's leave out γ, ζ and most of the
   * alphabet — so `γ + π²/6` came out as `\operatorname{gamma}+…`, which
   * Desmos reads as an unknown operator. The same list the Custom MathQuill
   * Config plugin injects is added here, whether or not that plugin is on.
   */
  private get textModeConfig() {
    if (this.parseConfig === undefined) {
      this.parseConfig = buildConfigFromGlobals(Desmos, this.plugin.calc);
      for (const letter of EXTENDED_GREEK)
        this.parseConfig.commandNames.add(letter);
    }
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
    // Cached: reading a long decimal backwards searches towers of constants
    // at high precision, and the panel asks on every render pass.
    if (this.exactCache?.latex === latex) return this.exactCache.result;
    // A long decimal is searched once typing pauses, not on every digit: the
    // search takes up to a second, and one per keystroke would stall the
    // field. Nothing is claimed in the meantime.
    if (significantDigits(latex.trim()) >= SLOW_DECIMAL_DIGITS) {
      if (this.exactTimer !== undefined) clearTimeout(this.exactTimer);
      this.exactTimer = setTimeout(() => {
        this.exactTimer = undefined;
        this.exactCache = { latex, result: this.readExact(latex) };
        this.plugin.rerenderPanel();
      }, 350);
      return undefined;
    }
    this.exactCache = { latex, result: this.readExact(latex) };
    return this.exactCache.result;
  }

  private readExact(latex: string): ExactReading | undefined {
    if (latex.trim() === "") return undefined;

    // A bare decimal is read backwards instead of forwards. Taken literally it
    // is already exact — 9.86960440109 is that fraction over 10^11 — and saying
    // so is useless, because the number on screen is what somebody copied off
    // Desmos and the question is what it came from.
    const asDecimal = recognizeDecimal(latex);
    if (asDecimal !== undefined) {
      return {
        // Written as the formula was found, the way a textbook writes it:
        // `(1+√5)/2` rather than the exact layer's `√5/2 + 1/2`.
        latex: toLatexTree(this.textModeConfig, asDecimal.node),
        value: toNumber(asDecimal.value),
        decimal: exactDecimal(asDecimal.value),
        trivial: false,
        matched: asDecimal.digits,
        spare: asDecimal.spare,
        definitions: asDecimal.definitions.map((c) => ({
          name: c.name,
          latex: c.definition,
        })),
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
      decimal: exactDecimal(value),
      // A constant whose exact form is `7` is one Desmos already showed as 7.
      // Repeating it teaches nothing and makes the readout look broken on the
      // expressions where it has nothing to add.
      trivial: /^-?\d+$/.test(exact),
      definitions: [],
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
      // `x(x+1)` parses as a call of a function named x; see implicitProducts.
      const tree = implicitProducts(
        parseLatex(this.textModeConfig, latex),
        variable
      );
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
      // Read as a product before anything sees it, the worked example
      // included: it is built from this tree, and an example copied from a
      // call would be refused for the same reason the original was.
      const tree = implicitProducts(
        parseLatex(this.textModeConfig, fLatex),
        variable
      );
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

    const { variable } = this.config.derivative;
    let tree: Node;
    try {
      // An answer written `2x(x+1)` is a product too, and marking it as a
      // call nobody defined would call a right answer unreadable.
      tree = implicitProducts(
        parseLatex(this.textModeConfig, attempt),
        variable
      );
    } catch {
      return "unreadable";
    }
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
    const { fLatex, variable, terms, definite, lowerLatex, upperLatex } =
      this.config.integral;
    if (fLatex.trim() === "") return undefined;
    const bounds = definite ? `${lowerLatex} ${upperLatex}` : "";
    const key = `${variable} ${terms} ${fLatex} ${bounds}`;
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
      // `x(x)` parses as a call of a function named x; see implicitProducts.
      // Normalised here as well as inside the integrator, because the numeric
      // check below evaluates the integrand too.
      integrand = implicitProducts(
        parseLatex(this.textModeConfig, fLatex),
        variable
      );
    } catch {
      // Half-typed LaTeX does not parse, and that is the normal state of an
      // input somebody is still using rather than something to report.
      return { ok: false, error: "" };
    }

    let refusal: string;
    let special: string | undefined;
    try {
      const found = integrateWithMethod(integrand, variable);
      const { value } = found;
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
          method: describeMethod(found.techniques),
          definite: this.config.integral.definite
            ? this.definiteView(integrand, value, variable, fLatex)
            : undefined,
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
      if (error instanceof NonElementaryError) ({ special } = error);
    }

    return {
      ok: false,
      error: refusal,
      special,
      series: this.series(integrand, terms),
      definite: this.config.integral.definite
        ? this.numericDefiniteView(integrand, variable, fLatex)
        : undefined,
    };
  }

  /**
   * `∫_a^b f` with no antiderivative: integrated numerically to thirty-odd
   * digits, then read back into a closed form where the digits say which.
   *
   * The integration takes up to a couple of seconds, so it runs in slices
   * once typing pauses, and the view says it is working until it is done.
   */
  private numericDefiniteView(
    integrand: Node,
    variable: string,
    fLatex: string
  ): DefiniteView {
    const { lowerLatex, upperLatex } = this.config.integral;
    const lower = this.readBound(lowerLatex);
    const upper = this.readBound(upperLatex);
    if (lower === undefined || upper === undefined)
      return {
        ok: false,
        error: "Each bound has to be a number, an expression in numbers, or ∞.",
      };
    // Anything else named in it has no value, and neither does the integral.
    const callees = new Set<string>();
    visitTree(integrand, (child) => {
      if (child.type === "FunctionCall") callees.add(child.callee.symbol);
    });
    const free = identifiersIn(integrand).filter(
      (name) =>
        name !== variable && name !== "e" && name !== "pi" && !callees.has(name)
    );
    if (free.length > 0)
      return {
        ok: false,
        error: `A value needs numbers, and ${free[0]} has none here.`,
      };
    const key = `${variable}|${fLatex}|${lowerLatex}|${upperLatex}`;
    const done = this.numericDefinite.get(key);
    if (done === undefined) {
      this.startNumericDefinite(key, integrand, variable, lower, upper);
      return { ok: false, error: "", pending: true };
    }
    if (done === "none")
      return {
        ok: false,
        error:
          "No antiderivative was found to evaluate, and integrating numerically to thirty digits did not settle: the integral may diverge, have a point inside the interval where it is undefined, or oscillate out to infinity in a way this cannot follow.",
      };
    const statementLatex = `\\int_{${lowerLatex.trim()}}^{${upperLatex.trim()}}${fLatex}d${variable}`;
    const shown = Math.min(done.digits, 34);
    const text = done.value.toSignificantDigits(shown).toFixed();
    const match = recognizeDecimal(text);
    if (match !== undefined && match.spare >= 8) {
      return {
        ok: true,
        numeric: true,
        statementLatex,
        valueLatex: toLatexTree(this.textModeConfig, match.node),
        decimal: `≈ ${done.value.toFixed(DECIMAL_PLACES)}`,
        note: `No antiderivative was found to evaluate, so this was integrated numerically, to ${done.digits} digits. Those digits match this closed form with ${match.spare} to spare: almost certainly exact, but found by matching digits (an integer-relation search), not proved.`,
        definitions: match.definitions.map((c) => ({
          name: c.name,
          latex: c.definition,
        })),
      };
    }
    return {
      ok: true,
      numeric: true,
      statementLatex,
      valueLatex: done.value.toSignificantDigits(Math.min(shown, 20)).toFixed(),
      decimal: "",
      note: `No antiderivative was found to evaluate, so this was integrated numerically, to ${done.digits} digits, and no closed form among the constants known here matches them. Every digit shown is right.`,
    };
  }

  /** Runs the numerical integration for `key`, a few milliseconds at a time. */
  private startNumericDefinite(
    key: string,
    integrand: Node,
    variable: string,
    lower: Bound,
    upper: Bound
  ) {
    if (this.numericJob?.key === key) return;
    this.cancelNumericDefinite();
    const job: { key: string; timer?: ReturnType<typeof setTimeout> } = {
      key,
    };
    this.numericJob = job;
    const finish = (result: QuadratureResult | "none") => {
      if (this.numericDefinite.size > 24) this.numericDefinite.clear();
      this.numericDefinite.set(key, result);
      this.numericJob = undefined;
      this.integralCache = undefined;
      this.plugin.rerenderPanel();
    };
    job.timer = setTimeout(() => {
      // A pole inside the interval makes the symmetric nodes cancel, and
      // ∫₋₁¹ dx/x would come back 0; it has no value at all.
      const a = lower.kind === "finite" ? lower.value : lower.sign * Infinity;
      const b = upper.kind === "finite" ? upper.value : upper.sign * Infinity;
      if (
        interiorSingularity(
          (x) => evaluate(integrand, { [variable]: x }),
          Math.min(a, b),
          Math.max(a, b)
        )
      ) {
        finish("none");
        return;
      }
      const steps = quadratureSteps(integrand, variable, lower, upper);
      const run = () => {
        if (this.numericJob !== job) return;
        const until = Date.now() + 20;
        try {
          while (Date.now() < until) {
            const next = steps.next();
            if (next.done === true) {
              finish(next.value ?? "none");
              return;
            }
          }
        } catch {
          finish("none");
          return;
        }
        job.timer = setTimeout(run, 0);
      };
      run();
    }, 300);
  }

  private cancelNumericDefinite() {
    if (this.numericJob?.timer !== undefined)
      clearTimeout(this.numericJob.timer);
    this.numericJob = undefined;
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
    const found = seriesFallback(integrand, variable, terms);
    if (found === undefined) return undefined;
    const emit = (node: Node) => toLatexTree(this.textModeConfig, node);
    return {
      termLatex: found.term === undefined ? "" : emit(found.term),
      parts: found.parts.map((part) => ({
        latex: emit(part.integrand),
        kind: part.kind,
      })),
      order: found.order,
      sumLatex: emit(found.sum),
      partialLatex: emit(found.partial),
      interval: found.interval,
      terms,
    };
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

  /**
   * `∫_a^b` of the integrand, from the antiderivative already found.
   *
   * The bounds are read as typed; `\infty` is read here rather than by the
   * parser, which has no infinity to give back.
   */
  private definiteView(
    integrand: Node,
    antiderivative: Node,
    variable: string,
    fLatex: string
  ): DefiniteView {
    const { lowerLatex, upperLatex } = this.config.integral;
    const lower = this.readBound(lowerLatex);
    const upper = this.readBound(upperLatex);
    if (lower === undefined || upper === undefined) {
      return {
        ok: false,
        error: "Each bound has to be a number, an expression in numbers, or ∞.",
      };
    }
    const statementLatex = `\\int_{${lowerLatex.trim()}}^{${upperLatex.trim()}}${fLatex}d${variable}`;
    try {
      const result = definiteIntegral(
        integrand,
        antiderivative,
        variable,
        lower,
        upper
      );
      if (result.diverges === 0) {
        return {
          ok: false,
          error:
            "The integral diverges: on either side of a point inside the interval the antiderivative runs off to infinity, in different directions, so it has no value.",
        };
      }
      if (result.diverges !== undefined) {
        return {
          ok: true,
          statementLatex,
          valueLatex: result.diverges > 0 ? "\\infty" : "-\\infty",
          decimal: "",
          note: "The integral diverges: the antiderivative has no finite limit at the bound.",
        };
      }
      const exact = result.exact ?? toExact(0);
      return {
        ok: true,
        statementLatex,
        valueLatex: toLatexTree(this.textModeConfig, exactToNode(exact)),
        decimal: exactDecimal(exact),
        note: result.improper
          ? "Improper: the antiderivative is taken as a limit at the bound, and the value is checked against a numerical integration."
          : "Checked against a numerical integration of the integrand.",
      };
    } catch (error) {
      if (!(error instanceof DefiniteError)) throw error;
      return { ok: false, error: error.message };
    }
  }

  /** A bound as typed: `\infty`, `-\infty`, or a constant expression. */
  private readBound(latex: string): Bound | undefined {
    const trimmed = latex.trim().replace(/\\left|\\right/g, "");
    if (/^\+?\\infty$/.test(trimmed)) return { kind: "infinite", sign: 1 };
    if (/^-\\infty$/.test(trimmed)) return { kind: "infinite", sign: -1 };
    try {
      const node = parseLatex(this.textModeConfig, latex);
      const value = evaluate(node, {});
      return Number.isFinite(value)
        ? { kind: "finite", node, value }
        : undefined;
    } catch {
      return undefined;
    }
  }

  setIntegralDefinite(definite: boolean) {
    this.updateConfig((config) => {
      config.integral.definite = definite;
    });
  }

  setIntegralBound(which: "lower" | "upper", latex: string) {
    this.updateConfig((config) => {
      if (which === "lower") config.integral.lowerLatex = latex;
      else config.integral.upperLatex = latex;
    });
  }

  /**
   * Puts the value of the definite integral into the graph, after any
   * definitions it needs that the graph does not already have.
   */
  insertDefinite() {
    const definite = this.integral?.definite;
    if (definite?.ok !== true) return;
    const existing = this.plugin.calc
      .getExpressions()
      .flatMap((item) =>
        item.type === "expression" && typeof item.latex === "string"
          ? [item.latex]
          : []
      );
    for (const definition of definite.definitions ?? []) {
      const name = definition.latex.slice(0, definition.latex.indexOf("=") + 1);
      if (!existing.some((latex) => latex.startsWith(name)))
        this.plugin.calc.setExpression({ latex: definition.latex });
    }
    this.plugin.calc.setExpression({
      latex: definite.valueLatex,
      color: "#388c46",
    });
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
   * The limit shown on the Limit tab, or why there is none.
   *
   * Cached against everything that decides it, like the integral: a limit
   * can take L'Hôpital's rule four times over, each a differentiation, and the
   * panel asks for it on every render pass of every keystroke. The
   * explanation depth is not in the key — every depth is computed at once and
   * the panel filters — but the chosen route is, since it picks what is shown.
   */
  get limit(): LimitView | undefined {
    const { fLatex, variable, pointLatex, side, convention, route } =
      this.config.limit;
    if (fLatex.trim() === "" || pointLatex.trim() === "") return undefined;
    const key = `${variable} ${side} ${convention} ${pointLatex} ${fLatex}`;
    if (this.limitCache?.key !== key)
      this.limitCache = {
        key,
        result: this.computeLimit(fLatex, variable, pointLatex, side),
      };
    const { result } = this.limitCache;
    if (result.status !== "value") return result;
    const chosen = result.routes.some((r) => r.id === route)
      ? route
      : (result.routes[0]?.id ?? "");
    return { ...result, route: chosen };
  }

  private computeLimit(
    fLatex: string,
    variable: string,
    pointLatex: string,
    side: LimitDirection
  ): LimitView {
    let node: Node;
    try {
      node = normsToAbs(
        implicitProducts(parseLatex(this.textModeConfig, fLatex), variable)
      );
    } catch {
      // Half-typed, and said nothing about for the reason the integral says
      // nothing: an error under a field somebody is using is noise.
      return { status: "refused", error: "", formLatex: "" };
    }
    const at = this.readBound(pointLatex);
    if (at === undefined)
      return {
        status: "refused",
        error: "The point has to be a number, an expression in numbers, or ∞.",
        formLatex: "",
      };

    const { convention } = this.config.limit;
    const found = findLimit(node, variable, at, side, convention);
    const emit = (n: Node) => toLatexTree(this.textModeConfig, n);
    const point = pointLatex.trim();
    const approachLatex = (s: LimitDirection) =>
      `${variable}\\to ${point}${at.kind === "infinite" ? "" : SIDE_MARKS[s]}`;
    const direction = (s: 1 | -1 | undefined): LimitDirection =>
      s === undefined ? side : s > 0 ? "right" : "left";
    const limitLatex = (l: Limit) =>
      l.kind === "infinite"
        ? l.sign > 0
          ? "\\infty"
          : "-\\infty"
        : emit(exactToNode(l.value));
    const sideLine = (s: LimitDirection, l: Limit) =>
      sideView(approachLatex(s), fLatex, limitLatex(l));
    const formLatex = found.form === undefined ? "" : FORM_LATEX[found.form];
    const approachFor = (s: 1 | -1): Approach =>
      at.kind === "infinite"
        ? { kind: "infinite", sign: at.sign }
        : { kind: "point", node: at.node, value: at.value, side: s };
    // The explanation's maths, from the engine's trees.
    const stepView =
      (under: string) =>
      (step: LimitStep): LimitStepView => ({
        say: step.say,
        why: step.why ?? "",
        proof: step.proof ?? "",
        lines: step.math.map((line): LimitLineView => {
          switch (line.kind) {
            case "limit":
              return {
                kind: "limit",
                approachLatex: under,
                latex: emit(line.body),
                equals: line.equals,
              };
            case "expr":
              return {
                kind: "math",
                approachLatex: "",
                latex: emit(line.node),
                equals: line.equals,
              };
            case "value":
              return {
                kind: "math",
                approachLatex: "",
                latex: limitLatex(line.limit),
                equals: line.equals,
              };
            default:
              // The last kind: "between", an inequality on one line.
              return {
                kind: "math",
                approachLatex: "",
                latex: `${emit(line.low)}\\le ${emit(line.middle)}\\le ${emit(line.high)}`,
                equals: false,
              };
          }
        }),
      });
    // The working is computed on one side, and written the way the question
    // was asked: `x → 0` when both sides agree, `x → 0⁺` when only one was
    // taken.
    const routesFor = (
      s: 1 | -1,
      limit: Limit,
      method: LimitMethod,
      shown: LimitDirection
    ): LimitRouteView[] =>
      limitRoutes({
        original: node,
        node: method.resolved,
        variable,
        approach: approachFor(s),
        limit,
        method,
        form: found.form,
      }).map((route) => ({
        id: route.id,
        name: route.name,
        steps: route.steps.map(stepView(approachLatex(shown))),
      }));
    const { answer } = found;

    switch (answer.kind) {
      case "value": {
        const sides: (1 | -1)[] =
          at.kind === "infinite"
            ? [1]
            : answer.side !== undefined
              ? [answer.side]
              : [1, -1];
        const evidence = sides.map((s) =>
          numericEvidence(node, variable, approachFor(s), answer.limit)
        );
        const verdicts = evidence.map((e) => e.verdict);
        // The weaker side is what can be claimed for both.
        const digits = Math.min(...evidence.map((e) => e.digits));
        // A limit the numbers actively contradict is not shown. The engine
        // proves what it answers, and a conflict is the one sign left that a
        // proof went wrong somewhere; wrong in a form that looks exactly like
        // right is the worst thing this panel could do.
        if (verdicts.includes("conflict"))
          return {
            status: "refused",
            error:
              "The limit found here does not agree with the function's values near the point, so it is not shown.",
            formLatex,
          };
        const shownSide = direction(answer.side);
        const infinite = answer.limit.kind === "infinite";
        return {
          status: "value",
          statementLatex: `\\lim_{${approachLatex(shownSide)}}${fLatex}`,
          approachLatex: approachLatex(shownSide),
          bodyLatex: fLatex,
          valueLatex: limitLatex(answer.limit),
          decimal:
            answer.limit.kind === "finite"
              ? exactDecimal(answer.limit.value)
              : "",
          finite: !infinite,
          caption:
            answer.limit.kind === "infinite"
              ? `The values ${answer.limit.sign > 0 ? "grow" : "fall"} without bound, so there is no finite limit; ${answer.limit.sign > 0 ? "+∞" : "−∞"} says how it fails to have one.`
              : "",
          formLatex,
          routes: routesFor(
            answer.side ?? 1,
            answer.limit,
            answer.method,
            shownSide
          ),
          route: "",
          check: verdicts.every((v) => v === "consistent")
            ? "consistent"
            : "inconclusive",
          digits,
          note:
            answer.withinDomain === true
              ? `The function only lives to the ${shownSide} of the point, and the limit is taken within its domain.`
              : "",
          endpoint: answer.withinDomain === true,
        };
      }
      case "one-side-only": {
        const shown = direction(answer.side);
        const other = answer.side > 0 ? "left" : "right";
        const routes = routesFor(
          answer.side,
          answer.limit,
          answer.method,
          shown
        );
        return {
          status: "none",
          reason: `There is no two-sided limit: the function has no values to the ${other} of the point, because ${answer.missing}. From the ${shown} it does have a limit.`,
          formLatex,
          sides: [sideLine(shown, answer.limit)],
          steps: routes[0]?.steps ?? [],
          endpoint: true,
        };
      }
      case "no-approach":
        return {
          status: "none",
          reason: `There is no limit to take: the function has no values near this point on the side asked for, because ${answer.reason}.`,
          formLatex,
          sides: [],
          steps: [],
          endpoint: false,
        };
      case "sides-differ":
        return {
          status: "none",
          reason:
            "The limit does not exist: the function approaches different values from the two sides.",
          formLatex,
          sides: [
            sideLine("left", answer.left),
            sideLine("right", answer.right),
          ],
          steps: [
            {
              say: "Coming from the left, the values settle on one thing; coming from the right, on another.",
              lines: [],
              why: "A two-sided limit exists exactly when both one-sided limits exist and are equal.",
              proof:
                "Each one-sided limit is proved on its own side, with the sign of every choice it depends on proved there too.",
            },
          ],
          endpoint: false,
        };
      case "oscillates": {
        const { proof } = answer;
        const wave = emit(callNode(proof.fn, proof.argument));
        const values = (target: 1 | -1) => {
          if (proof.amplitude.kind === "infinite")
            return proof.amplitude.sign * target > 0 ? "\\infty" : "-\\infty";
          const shifted = addExact(
            proof.rest.kind === "finite" ? proof.rest.value : EXACT_ZERO,
            target > 0
              ? proof.amplitude.value
              : negateExact(proof.amplitude.value)
          );
          return emit(exactToNode(shifted));
        };
        const unbounded = proof.amplitude.kind === "infinite";
        return {
          status: "none",
          reason: `The limit does not exist: the function oscillates${unbounded ? ", further and further each way" : ""}.`,
          formLatex,
          sides: [],
          steps: [
            {
              say: `What is inside the ${proof.fn === "sin" ? "sine" : "cosine"} runs off to ${proof.argumentSign > 0 ? "+∞" : "−∞"}, so it keeps swinging between −1 and 1 however close you look. Where it is 1 the function is near one value, and where it is −1 near another.`,
              lines: [
                {
                  kind: "math",
                  approachLatex: "",
                  latex: `${wave}=1\\Rightarrow ${fLatex}\\to ${values(1)}`,
                  equals: false,
                },
                {
                  kind: "math",
                  approachLatex: "",
                  latex: `${wave}=-1\\Rightarrow ${fLatex}\\to ${values(-1)}`,
                  equals: false,
                },
              ],
              why: "A limit would have to be close to both at once, and two different values cannot both be.",
              proof:
                "The argument is continuous near the point and tends to an infinity, so by the intermediate value theorem it passes through π/2 + 2πn and 3π/2 + 2πn for every large n, at points arbitrarily close to the point. Along those two sequences the function tends to different limits (or to opposite infinities), which no single limit allows.",
            },
          ],
          endpoint: false,
        };
      }
      case "unknown": {
        // Functions are names too, and `sin` needs no value from anybody.
        const called = new Set<string>();
        visitTree(node, (child) => {
          if (child.type === "FunctionCall") called.add(child.callee.symbol);
        });
        const named = identifiersIn(node).filter(
          (name) =>
            name !== variable &&
            !KNOWN_CONSTANTS.includes(name) &&
            !called.has(name)
        );
        return {
          status: "refused",
          error:
            named.length > 0
              ? `This uses ${named.join(", ")}, which nothing here gives a value to, so there is no number to approach.`
              : "No limit was found. None of the methods here decides this one, and a guess from the numbers is not a limit.",
          formLatex,
          sides: [
            ...(answer.left === undefined
              ? []
              : [sideLine("left", answer.left)]),
            ...(answer.right === undefined
              ? []
              : [sideLine("right", answer.right)]),
          ],
        };
      }
    }
  }

  setLimitExpression(fLatex: string) {
    this.updateConfig((config) => {
      config.limit.fLatex = fLatex;
      config.limit.route = "";
    });
  }

  setLimitVariable(variable: string) {
    this.updateConfig((config) => {
      config.limit.variable = variable;
    });
  }

  setLimitPoint(pointLatex: string) {
    this.updateConfig((config) => {
      config.limit.pointLatex = pointLatex;
      config.limit.route = "";
    });
  }

  setLimitSide(side: LimitDirection) {
    this.updateConfig((config) => {
      config.limit.side = side;
    });
  }

  setLimitExplain(explain: ExplainLevel) {
    this.updateConfig((config) => {
      config.limit.explain = explain;
    });
  }

  setLimitConvention(convention: "bilateral" | "domain") {
    this.updateConfig((config) => {
      config.limit.convention = convention;
    });
  }

  setLimitRoute(route: string) {
    this.updateConfig((config) => {
      config.limit.route = route;
    });
  }

  /** Puts the value of the limit into the graph, when it is a number. */
  insertLimit() {
    const found = this.limit;
    if (found?.status !== "value" || !found.finite) return;
    this.plugin.calc.setExpression({
      latex: found.valueLatex,
      color: "#388c46",
    });
  }

  /**
   * Draws the function and what its limit looks like on the graph: an open
   * circle at a finite limit at a point — open because the function need not
   * have that value there, which is the whole distinction a limit makes — a
   * dashed horizontal asymptote for a limit at infinity, and a dashed
   * vertical one for an infinite limit at a point.
   *
   * The graph is always in x, so a function written in t is drawn with its
   * variable renamed; one that already mentions x as something else is not
   * drawn, since renaming would change what it means.
   */
  showLimitOnGraph() {
    const found = this.limit;
    const { fLatex, variable, pointLatex } = this.config.limit;
    if (found === undefined) return;
    if (variable !== "x" && mentions(fLatex, "x")) return;
    const graphed =
      variable === "x" ? fLatex : renameIdentifier(fLatex, variable, "x");
    const at = this.readBound(pointLatex);
    if (at === undefined) return;
    const { calc } = this.plugin;
    calc.setExpression({ latex: `y=${graphed}`, color: "#2d70b3" });
    const point = pointLatex.trim();
    if (found.status === "value") {
      if (at.kind === "infinite" && found.finite) {
        calc.setExpression({
          latex: `y=${found.valueLatex}`,
          color: "#c74440",
          lineStyle: "DASHED",
        });
      } else if (at.kind === "finite" && found.finite) {
        calc.setExpression({
          latex: `\\left(${point},${found.valueLatex}\\right)`,
          color: "#c74440",
          pointStyle: "OPEN",
        });
      } else if (at.kind === "finite") {
        calc.setExpression({
          latex: `x=${point}`,
          color: "#c74440",
          lineStyle: "DASHED",
        });
      }
    } else if (found.status === "none" && at.kind === "finite") {
      // Where each side is headed, as its own open circle, which is the
      // picture of a jump.
      for (const { valueLatex: value } of found.sides) {
        if (value.includes("\\infty")) continue;
        calc.setExpression({
          latex: `\\left(${point},${value}\\right)`,
          color: "#c74440",
          pointStyle: "OPEN",
        });
      }
    }
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
    if (this.exactTimer !== undefined) clearTimeout(this.exactTimer);
    this.exactTimer = undefined;
    this.environmentTimer = undefined;
    this.cancelNumericDefinite();
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

/**
 * How many decimal places an exact value's decimal shows: twelve that are
 * asked for and two to spare. Computed at sixty significant digits, so every
 * place shown is right, not merely printed.
 */
const DECIMAL_PLACES = 14;

/**
 * The decimal beside an exact value.
 *
 * `= 0.6` when the decimal *is* the value — a fraction whose expansion stops
 * within the places shown — and `≈` with fourteen places otherwise. A value
 * too large or too small for fourteen places to say anything useful is
 * written in scientific form with fifteen significant digits instead.
 */
function exactDecimal(value: ExactValue): string {
  const precise = toExactDecimal(value);
  if (!precise.isFinite()) return "";
  const size = precise.abs();
  if (!size.isZero() && (size.lt("1e-4") || size.gte("1e15")))
    return `≈ ${precise.toSignificantDigits(15).toExponential(14)}`;
  const shown = precise.toFixed(DECIMAL_PLACES);
  const exact = precise.eq(shown);
  const trimmed = shown.includes(".")
    ? shown.replace(/0+$/, "").replace(/\.$/, "")
    : shown;
  return exact ? `= ${trimmed}` : `≈ ${shown}`;
}
