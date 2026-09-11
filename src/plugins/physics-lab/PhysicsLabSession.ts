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
import type { Config } from "../../../text-mode-core";
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
  defaultPhysicsLabConfig,
  normalizePhysicsLabConfig,
  thinSlopeGrid,
  validateSlopeField,
  type PanelTab,
  type PhysicsLabConfig,
  type SlopeValidation,
} from "./model";
import type PhysicsLab from ".";

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
