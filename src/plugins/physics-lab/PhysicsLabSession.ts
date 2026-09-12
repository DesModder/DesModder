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
  RULE_FORMULAS,
  similarExample,
  stepsOf,
  topLevelTerms,
  type Derivation,
} from "./symbolic/differentiate";
import { agreesOnSamples, evaluate } from "./symbolic/evaluate";
import { simplify as simplifyTree } from "./symbolic/integrate";

import { toLatex as toLatexTree } from "./symbolic/latex";
import {
  defaultPhysicsLabConfig,
  normalizePhysicsLabConfig,
  thinSlopeGrid,
  validateSlopeField,
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

/** One step of a derivation, rendered, so the panel needs no `Config`. */
export interface ShownStep {
  key: string;
  title: string;
  /** The structure that was recognised — why this rule and not another. */
  recognition: string;
  /** What applying it does here. Empty when the formula beside it says so. */
  detail: string;
  /** The rule in general, where it has a form worth memorising. */
  formula: string;
  /** The names the rule gave the pieces, already rendered. */
  substitutions: { symbol: string; latex: string }[];
  /**
   * The rule applied with its sub-derivatives still written as `d/dx(…)`.
   *
   * Only carried for the structural steps. On a sub-problem it would say
   * nothing the answer beneath it does not already say, and every extra line
   * of maths costs a reader more than it costs the renderer.
   */
  intermediate: string;
  /** What this step produced, tidied. */
  latex: string;
  depth: number;
  /** A structural decision rather than a sub-problem, for the panel's emphasis. */
  major: boolean;
  /** A fact rather than an idea, so it waits until the reader asks for everything. */
  atomic: boolean;
}

/** What the Derivative tab shows. */
export type DerivationView =
  | {
      ok: true;
      resultLatex: string;
      /**
       * The answer split at its top-level plus and minus signs, or empty when
       * one line is short enough.
       *
       * A derivative is the one expression on this tab with no bound on its
       * length, and an answer that runs off the side is an answer the reader
       * cannot check. Where to break is decided by counting what actually gets
       * drawn rather than the LaTeX — `\operatorname{sin}\left(` is
       * twenty-four characters and four glyphs — which is a proxy, not a
       * measurement. The resize handle is the exact answer; this is the one
       * that needs no dragging.
       */
      resultLines: string[];
      /** The derivative before tidying, when tidying changed anything. */
      rawLatex: string;
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
  /** Read off the example's own derivation, outermost structure first. */
  hints: readonly string[];
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

/** Beyond this many drawn glyphs an answer is stacked rather than run on. */
const ANSWER_LINE_GLYPHS = 30;

/** How much shorter tidying has to make an answer before it is worth a card. */
const TIDY_GLYPHS = 3;

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
   * Every step of the tree is rendered, including the ones the standard view
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
      const example = this.workedExample(tree, variable);
      exampleDerivative = example?.derivative;
      result = {
        ok: true,
        resultLatex,
        resultLines: this.answerLines(derivation.result, resultLatex),
        // Only when tidying did something a reader would notice. The rules
        // produce `2x^{1}` where the answer is `2x`, and a card about that is
        // a card about nothing — while the one after logarithmic
        // differentiation collapses half a line and is worth seeing.
        rawLatex:
          visibleLength(rawLatex) > visibleLength(resultLatex) + TIDY_GLYPHS
            ? rawLatex
            : "",
        domain: [
          ...new Set(
            derivation.domain.map(
              (condition) => `${emit(condition.expression)}>0`
            )
          ),
        ],
        // Emitted here rather than in the panel. This is where the parser
        // configuration lives, and a view that has to build LaTeX is a view
        // that has to know about `Config`.
        shown: stepsOf(derivation.root).map(({ step, depth }, index) => {
          // Tidied rather than raw. The rule literally produces `2x^{1}` and
          // `3cdot1`, and a reader following the method does not need to see
          // the arithmetic that has not happened yet — the general formula
          // beside it already says what the rule did.
          const produced = emit(simplifyTree(step.after));
          return {
            key: String(index),
            title: step.title,
            recognition: step.recognition,
            detail: step.detail,
            formula: RULE_FORMULAS[step.rule] ?? "",
            substitutions: step.substitutions.map((substitution) => ({
              symbol: substitution.symbol,
              latex: emit(substitution.value),
            })),
            intermediate:
              step.intermediate === undefined || step.importance !== "major"
                ? ""
                : emit(step.intermediate),
            // The outermost structural rule finishes with the whole answer,
            // which is already on screen a few lines above it. Printing it twice
            // makes the first card look like the end of the working.
            latex:
              depth === 0 &&
              step.intermediate !== undefined &&
              produced === resultLatex
                ? ""
                : produced,
            depth,
            major: step.importance === "major",
            // The outermost step is never hidden. A derivation that filters down
            // to nothing at all would be a blank panel reporting success.
            atomic: step.importance === "atomic" && depth > 0,
          };
        }),
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
   * The answer over several lines, or none when it fits on one.
   *
   * Broken only at the top level, and only between terms: a break inside a
   * product or under a fraction bar would change what the expression looks
   * like it says.
   */
  private answerLines(node: Node, latex: string): string[] {
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
          hints: hintsFor(derived.root),
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
   */
  get attemptVerdict(): AttemptVerdict | undefined {
    const attempt = this.config.derivative.attemptLatex.trim();
    if (attempt === "") return undefined;
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

  setAttempt(attemptLatex: string) {
    this.updateConfig((config) => {
      config.derivative.attemptLatex = attemptLatex;
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

  /** Puts the derivative into the graph beside whatever else is there. */
  insertDerivative() {
    const found = this.derivation;
    if (found?.ok !== true) return;
    this.plugin.calc.setExpression({
      latex: found.resultLatex,
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
