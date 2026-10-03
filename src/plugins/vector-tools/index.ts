import { PluginController } from "../PluginController";
import { VectorToolsPanelFunc } from "./components/VectorToolsPanel";
import {
  CalculatorExpressionAdapter,
  type GeneratedItemSnapshot,
} from "./desmos/ExpressionAdapter";
import {
  colorsFromGallery,
  configFromGallery,
  FIELD_GALLERY,
  galleryPreset,
} from "./gallery";
import {
  configForPreset,
  DENSITY_PRESETS,
  effectiveFlowColor,
  isDevelopmentBuild,
  getAxisSampleCount,
  thinArrowGrid,
  activeField,
  cloneDefaultLibrary,
  MAX_FIELDS,
  nextFieldID,
  nextSymbolToken,
  normalizeVectorFieldLibrary,
  uniqueFieldName,
  type VectorFieldLibrary,
  type ColorPalette,
  type ColorRangeMode,
  type DensityPreset,
  type FieldSource,
  type ArrowMode,
  type CurveConfig,
  type FlowConfig,
  type FluidConfig,
  type FlowLook,
  FLOW_LOOK_PRESETS,
  type PanelTab,
  type SamplingAxisConfig,
  type SamplingMode,
  type OverlayLayer,
  type VectorColorMode,
  type VectorFieldConfig,
  type VectorFieldPreset,
  type VectorLengthMode,
  type ZeroVectorMode,
  VECTOR_FIELD_PRESETS,
  cloneDefaultConfig,
  validateVectorFieldConfig,
} from "./model";
import {
  auditVectorFieldPlan,
  componentExpressionID,
  componentFunctionLatex,
  createVectorFieldPlan,
  allGeneratedIDs,
  namespaceForField,
  timeSymbolFor,
  type GenerationOptions,
  editableSlots,
  parseComponentFromLatex,
  setSlotBody,
  slotBody,
  type ComponentSlot,
  type ExpressionAudit,
  type VectorFieldPlan,
} from "./generator";
import {
  add,
  collectLikeTerms,
  constantValue,
  differentiate,
  evaluate,
  identifiersIn,
  simplify,
  subtract,
  toLatex,
  type Node,
} from "./symbolic";

import { buildConfigFromGlobals, parseLatex } from "../../../text-mode-core";
import { FlowOverlay } from "../../field-rendering/FlowOverlay";
import { FluidSession } from "./fluid/FluidSession";
import { ArrowOverlay } from "../../field-rendering/ArrowOverlay";
import type { ArrowOptions } from "../../field-rendering/ArrowRenderer";
import {
  compileFieldComponentToGLSL,
  EMPTY_ENVIRONMENT,
  TIME_NAME,
} from "../../field-rendering/latexToGLSL";
import { mentions } from "../../field-rendering/identifiers";
import type { FieldEnvironment } from "../../field-rendering/latexToGLSL";
import {
  environmentsDiffer,
  scanDefinitions,
} from "../../field-rendering/environment";
import type { FlowField } from "../../field-rendering/FlowRenderer";
import type { ConfigItem } from "..";

/** The divergence and curl of a field, and whether it has a potential. */
export type FieldAnalysis =
  | {
      ok: true;
      divergenceLatex: string;
      /** The scalar curl, ∂Q/∂x − ∂P/∂y: the z-component of ∇ × F. */
      curlLatex: string;
      /**
       * `gradient`: it is ∇f by construction. `exactly`: the curl simplifies
       * to 0. `numerically`: it vanishes at every point checked. `no`: it
       * does not. `unknown`: too few points had a value to say.
       */
      conservative: "gradient" | "exactly" | "numerically" | "no" | "unknown";
    }
  | { ok: false; error: string };

export { TEST_FOLDER_ID, TEST_LINE_ID, TEST_NAMESPACE } from "./ids";

interface VectorToolsSettings {
  serializedFieldConfig: string;
}

type GenerationTarget = "production" | "test";
type TestChecklistID = "visual" | "zero" | "colors" | "responsiveness";

/**
 * The math inputs this plugin owns, as focus locations.
 *
 * The field's three slots plus the curve's two. Mirrors the union in
 * `globals/Calc.ts`, which is where the calculator learns about them.
 */
export type VectorToolsFocusKind = ComponentSlot | "curve-x" | "curve-y";

/** The compiled shader field, or the reason it could not be put on the GPU. */
type FlowCompilation =
  | { ok: true; field: FlowField }
  | { ok: false; error: string };

/**
 * As much of Desmos's `HelperExpression` as reading one number needs.
 *
 * Structural rather than the real type because only these two members are used,
 * and the shipped typings for the rest are incomplete.
 */
interface ValueHelper {
  numericValue: number;
  observe: (event: string, callback: () => void) => void;
}

const FLOW_REFRESH_DELAY_MS = 300;
const ENVIRONMENT_REFRESH_DELAY_MS = 80;
const PANEL_SIZE_SAVE_DELAY_MS = 400;
const POPOVER_CLASS = "dsm-vector-tools-popover";

/**
 * Graph bounds carry a pan's worth of noise digits, and the panel's number
 * fields show them all. Three decimals is finer than anyone samples on.
 */
function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function compileFlowField(
  config: VectorFieldConfig,
  environment: FieldEnvironment
): FlowCompilation {
  if (config.source === "gradient") {
    const f = compileFieldComponentToGLSL(config.scalar.fLatex, environment);
    if (!f.ok) return { ok: false, error: `f(x, y): ${f.error}` };
    return {
      ok: true,
      field: {
        kind: "gradient",
        f: f.glsl,
        helpers: f.helpers,
        params: f.params,
        usesTime: f.usesTime,
      },
    };
  }
  const p = compileFieldComponentToGLSL(config.components.xLatex, environment);
  if (!p.ok) return { ok: false, error: `P(x, y): ${p.error}` };
  const q = compileFieldComponentToGLSL(config.components.yLatex, environment);
  if (!q.ok) return { ok: false, error: `Q(x, y): ${q.error}` };
  // P and Q share one shader, so their helpers merge. Both lists are already in
  // dependency order and a name means one definition, so keeping the first of
  // each name preserves that order for the union.
  const helpers = [...p.helpers];
  for (const helper of q.helpers) {
    if (!helpers.some((existing) => existing.name === helper.name)) {
      helpers.push(helper);
    }
  }
  return {
    ok: true,
    field: {
      kind: "components",
      p: p.glsl,
      q: q.glsl,
      helpers,
      params: [...new Set([...p.params, ...q.params])],
      usesTime: p.usesTime || q.usesTime,
    },
  };
}

const TEST_CHECKLIST: readonly {
  id: TestChecklistID;
  label: string;
}[] = [
  { id: "visual", label: "Arrow directions match the selected preset." },
  {
    id: "zero",
    label: "Zero vectors follow the selected hide/point behavior.",
  },
  { id: "colors", label: "Arrow colors follow the chosen color mode." },
  {
    id: "responsiveness",
    label: "The graph remains responsive at this density.",
  },
];

export default class VectorTools extends PluginController<VectorToolsSettings> {
  static id = "vector-tools" as const;
  static enabledByDefault = false;
  static config = [
    {
      type: "string",
      variant: "text",
      default: JSON.stringify(cloneDefaultLibrary()),
      key: "serializedFieldConfig",
      shouldShow: () => false,
    },
  ] satisfies readonly ConfigItem[];

  private readonly expressions = new CalculatorExpressionAdapter(this.calc);
  private pendingGeneration: GenerationTarget | undefined;
  private lastActionMessage =
    "Configure a field, then generate it into Desmos.";
  private testPresetID: VectorFieldPreset["id"] = "rotational";
  private testDensityID: DensityPreset["id"] = "small";
  private testLengthMode: VectorLengthMode = "normalized";
  private testColorMode: VectorColorMode = "magnitude";
  private readonly completedChecklist = new Set<TestChecklistID>();
  private readonly flowOverlay = new FlowOverlay(this.calc, {
    onError: (message) => {
      this.flowMessage = message;
      this.util.tick();
    },
    onRecovered: () => {
      this.flowMessage = "";
      this.util.tick();
    },
  });
  private readonly arrowOverlay = new ArrowOverlay(this.calc, {
    onError: (message) => {
      this.arrowMessage = message;
      this.util.tick();
    },
    onRecovered: () => {
      this.arrowMessage = "";
      this.util.tick();
    },
  });
  private arrowMessage = "";
  private flowMessage = "";
  private flowRefreshTimer?: ReturnType<typeof setTimeout>;
  /** The field signature the running simulation was compiled from. */
  private lastFlowSignature?: string;
  private flowCompilationCache?: {
    source: FieldSource;
    xLatex: string;
    yLatex: string;
    fLatex: string;
    revision: number;
    result: FlowCompilation;
  };
  /**
   * `getConfig` is read many times while the panel renders, and each read has
   * to parse the persisted JSON. Cache it against the raw string so a render
   * pass costs one parse rather than dozens.
   */
  private configCache?: { serialized: string; library: VectorFieldLibrary };
  private dispatcherID?: string;
  private panelElement?: HTMLElement;
  private panelResizeObserver?: ResizeObserver;
  private panelSizeTimer?: ReturnType<typeof setTimeout>;
  private componentLinkNote = "";
  /** What the expression list defines, as of the last scan. */
  private environment: FieldEnvironment = EMPTY_ENVIRONMENT;
  /**
   * Bumped only when a scan finds something that changes the compiled output,
   * so it can join the compilation cache key without a slider moving evicting
   * it.
   */
  private environmentRevision = 0;
  private environmentTimer?: ReturnType<typeof setTimeout>;
  private clockFrame?: number;
  private clockLastFrame?: number;
  private clockSeconds = 0;
  private lastReverseContrast = false;
  /**
   * One `HelperExpression` per name the field has ever read, and the number it
   * most recently reported.
   *
   * Desmos's own evaluator rather than a second one, which is what makes
   * `a = b + 1` work here without this understanding `b`. They are kept rather
   * than rebuilt because a helper has no documented teardown, so the count is
   * bounded by the names used in a session instead of growing per scan.
   */
  private readonly parameterHelpers = new Map<string, ValueHelper>();

  /** The Fluid tab's state: obstacles, capabilities and the step clock. */
  readonly fluid = new FluidSession({
    config: () => this.getConfig().fluid,
    environment: () => this.environment,
    items: () => this.cc.getAllItemModels() as never,
    degreeMode: () =>
      (this.calc as unknown as { settings?: { degreeMode?: boolean } }).settings
        ?.degreeMode === true,
    helper: (latex) =>
      this.calc.HelperExpression({ latex }) as unknown as ValueHelper,
    changed: () => this.util.tick(),
    ownedPrefix: () => namespaceForField(this.getConfig()),
  });

  afterEnable() {
    this.ensureStoredConfigIsCurrent();
    this.refreshArrows();
    this.dsm.pillboxMenus?.addPillboxButton({
      id: "dsm-vector-tools-menu",
      tooltip: "vector-tools-name",
      iconClass: "dsm-icon-compass2",
      popup: () => VectorToolsPanelFunc(this),
    });
    // Components live in the expression list once the field is generated, so
    // an edit there has to flow back into the panel and the visualizer.
    this.dispatcherID = this.cc.dispatcher.register((event) => {
      if (
        event.type === "set-item-latex" ||
        event.type === "undo" ||
        event.type === "redo" ||
        event.type === "set-state" ||
        // What an API write, a paste, or a definition being typed elsewhere in
        // the list actually arrives as. `set-item-latex` covers the field's own
        // expressions but not `setExpression`, which is how a graph gets a
        // slider without anyone touching this plugin.
        event.type === "on-evaluator-changes"
      ) {
        this.syncComponentsFromExpressions();
        // A component may reference anything the list defines, so an edit
        // anywhere in it — not just to this field's own expressions — can
        // change what the field means.
        this.scheduleEnvironmentRefresh();
      }
      // Reverse contrast is a graph setting changed elsewhere entirely, and
      // nothing tells this plugin about it. A boolean compare per event is
      // cheaper than any arrangement that would.
      if (this.graphReversesContrast !== this.lastReverseContrast) {
        this.lastReverseContrast = this.graphReversesContrast;
        this.syncContrast();
        this.util.tick();
      }
    });
    this.refreshEnvironment();
    this.syncClock();
    this.syncContrast();
  }

  // ---- the animation clock -------------------------------------------------

  /**
   * Whether anything currently being drawn reads `t`.
   *
   * Nothing animates unless the field asks to, so a field written without `t`
   * costs exactly what it did before this existed: no loop, no uploads, and the
   * arrows stay the still picture they were.
   */
  get fieldUsesTime() {
    const compiled = this.flowAvailability;
    return compiled.ok && compiled.field.usesTime === true;
  }

  get timeConfig() {
    return this.getConfig().time;
  }

  /**
   * Whether `t` in this field's components means the clock, for generation.
   *
   * Asked of the LaTeX rather than of `fieldUsesTime`, which is what the shader
   * compiler concluded: generation has to work for fields the GPU cannot draw
   * at all, and refusing to animate a generated field because the compiler
   * choked on a list would be answering the wrong question.
   *
   * The precedence is the same one the compiler uses — a `t` the graph defines
   * for itself is that `t`, not the clock.
   */
  get fieldAnimatesTime() {
    const config = this.getConfig();
    if (this.environment.scalars.has(TIME_NAME)) return false;
    const bodies =
      config.source === "gradient"
        ? [config.scalar.fLatex]
        : [config.components.xLatex, config.components.yLatex];
    return bodies.some((latex) => mentions(latex, TIME_NAME));
  }

  /** Options every plan for the production field is built with. */
  private get generationOptions(): GenerationOptions {
    return { animateTime: this.fieldAnimatesTime };
  }

  /**
   * Whether the graph's ticker is the one this field installed.
   *
   * A ticker is graph-level and cannot be namespaced, so it is the one piece of
   * a generated field whose ownership has to be recognised rather than looked
   * up. Its handler advances the field's own clock symbol, which nothing else
   * would mention.
   */
  private ownsCurrentTicker() {
    const handler = this.expressions.getTicker()?.handlerLatex;
    if (handler === undefined || handler === "") return false;
    return mentions(handler, timeSymbolFor(this.getConfig()));
  }

  setTimePlaying(playing: boolean) {
    this.updateConfig((config) => {
      config.time.playing = playing;
    });
    this.syncClock();
  }

  setTimeSpeed(speed: number) {
    this.updateConfig((config) => {
      config.time.speed = speed;
    });
  }

  /** Back to zero, whether or not the clock is running. */
  resetClock() {
    this.clockSeconds = 0;
    this.arrowOverlay.setTime(0);
    this.flowOverlay.setTime(0);
    this.util.tick();
  }

  /** Seconds on the clock, for the panel to show. */
  get clockReadout() {
    return this.clockSeconds;
  }

  /**
   * Starts or stops the loop to match what is being drawn.
   *
   * Called whenever the field, the play state, or what is mounted changes, so
   * that the loop's existence is derived from those rather than remembered
   * separately and left running after the thing that needed it went away.
   */
  private syncClock() {
    const shouldRun = this.fieldUsesTime && this.getConfig().time.playing;
    if (shouldRun === (this.clockFrame !== undefined)) return;
    if (shouldRun) {
      this.clockLastFrame = undefined;
      this.clockFrame = requestAnimationFrame(this.advanceClock);
    } else {
      if (this.clockFrame !== undefined) cancelAnimationFrame(this.clockFrame);
      this.clockFrame = undefined;
    }
  }

  private readonly advanceClock = (now: number) => {
    this.clockFrame = requestAnimationFrame(this.advanceClock);
    const previous = this.clockLastFrame ?? now;
    this.clockLastFrame = now;
    // Capped, because a backgrounded tab resumes with an enormous gap and an
    // uncapped step would teleport the field rather than animate it.
    const elapsed = Math.min(0.1, Math.max(0, (now - previous) / 1000));
    this.clockSeconds += elapsed * this.getConfig().time.speed;
    // One clock for both, so the arrows and the particles over them are always
    // showing the same instant of the same field.
    this.arrowOverlay.setTime(this.clockSeconds);
    this.flowOverlay.setTime(this.clockSeconds);
  };

  // ---- what the rest of the graph defines ----------------------------------

  /**
   * Rescans the expression list, off the dispatcher's stack.
   *
   * Desmos throws on a dispatch made from inside a dispatcher callback, and
   * reading a value means creating a `HelperExpression`, so none of this may
   * run inline.
   *
   * The delay coalesces rather than debounces — a pending timer is left alone
   * instead of being pushed back — because the event that drives this also
   * fires while a slider animates, and a debounce would never come due under a
   * steady stream of those.
   */
  private scheduleEnvironmentRefresh() {
    if (this.environmentTimer !== undefined) return;
    this.environmentTimer = setTimeout(() => {
      this.environmentTimer = undefined;
      this.refreshEnvironment();
    }, ENVIRONMENT_REFRESH_DELAY_MS);
  }

  private refreshEnvironment() {
    // The item models rather than `getState()`: this runs on evaluator changes,
    // which include every frame of an animating slider, and serialising the
    // whole graph that often to read three fields off each expression would be
    // most of the cost of the feature.
    const scanned = scanDefinitions(
      this.cc.getAllItemModels(),
      namespaceForField(this.getConfig())
    );
    const changed = environmentsDiffer(this.environment, scanned);
    this.environment = scanned;
    if (changed) {
      // The same component compiles differently against a different
      // environment, so the cache key has to move with it.
      this.environmentRevision++;
      this.flowCompilationCache = undefined;
    }
    this.syncParameterValues();
    if (changed) {
      this.refreshArrows();
      this.refreshFlow();
      this.syncClock();
      this.util.tick();
    }
  }

  /**
   * Reads the current number behind every name the compiled field reads, and
   * hands them to both overlays.
   *
   * This is the path a slider drag takes, and it deliberately stops short of
   * the compiler: nothing here can change a shader, only the floats uploaded
   * into one.
   */
  private syncParameterValues() {
    const compiled = this.flowCompilation;
    const names = compiled.ok ? (compiled.field.params ?? []) : [];
    const values = new Map<string, number>();
    for (const name of names) {
      let helper = this.parameterHelpers.get(name);
      if (helper === undefined) {
        helper = this.calc.HelperExpression({
          latex: name,
        }) as unknown as ValueHelper;
        // A slider being dragged reports through here rather than through the
        // expression list, so this is what keeps the picture moving with it.
        helper.observe("numericValue", () => this.pushParameterValues());
        this.parameterHelpers.set(name, helper);
      }
      values.set(name, helper.numericValue);
    }
    this.arrowOverlay.setParameters(values);
    this.flowOverlay.setParameters(values);
  }

  /**
   * Re-reads the helpers already made, without rescanning or recompiling.
   *
   * Deliberately does not re-render the panel. This runs on every frame of a
   * slider drag, and the panel has nothing on it that changes with a value —
   * which is the reason the reference line names what is being used without
   * quoting what it currently equals. The number is already on screen, in the
   * expression that defines it.
   */
  private pushParameterValues() {
    const values = new Map<string, number>();
    for (const [name, helper] of this.parameterHelpers) {
      values.set(name, helper.numericValue);
    }
    this.arrowOverlay.setParameters(values);
    this.flowOverlay.setParameters(values);
  }

  /**
   * What this field borrows from the rest of the graph.
   *
   * Worth saying out loud: a component that reads `a` looks exactly like one
   * that does not, right up until somebody deletes `a` and the whole field
   * stops drawing for a reason that is nowhere near where they were working.
   *
   * Names only, never their values. The value is already on screen in the
   * expression that defines it, and quoting it here would mean re-rendering
   * the panel on every frame of a slider drag to keep the quote honest.
   */
  get fieldReferenceStatus(): string {
    const compiled = this.flowCompilation;
    if (!compiled.ok) return "";
    const helpers = compiled.field.helpers ?? [];
    const params = compiled.field.params ?? [];
    if (helpers.length === 0 && params.length === 0) return "";
    const names = [...helpers.map((helper) => `${helper.name}()`), ...params];
    return `Using from the expression list: ${names.join(", ")}.`;
  }

  get arrowMode() {
    return this.getConfig().arrowMode;
  }

  get arrowStatus() {
    if (this.arrowMode === "off") return "Arrows are off.";
    if (this.arrowMode !== "live") return "";
    if (this.arrowMessage !== "") return this.arrowMessage;
    if (!this.arrowOverlay.isRunning) return "";
    const grid = this.arrowGrid;
    if (grid.thinned) {
      return `Drawing ${this.arrowOverlay.arrowCount} of ${grid.requested} arrows live — sampled coarsely to stay readable. Turn off the density limit to draw all of them.`;
    }
    return `Drawing ${this.arrowOverlay.arrowCount} arrows live.`;
  }

  /** Tests only: what the last live-arrow frame actually drew into. */
  get arrowViewport() {
    return this.arrowOverlay.drawnViewport;
  }

  setArrowDensityLimit(limit: boolean) {
    this.updateConfig((config) => {
      config.arrowDensityLimit = limit;
    });
  }

  setArrowMode(mode: ArrowMode) {
    this.updateConfig((config) => {
      config.arrowMode = mode;
    });
  }

  /**
   * Starts, updates or stops the live arrows to match the configuration.
   *
   * Cheap enough to call on every change: the overlay only relinks a shader
   * when the field itself changed, and a settings-only change is a uniform
   * upload and one frame.
   */
  refreshArrows() {
    if (this.arrowMode !== "live") {
      if (this.arrowOverlay.isRunning) {
        this.arrowOverlay.stop();
        this.arrowMessage = "";
      }
      return;
    }
    const compiled = this.flowAvailability;
    if (!compiled.ok) {
      this.arrowOverlay.stop();
      this.arrowMessage = compiled.error;
      return;
    }
    this.arrowMessage = "";
    this.arrowOverlay.start(compiled.field, this.arrowOptions);
    // A start may have mounted a canvas, and a fresh canvas lands wherever the
    // overlay's own default puts it until it is told which side it is on.
    this.syncLayer();
  }

  /**
   * The grid the live arrows are drawn on.
   *
   * Thinned only if the user has left the density limit on. With it off the
   * grid is whatever the sampling domain asks for, however many that is.
   */
  private get arrowGrid() {
    const config = this.getConfig();
    const columns = getAxisSampleCount(config.domain.x);
    const rows = getAxisSampleCount(config.domain.y);
    if (!config.arrowDensityLimit) {
      return { columns, rows, thinned: false, requested: columns * rows };
    }
    return thinArrowGrid(columns, rows);
  }

  private get arrowOptions(): ArrowOptions {
    const config = this.getConfig();
    const grid = this.arrowGrid;
    // The same rule the generator uses, over the spacing actually drawn: a
    // thinned grid is a coarser one, and its arrows have to grow to match or
    // they end up shorter than a pixel and disappear.
    const spacing = Math.min(
      Math.abs(config.domain.x.max - config.domain.x.min) /
        Math.max(1, grid.columns - 1),
      Math.abs(config.domain.y.max - config.domain.y.min) /
        Math.max(1, grid.rows - 1)
    );
    return {
      columns: grid.columns,
      rows: grid.rows,
      domain: {
        xMin: config.domain.x.min,
        xMax: config.domain.x.max,
        yMin: config.domain.y.min,
        yMax: config.domain.y.max,
      },
      lengthMode: config.length.mode,
      targetLength: config.length.autoLength
        ? 0.7 * spacing
        : config.length.targetLength,
      scale: config.length.scale,
      maximumLength: config.length.maximumLength,
      compression: config.length.compression,
      headSize: config.arrowhead.size,
      headAngle: config.arrowhead.angleRadians,
      shaftWidth: 2.4,
      colorMode: config.color.mode,
      palette: config.color.palette,
      fixedColor: config.color.fixedColor,
      saturation: config.color.saturation,
      contrast: config.color.contrast,
      opacity: 1,
      rangeMode: config.color.rangeMode,
      rangeMinimum: config.color.minimum,
      rangeMaximum: config.color.maximum,
    };
  }

  afterDisable() {
    if (this.flowRefreshTimer !== undefined)
      clearTimeout(this.flowRefreshTimer);
    if (this.environmentTimer !== undefined)
      clearTimeout(this.environmentTimer);
    if (this.panelSizeTimer !== undefined) clearTimeout(this.panelSizeTimer);
    if (this.dispatcherID !== undefined)
      this.cc.dispatcher.unregister(this.dispatcherID);
    this.dispatcherID = undefined;
    this.detachPanelElement();
    this.arrowOverlay.stop();
    this.flowOverlay.stop();
    this.fluid.dispose();
    this.dsm.pillboxMenus?.removePillboxButton("dsm-vector-tools-menu");
  }

  afterConfigChange() {
    if (this.flowOverlay.isRunning) {
      this.flowOverlay.setOptions(this.flowOptions);
      // Options are colours, counts and speeds — everything the running
      // simulation can be told without rebuilding it. The *field* is compiled
      // GLSL, and it only changes when `startFlow` runs again.
      //
      // Every path that edits the components through `updateConfig` therefore
      // has to ask for that, and forgetting to was a real bug: loading a
      // gallery preset repainted the flow in the new palette while it went on
      // simulating the old field. `setSlot` had its own call and was the only
      // reason typing into P and Q ever worked. Comparing the source here
      // covers every path at once, and compares rather than always refreshing
      // because `startFlow` throws the particles away — a colour tweak must
      // not restart the simulation.
      if (this.flowFieldSignature !== this.lastFlowSignature)
        this.refreshFlow();
    }
    // Written settings only reach `this.settings` by the time this runs, so
    // this is where the arrows can read what they have to follow. Every path
    // that changes the field arrives here, `resetConfig` included — which is
    // also why the clock is synced here rather than at each call site that
    // might have made the field start or stop reading `t`.
    this.refreshArrows();
    this.syncClock();
    this.syncContrast();
    this.syncLayer();
    this.fluid.sync();
    this.util.tick();
  }

  // ---- the Fluid tab -------------------------------------------------------

  /**
   * Changes one fluid setting. Anything that changes what the lattice is,
   * such as its tank, its size, or which fluid it holds, also restarts the
   * clock, because a simulation cannot carry its state across a different
   * lattice.
   */
  setFluid<K extends keyof FluidConfig>(key: K, value: FluidConfig[K]) {
    this.updateConfig((config) => {
      config.fluid[key] = value;
    });
    if (key === "mode" || key === "cellsAcross" || key === "tank") {
      this.fluid.restart();
    }
  }

  /**
   * Moves the tank onto the visible graph paper and restarts. The tank is
   * fixed in graph coordinates so that panning does not disturb the flow
   * (brief §8.0); this is the deliberate way to move it.
   */
  fitFluidTankToView() {
    const math = this.calc.graphpaperBounds.mathCoordinates;
    const tank = {
      xMin: round(math.left),
      xMax: round(math.right),
      yMin: round(math.bottom),
      yMax: round(math.top),
    };
    if (
      !Object.values(tank).every(Number.isFinite) ||
      tank.xMax <= tank.xMin ||
      tank.yMax <= tank.yMin
    ) {
      this.lastActionMessage = "Could not read the current graph bounds.";
      this.util.tick();
      return;
    }
    this.setFluid("tank", tank);
  }

  /**
   * Whether one of this plugin's math inputs currently holds focus.
   *
   * Takes the focus kind rather than a component slot, because the curve's two
   * inputs are focus locations too and are not slots of the field.
   */
  isFocused(id: VectorToolsFocusKind) {
    const focused = this.cc.getFocusLocation();
    return (
      focused?.type === "dsm-focus" &&
      focused.plugin === "vector-tools" &&
      focused.kind === id
    );
  }

  /** Every saved field, and which one the panel is editing. */
  getLibrary(): VectorFieldLibrary {
    const serialized = this.settings.serializedFieldConfig;
    if (this.configCache?.serialized === serialized) {
      return this.configCache.library;
    }
    let library: VectorFieldLibrary;
    try {
      library = normalizeVectorFieldLibrary(JSON.parse(serialized));
    } catch {
      library = cloneDefaultLibrary();
    }
    this.configCache = { serialized, library };
    return library;
  }

  /**
   * The field being edited and drawn.
   *
   * Kept as `getConfig` so that every caller that only cares about the current
   * field — which is nearly all of them — reads exactly as it did before there
   * was more than one.
   */
  getConfig(): VectorFieldConfig {
    return activeField(this.getLibrary());
  }

  updateLibrary(update: (library: VectorFieldLibrary) => void) {
    // Copy first: `getLibrary` hands back a cached object shared with the panel.
    // `structuredClone` rather than a JSON round trip, because this runs on
    // every pointermove of every slider and the round trip was serialising the
    // whole configuration twice — once out, once back — to copy it.
    const next = structuredClone(this.getLibrary());
    update(next);
    this.saveLibrary(normalizeVectorFieldLibrary(next));
  }

  updateConfig(update: (config: VectorFieldConfig) => void) {
    this.updateLibrary((library) => {
      update(activeField(library));
    });
  }

  resetConfig() {
    const restored = cloneDefaultConfig();
    this.updateLibrary((library) => {
      const current = activeField(library);
      // The field is replaced, its identity is not. Its id and symbol token
      // address expressions already written into the user's graph, and its name
      // is how they find it in the chooser — handing all three back to the
      // defaults would orphan the expressions and rename the wrong row.
      Object.assign(library.fields[library.fields.indexOf(current)], restored, {
        id: current.id,
        name: current.name,
        symbolToken: current.symbolToken,
      });
    });
    this.lastActionMessage = "Restored the default rotational field settings.";
  }

  // ---- the library -------------------------------------------------------

  setActiveField(id: string) {
    if (this.getLibrary().fields.every((field) => field.id !== id)) return;
    this.updateLibrary((library) => {
      library.activeId = id;
    });
    // The overlay is drawing the field that was active a moment ago.
    this.refreshArrows();
    this.refreshFlow();
  }

  /**
   * A new field, made active.
   *
   * Seeded from the defaults rather than from the current field: "new" that
   * silently copies what is on screen is indistinguishable from "duplicate",
   * and there is a separate button for that.
   */
  addField() {
    const library = this.getLibrary();
    if (library.fields.length >= MAX_FIELDS) {
      this.lastActionMessage = `A library holds at most ${MAX_FIELDS} fields.`;
      return;
    }
    this.createField(cloneDefaultConfig(), "Vector Field");
  }

  /**
   * Keeps a copy of the field as it is now, and stays on the one being edited.
   *
   * Everything here is saved as it is changed, so this is not that kind of
   * save — it is a checkpoint. Load a gallery field, tune it, press Save, and
   * carry on tuning knowing the version you liked is in the chooser.
   *
   * Which is what separates it from Duplicate: that one moves you onto the
   * copy, so it is for starting a variation. This one leaves you where you
   * are, so it is for not losing where you have got to.
   */
  saveField() {
    const library = this.getLibrary();
    if (library.fields.length >= MAX_FIELDS) {
      this.lastActionMessage = `A library holds at most ${MAX_FIELDS} fields.`;
      return;
    }
    const current = this.getConfig();
    let saved = current.name;
    this.updateLibrary((next) => {
      const token = nextSymbolToken(next);
      if (token === undefined) return;
      saved = uniqueFieldName(next, current.name);
      next.fields.push({
        ...structuredClone(current),
        id: nextFieldID(next),
        name: saved,
        symbolToken: token,
      });
      // `activeId` is deliberately untouched: a checkpoint you are thrown out
      // of is a checkpoint that interrupts what you were doing.
    });
    this.lastActionMessage = `Saved as ${saved}.`;
  }

  duplicateField() {
    const library = this.getLibrary();
    if (library.fields.length >= MAX_FIELDS) {
      this.lastActionMessage = `A library holds at most ${MAX_FIELDS} fields.`;
      return;
    }
    const current = this.getConfig();
    this.createField(structuredClone(current), `${current.name} copy`);
  }

  private createField(seed: VectorFieldConfig, name: string) {
    this.updateLibrary((library) => {
      const token = nextSymbolToken(library);
      if (token === undefined) return;
      const field: VectorFieldConfig = {
        ...seed,
        id: nextFieldID(library),
        name: uniqueFieldName(library, name),
        symbolToken: token,
      };
      library.fields.push(field);
      library.activeId = field.id;
    });
    this.refreshArrows();
    this.refreshFlow();
  }

  /**
   * Forgets a field, and takes its generated expressions with it.
   *
   * Removing the expressions is the whole reason this is not just a splice:
   * a field the user cannot see any more is one they cannot press Remove on,
   * so the arrows it wrote into the graph would be stranded there with nothing
   * left that knows how to find them.
   */
  deleteField(id: string) {
    const library = this.getLibrary();
    if (library.fields.length <= 1) {
      this.lastActionMessage = "A library keeps at least one field.";
      return;
    }
    const doomed = library.fields.find((field) => field.id === id);
    if (doomed === undefined) return;
    this.removeGeneratedFor(doomed);
    this.updateLibrary((next) => {
      const index = next.fields.findIndex((field) => field.id === id);
      if (index < 0) return;
      next.fields.splice(index, 1);
      if (next.activeId === id) {
        next.activeId = next.fields[Math.min(index, next.fields.length - 1)].id;
      }
    });
    this.lastActionMessage = `Deleted ${doomed.name}.`;
    this.refreshArrows();
    this.refreshFlow();
  }

  get gallery() {
    return FIELD_GALLERY;
  }

  get galleryWithLook() {
    return this.getLibrary().galleryWithLook;
  }

  setGalleryWithLook(withLook: boolean) {
    this.updateLibrary((library) => {
      library.galleryWithLook = withLook;
    });
  }

  /**
   * Loads a gallery field into the one being edited.
   *
   * `withLook` is the toggle: with it, the preset brings its palette, its
   * particle settings and the frame it is meant to be seen in, which is most of
   * what makes it the picture it is. Without it only the formula and the name
   * change, so a preset can be used as a starting point inside a look that has
   * already been set up.
   *
   * It replaces the active field rather than adding one, which is what "load"
   * usually means — Duplicate is next to it for keeping what is there.
   */
  applyGalleryPreset(id: string, withLook: boolean) {
    const preset = galleryPreset(id);
    if (preset === undefined) return;
    this.updateConfig((config) => {
      const loaded = withLook
        ? configFromGallery(preset, config)
        : colorsFromGallery(preset, config);
      // The identity stays with the field: its id and token address
      // expressions already in the graph, and the chooser points at it.
      const { id: keepID, symbolToken } = config;
      Object.assign(config, loaded, { id: keepID, symbolToken });
    });
    this.lastActionMessage = `Loaded ${preset.name}.`;
    // These are flow pictures, so the flow is what has to be running for one
    // to be anything at all.
    if (withLook && !this.flowOverlay.isRunning) this.toggleFlow();
  }

  renameField(name: string) {
    this.updateConfig((config) => {
      config.name = name;
    });
  }

  /** The definitions the user types into for the current source. */
  get editableSlots() {
    return editableSlots(this.getConfig());
  }

  slotLatex(slot: ComponentSlot) {
    return slotBody(this.getConfig(), slot);
  }

  setSlot(slot: ComponentSlot, latex: string) {
    const config = this.getConfig();
    if (slotBody(config, slot) === latex) return;
    this.updateConfig((next) => {
      setSlotBody(next, slot, latex);
    });
    // Keep the expression-list copy in step, so the arrows already on the graph
    // follow the panel without a full regeneration.
    this.writeComponentExpression(slot);
    // In gradient mode P and Q are derived from f, so they have to be rewritten
    // too or the graph keeps the old gradient.
    if (slot === "f") {
      this.writeComponentExpression("p");
      this.writeComponentExpression("q");
    }
    this.refreshFlow();
  }

  setSource(source: FieldSource) {
    if (this.getConfig().source === source) return;
    this.updateConfig((config) => {
      config.source = source;
    });
    // The definitions in the list belong to the old source; rewrite whichever
    // of them still exist so the graph matches the panel.
    for (const slot of ["p", "q"] as const) this.writeComponentExpression(slot);
    this.componentLinkNote = "";
    this.refreshFlow();
  }

  // ---- components in the expression list ---------------------------------

  get hasComponentExpressions() {
    const config = this.getConfig();
    return editableSlots(config).every(
      (slot) =>
        this.cc.getItemModel(componentExpressionID(config, slot))?.type ===
        "expression"
    );
  }

  get componentLinkStatus() {
    if (this.componentLinkNote !== "") return this.componentLinkNote;
    const gradient = this.getConfig().source === "gradient";
    const subject = gradient ? "f is" : "P and Q are";
    const object = gradient ? "f" : "P and Q";
    return this.hasComponentExpressions
      ? `${subject} live in the expression list — edit in either place.`
      : `Put ${object} in the expression list to edit with the full math editor.`;
  }

  /**
   * Write the editable definitions into the expression list (creating the
   * field's folder if needed) and scroll to them.
   */
  addComponentExpressions() {
    const config = this.getConfig();
    const slots = editableSlots(config);
    try {
      if (!this.hasComponentExpressions) {
        const plan = createVectorFieldPlan(config, this.generationOptions);
        const componentIDs = new Set(
          slots.map((slot) => componentExpressionID(config, slot))
        );
        const existing = new Set(
          this.expressions
            .getGeneratedItems(plan.namespace)
            .map((item) => item.id)
        );
        // Only the folder and the editable definitions: pressing this must not
        // conjure a whole field the user did not ask to generate.
        const wanted = plan.expressions.filter(
          (expression) =>
            componentIDs.has(expression.id) || existing.has(expression.id)
        );
        this.expressions.applyGeneratedSet(
          plan.namespace,
          plan.folder,
          wanted,
          {
            knownIDs: allGeneratedIDs(config),
          }
        );
      }
      this.componentLinkNote = "";
      this.scrollToComponent(slots[0]);
    } catch (error) {
      this.componentLinkNote = `Could not add the definitions: ${
        error instanceof Error ? error.message : "unknown error"
      }`;
    }
    this.util.tick();
  }

  private scrollToComponent(slot: ComponentSlot) {
    const id = componentExpressionID(this.getConfig(), slot);
    if (this.cc.getItemModel(id)?.type !== "expression") return;
    this.cc.dispatch({ type: "set-selected-id", id });
  }

  private writeComponentExpression(slot: ComponentSlot) {
    const config = this.getConfig();
    const id = componentExpressionID(config, slot);
    if (this.cc.getItemModel(id)?.type !== "expression") return;
    // setExpression merges into an existing expression, so folderId and
    // colorLatex on the rest of the field are untouched.
    this.calc.setExpression({
      id,
      latex: componentFunctionLatex(config, slot, this.fieldAnimatesTime),
    });
  }

  /**
   * Adopt component edits made directly in the expression list. Runs on every
   * latex change in the graph, so it exits early unless something differs.
   */
  private syncComponentsFromExpressions() {
    const config = this.getConfig();
    let changed = false;
    let detached = false;
    const adopted = new Map<ComponentSlot, string>();
    // Only the editable slots are read back. In gradient mode P and Q are
    // derived from f, so adopting an edit there would overwrite the derivative
    // the generator owns with whatever it had been changed into.
    for (const slot of editableSlots(config)) {
      const id = componentExpressionID(config, slot);
      const model = this.cc.getItemModel(id);
      if (model?.type !== "expression") continue;
      const body = parseComponentFromLatex(
        config,
        slot,
        model.latex,
        this.fieldAnimatesTime
      );
      if (body === undefined) {
        detached = true;
        continue;
      }
      if (slotBody(config, slot) !== body) {
        adopted.set(slot, body);
        changed = true;
      }
    }
    const note = detached
      ? "One definition no longer matches this field's function name, so it is not being read."
      : "";
    if (note !== this.componentLinkNote) {
      this.componentLinkNote = note;
      this.util.tick();
    }
    if (!changed) return;
    this.updateConfig((target) => {
      for (const [slot, body] of adopted) setSlotBody(target, slot, body);
    });
    // An adopted f changes the gradient, so the derived definitions on the
    // graph have to follow it.
    if (adopted.has("f")) {
      this.writeComponentExpression("p");
      this.writeComponentExpression("q");
    }
    this.refreshFlow();
  }

  // ---- panel chrome ------------------------------------------------------

  setPanelTab(tab: PanelTab) {
    this.updateLibrary((library) => {
      library.panel.tab = tab;
    });
  }

  attachPanelElement(element: HTMLElement) {
    this.detachPanelElement();
    this.panelElement = element;
    // Pillbox popovers are a fixed 290px wide. Tag ours so it can size to the
    // panel instead of clipping it.
    element.closest(".dsm-pillbox-popover")?.classList.add(POPOVER_CLASS);
    const { width, height } = this.getLibrary().panel;
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    // The panel is resized by dragging its corner, so the size has to be read
    // back off the element rather than set through a control.
    this.panelResizeObserver = new ResizeObserver(() =>
      this.persistPanelSize()
    );
    this.panelResizeObserver.observe(element);
  }

  detachPanelElement() {
    this.panelResizeObserver?.disconnect();
    this.panelResizeObserver = undefined;
    this.panelElement
      ?.closest(`.${POPOVER_CLASS}`)
      ?.classList.remove(POPOVER_CLASS);
    this.panelElement = undefined;
  }

  private persistPanelSize() {
    if (this.panelSizeTimer !== undefined) clearTimeout(this.panelSizeTimer);
    this.panelSizeTimer = setTimeout(() => {
      this.panelSizeTimer = undefined;
      const element = this.panelElement;
      if (element === undefined) return;
      // Read the inline style, not the rendered box. A corner drag writes the
      // inline width/height, whereas a small window merely clamps the rendered
      // size through max-height — and remembering the clamp would shrink the
      // panel permanently.
      const width = Math.round(Number.parseFloat(element.style.width));
      const height = Math.round(Number.parseFloat(element.style.height));
      if (!Number.isFinite(width) || !Number.isFinite(height)) return;
      const { panel } = this.getLibrary();
      if (width === panel.width && height === panel.height) return;
      if (width === 0 || height === 0) return;
      this.updateLibrary((library) => {
        library.panel.width = width;
        library.panel.height = height;
      });
    }, PANEL_SIZE_SAVE_DELAY_MS);
  }

  setAxis(
    axisName: "x" | "y",
    key: keyof SamplingAxisConfig,
    value: number | SamplingMode
  ) {
    this.updateConfig((config) => {
      const axis = config.domain[axisName];
      if (key === "mode") axis.mode = value as SamplingMode;
      else axis[key] = value as never;
    });
  }

  /**
   * Fills the sampling domain from the visible graph paper, so "sample what I
   * am looking at" is one press instead of four numbers read off the axes.
   *
   * The sampling mode is left alone: in `step` mode the vector count follows
   * the new span, and the footer's estimate and warnings already cover that.
   */
  matchDomainToViewport() {
    const math = this.calc.graphpaperBounds.mathCoordinates;
    const x = { min: round(math.left), max: round(math.right) };
    const y = { min: round(math.bottom), max: round(math.top) };
    if (
      !Number.isFinite(x.min) ||
      !Number.isFinite(x.max) ||
      !Number.isFinite(y.min) ||
      !Number.isFinite(y.max) ||
      x.max <= x.min ||
      y.max <= y.min
    ) {
      this.lastActionMessage = "Could not read the current graph bounds.";
      this.util.tick();
      return;
    }
    this.lastActionMessage = `Sampling domain matched to the visible graph: x in [${x.min}, ${x.max}], y in [${y.min}, ${y.max}].`;
    // Saving the config re-renders the panel, so the message is set first.
    this.updateConfig((config) => {
      config.domain.x = { ...config.domain.x, ...x };
      config.domain.y = { ...config.domain.y, ...y };
    });
  }

  setLength(
    key: keyof VectorFieldConfig["length"],
    value: number | boolean | VectorLengthMode
  ) {
    this.updateConfig((config) => {
      config.length[key] = value as never;
    });
  }

  setArrowhead(key: "size" | "angleRadians", value: number) {
    this.updateConfig((config) => {
      config.arrowhead[key] = value;
    });
  }

  setColor(
    key: keyof VectorFieldConfig["color"],
    value: number | string | VectorColorMode | ColorPalette | ColorRangeMode
  ) {
    this.updateConfig((config) => {
      config.color[key] = value as never;
    });
  }

  /** One setter for the curve, which is a plain record of its own. */
  setCurve<K extends keyof CurveConfig>(key: K, value: CurveConfig[K]) {
    this.updateConfig((config) => {
      config.curve[key] = value;
    });
    this.syncClock();
  }

  setZeroVectorMode(mode: ZeroVectorMode) {
    this.updateConfig((config) => {
      config.zeroVectorMode = mode;
    });
  }

  get flowLook() {
    return this.getConfig().flow.look;
  }

  /**
   * Applies a look, which is only ever a starting point: it writes the trail
   * and respawn settings that produce it, and both stay adjustable afterwards.
   */
  setFlowLook(look: FlowLook) {
    this.updateConfig((config) => {
      config.flow = { ...config.flow, ...FLOW_LOOK_PRESETS[look], look };
    });
  }

  setFlow<K extends keyof FlowConfig>(key: K, value: FlowConfig[K]) {
    this.updateConfig((config) => {
      config.flow[key] = value;
    });
  }

  /**
   * Whether the flow's colours are following the arrows'.
   *
   * A standing link, not a one-press copy. The first version of this was a
   * button that copied the arrow settings across and then hid itself, having
   * nothing left to do — which meant there was no way back: the flow's own
   * settings were gone and the control that would have restored them was the
   * one that had just disappeared. A toggle overrides instead of overwriting,
   * so turning it off puts back exactly what was there.
   *
   * The two stay separately settable underneath. Colouring arrows by magnitude
   * while the flow runs a quiet single hue is a legitimate picture, and taking
   * that away would impose a limit where an option belongs.
   *
   * The fixed swatch is outside all of this because there is only one of it:
   * both halves already read `color.fixedColor`.
   */
  get matchFlowColor() {
    return this.getConfig().color.matchFlow;
  }

  setMatchFlowColor(match: boolean) {
    this.updateConfig((config) => {
      config.color.matchFlow = match;
    });
  }

  /** What the flow is drawn with right now, match accounted for. */
  get flowColor() {
    return effectiveFlowColor(this.getConfig());
  }

  /** Whether Desmos is currently drawing the graph in reverse contrast. */
  get graphReversesContrast(): boolean {
    return this.cc.graphSettings?.config?.invertedColors ?? false;
  }

  get keepColorsInReverseContrast() {
    return this.getConfig().color.keepColorsInReverseContrast;
  }

  setKeepColorsInReverseContrast(keep: boolean) {
    this.updateConfig((config) => {
      config.color.keepColorsInReverseContrast = keep;
    });
    this.syncContrast();
  }

  /**
   * Tells both overlays whether to cancel the graph's inversion.
   *
   * Reverse contrast is `filter: invert(1)` on `.dcg-container`, which sits
   * above both canvases, so the field inverts with the rest of the page whether
   * or not that is wanted. Inverting the canvas a second time cancels it, which
   * is what leaves a dark graph carrying the field's real colours.
   */
  private syncContrast() {
    const counteract =
      this.graphReversesContrast && this.keepColorsInReverseContrast;
    this.arrowOverlay.setCounteractInvert(counteract);
    this.flowOverlay.setCounteractInvert(counteract);
  }

  get overlayLayer(): OverlayLayer {
    return this.getConfig().overlayLayer;
  }

  setOverlayLayer(layer: OverlayLayer) {
    this.updateConfig((config) => {
      config.overlayLayer = layer;
    });
  }

  /**
   * Tells both canvases which side of Desmos's graph to sit on.
   *
   * The flow first and the arrows second, every time, and not only when the
   * setting changed: the two overlays mount independently — starting the
   * visualizer, switching the arrows to live, a context coming back — and the
   * one that mounted last would otherwise decide which is drawn over the
   * other. Asking in this order each time is what keeps the arrows on top.
   */
  private syncLayer() {
    const { overlayLayer } = this;
    this.flowOverlay.setLayer(overlayLayer);
    this.arrowOverlay.setLayer(overlayLayer);
  }

  // ---- divergence, curl, and whether there is a potential -----------------

  private analysisCache?: { key: string; result: FieldAnalysis };

  /**
   * The divergence and the curl of the field, exactly, and whether it is
   * conservative.
   *
   * Differentiated by the shared differentiator from Desmos's own parse, so
   * `∂P/∂x + ∂Q/∂y` comes back as the formula rather than as a number at a
   * point. Whether the curl is zero is decided symbolically when the fold
   * reaches 0, and otherwise at a grid of points across the sampling domain,
   * which is said as such: a curl that simplifies to `2y − 2y` is not the
   * same claim as one that vanishes at 49 points checked.
   */
  get fieldAnalysis(): FieldAnalysis {
    const config = this.getConfig();
    const key = JSON.stringify([
      config.source,
      config.components,
      config.scalar,
      config.domain,
    ]);
    if (this.analysisCache?.key === key) return this.analysisCache.result;
    const result = this.analyse(config);
    this.analysisCache = { key, result };
    return result;
  }

  private analyse(config: VectorFieldConfig): FieldAnalysis {
    try {
      const cfg = buildConfigFromGlobals(Desmos, this.calc);
      const tidy = (node: Node) => simplify(collectLikeTerms(simplify(node)));
      const [P, Q] =
        config.source === "gradient"
          ? (() => {
              const f = parseLatex(cfg, config.scalar.fLatex);
              return [differentiate(f, "x"), differentiate(f, "y")];
            })()
          : [
              parseLatex(cfg, config.components.xLatex),
              parseLatex(cfg, config.components.yLatex),
            ];
      const divergence = tidy(
        add(differentiate(P, "x"), differentiate(Q, "y"))
      );
      const curl = tidy(subtract(differentiate(Q, "x"), differentiate(P, "y")));
      let conservative:
        | "gradient"
        | "exactly"
        | "numerically"
        | "no"
        | "unknown";
      if (config.source === "gradient") conservative = "gradient";
      else if (constantValue(curl) === 0) conservative = "exactly";
      else {
        // A grid over the sampling domain, off the axes where fields tend to
        // have their poles.
        const { x, y } = config.domain;
        let checked = 0;
        let nonzero = false;
        for (let i = 0; i < 7; i++)
          for (let j = 0; j < 7; j++) {
            const at = {
              x: x.min + ((i + 0.37) / 7) * (x.max - x.min),
              y: y.min + ((j + 0.61) / 7) * (y.max - y.min),
            };
            const value = evaluate(curl, at);
            if (!Number.isFinite(value)) continue;
            const scale = Math.max(
              1,
              Math.abs(evaluate(P, at)),
              Math.abs(evaluate(Q, at))
            );
            checked++;
            if (Math.abs(value) > 1e-9 * scale) nonzero = true;
          }
        conservative =
          checked < 10 ? "unknown" : nonzero ? "no" : "numerically";
      }
      return {
        ok: true,
        divergenceLatex: toLatex(cfg, divergence),
        curlLatex: toLatex(cfg, curl),
        conservative,
      };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "This field could not be differentiated.",
      };
    }
  }

  // ---- symbolic differentiation ------------------------------------------

  /**
   * The simplified symbolic partial derivative of an expression, as LaTeX.
   *
   * Desmos evaluates `\frac{d}{dx}f(x,y)` exactly but never shows a simplified
   * form, so this is what turns `2xy` into a readable `2y` rather than a number
   * at a point. Parsing uses Desmos's own parser, so anything Desmos accepts is
   * understood; anything the differentiator cannot do exactly is refused with a
   * reason instead of guessed at.
   */
  partialDerivative(
    latex: string,
    variable: string
  ): { ok: true; latex: string } | { ok: false; error: string } {
    try {
      const cfg = buildConfigFromGlobals(Desmos, this.calc);
      const derivative = differentiate(parseLatex(cfg, latex), variable);
      return { ok: true, latex: toLatex(cfg, derivative) };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "This expression could not be differentiated.",
      };
    }
  }

  /**
   * The gradient of an expression, as the list of partials in the order the
   * variables appear. The caller decides how to present it; two variables make
   * an ordinary Desmos point.
   */
  gradient(
    latex: string,
    variables?: readonly string[]
  ):
    | { ok: true; variables: string[]; latex: string[] }
    | { ok: false; error: string } {
    try {
      const cfg = buildConfigFromGlobals(Desmos, this.calc);
      const tree = parseLatex(cfg, latex);
      // With no argument list given, the gradient adapts to whatever variables
      // the expression actually uses.
      const names = [...(variables ?? identifiersIn(tree))];
      if (names.length === 0) {
        return { ok: false, error: "This expression has no variables." };
      }
      return {
        ok: true,
        variables: names,
        latex: names.map((name) => toLatex(cfg, differentiate(tree, name))),
      };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "This expression could not be differentiated.",
      };
    }
  }

  // ---- flow visualizer ---------------------------------------------------

  get isFlowRunning() {
    return this.flowOverlay.isRunning;
  }

  get flowStatus() {
    if (this.flowMessage !== "") return this.flowMessage;
    return this.flowOverlay.isRunning
      ? "Streaming the field over the graph paper."
      : "Animate the field as flowing particles, drawn over the graph.";
  }

  /**
   * The compiled shader field, or the reason the current components cannot be
   * put on the GPU. The panel uses this to disable the button with a specific
   * explanation instead of failing on click.
   */
  /**
   * Whether the visualizer can run here at all, checked before the field is.
   *
   * The overlay maps math coordinates linearly onto the graph paper's rect,
   * which is only true of the 2D graph paper. On the 3D product
   * `graphpaperBounds.mathCoordinates` is a rotatable x/y/z box with no
   * screen-space meaning, so a flat overlay cannot stay registered with what is
   * underneath it — and it is painted over by the 3D canvas anyway. Geometry is
   * the same 2D graph paper and works unchanged.
   */
  get flowAvailability(): FlowCompilation {
    if (this.cc.is3dProduct()) {
      return {
        ok: false,
        error:
          "The flow visualizer draws on the 2D graph paper, so it is unavailable in the 3D calculator. Generating the field still works.",
      };
    }
    return this.flowCompilation;
  }

  get flowCompilation(): FlowCompilation {
    const config = this.getConfig();
    // What identifies a compilation, compared field by field rather than
    // serialised into one string. The panel reads this several times per render
    // and a render happens per pointermove, so building a key here was itself
    // most of the work this cache exists to avoid — measured at eight hundred
    // serialisations across a hundred-frame drag.
    const cached = this.flowCompilationCache;
    if (
      cached !== undefined &&
      cached.source === config.source &&
      cached.xLatex === config.components.xLatex &&
      cached.yLatex === config.components.yLatex &&
      cached.fLatex === config.scalar.fLatex &&
      // The same component compiles to different GLSL against a different set
      // of definitions, so the environment is part of what this identifies.
      cached.revision === this.environmentRevision
    ) {
      return cached.result;
    }
    const result = compileFlowField(config, this.environment);
    this.flowCompilationCache = {
      source: config.source,
      xLatex: config.components.xLatex,
      yLatex: config.components.yLatex,
      fLatex: config.scalar.fLatex,
      revision: this.environmentRevision,
      result,
    };
    return result;
  }

  toggleFlow() {
    if (this.flowOverlay.isRunning) {
      this.flowOverlay.stop();
      this.flowMessage = "";
      this.util.tick();
      return;
    }
    this.startFlow();
  }

  /**
   * Recompiles the running visualizer against the current components. Typing in
   * the math field fires this per keystroke, and each restart links a new
   * shader program and reseeds every particle, so it settles first.
   */
  refreshFlow() {
    if (!this.flowOverlay.isRunning) return;
    if (this.flowRefreshTimer !== undefined)
      clearTimeout(this.flowRefreshTimer);
    this.flowRefreshTimer = setTimeout(() => {
      this.flowRefreshTimer = undefined;
      if (this.flowOverlay.isRunning) this.startFlow();
    }, FLOW_REFRESH_DELAY_MS);
  }

  private startFlow() {
    const compiled = this.flowAvailability;
    if (!compiled.ok) {
      this.flowMessage = compiled.error;
      this.util.tick();
      return;
    }
    this.flowMessage = "";
    this.lastFlowSignature = this.flowFieldSignature;
    this.flowOverlay.start(compiled.field, this.flowOptions);
    // As in `refreshArrows`: a newly mounted canvas has to be told which side
    // of the graph it belongs on, and the order matters. See `syncLayer`.
    this.syncLayer();
    this.util.tick();
  }

  /**
   * What the compiled field is built from.
   *
   * Only the parts that reach the shader: a different palette or particle
   * count produces the same GLSL, and restarting the simulation for one would
   * throw away every particle on screen to change a colour.
   */
  private get flowFieldSignature() {
    const config = this.getConfig();
    // JSON rather than a delimiter, so no separator has to be chosen that
    // LaTeX could not contain.
    return JSON.stringify([
      config.source,
      config.components.xLatex,
      config.components.yLatex,
      config.scalar.fLatex,
    ]);
  }

  private get flowOptions() {
    const config = this.getConfig();
    // The match overrides here rather than in the stored config, which is what
    // lets turning it off restore what the flow was set to before.
    return {
      ...config.flow,
      // The toggle is resolved here rather than stored as a zero, so switching
      // it back on gives back the strength that was set.
      glow: config.flow.glowEnabled ? config.flow.glow : 0,
      backdrop: config.flow.backdropEnabled ? config.flow.backdropColor : "",
      ...effectiveFlowColor(config),
      fixedColor: config.color.fixedColor,
    };
  }

  get validation() {
    return validateVectorFieldConfig(this.getConfig());
  }

  get message() {
    return this.lastActionMessage;
  }

  get isTestLabVisible() {
    return isDevelopmentBuild();
  }

  get testPresets() {
    return VECTOR_FIELD_PRESETS;
  }

  get densityPresets() {
    return DENSITY_PRESETS;
  }

  get testConfig() {
    return configForPreset(
      this.selectedTestPreset,
      this.selectedDensityPreset,
      this.testLengthMode,
      this.testColorMode
    );
  }

  get selectedTestPreset() {
    return VECTOR_FIELD_PRESETS.find(
      (preset) => preset.id === this.testPresetID
    )!;
  }

  get selectedDensityPreset() {
    return DENSITY_PRESETS.find(
      (density) => density.id === this.testDensityID
    )!;
  }

  get currentTestLengthMode() {
    return this.testLengthMode;
  }

  get currentTestColorMode() {
    return this.testColorMode;
  }

  setTestPreset(id: VectorFieldPreset["id"]) {
    this.testPresetID = id;
    this.completedChecklist.clear();
    this.util.tick();
  }

  setTestDensity(id: DensityPreset["id"]) {
    this.testDensityID = id;
    this.completedChecklist.clear();
    this.util.tick();
  }

  setTestLengthMode(mode: VectorLengthMode) {
    this.testLengthMode = mode;
    this.completedChecklist.clear();
    this.util.tick();
  }

  setTestColorMode(mode: VectorColorMode) {
    this.testColorMode = mode;
    this.completedChecklist.clear();
    this.util.tick();
  }

  get checklist() {
    return TEST_CHECKLIST.map((item) => ({
      ...item,
      complete: this.completedChecklist.has(item.id),
    }));
  }

  toggleChecklist(id: TestChecklistID, complete: boolean) {
    if (complete) this.completedChecklist.add(id);
    else this.completedChecklist.delete(id);
    this.util.tick();
  }

  generateProduction(confirmed = false) {
    this.generate(this.getConfig(), "production", confirmed);
  }

  generateTestField(confirmed = false) {
    if (!this.isTestLabVisible) return;
    this.generate(this.testConfig, "test", confirmed);
  }

  confirmPendingGeneration() {
    if (this.pendingGeneration === "production") this.generateProduction(true);
    else if (this.pendingGeneration === "test") this.generateTestField(true);
  }

  cancelPendingGeneration() {
    this.pendingGeneration = undefined;
    this.lastActionMessage = "Generation cancelled.";
    this.util.tick();
  }

  get needsGenerationConfirmation() {
    return this.pendingGeneration !== undefined;
  }

  /** Every ID a plan owns: the folder and each expression in it. */
  private static planIDs(plan: VectorFieldPlan) {
    return [plan.folder.id, ...plan.expressions.map((e) => e.id)];
  }

  /**
   * Takes one field's generated expressions out of the graph.
   *
   * Written against a field rather than against the active one, because
   * deleting a field has to clear up after a field that is about to stop
   * existing — and the usual path reads whichever field is current.
   */
  private removeGeneratedFor(field: VectorFieldConfig) {
    const plan = createVectorFieldPlan(field, this.generationOptions);
    this.expressions.removeGeneratedSet(
      plan.namespace,
      allGeneratedIDs(field),
      // Only if it is ours: a ticker the user set up for something else must
      // survive a field being deleted.
      this.ownsCurrentTicker()
    );
  }

  removeProductionField() {
    const plan = createVectorFieldPlan(
      this.getConfig(),
      this.generationOptions
    );
    const { strays } = this.expressions.removeGeneratedSet(
      plan.namespace,
      allGeneratedIDs(this.getConfig()),
      // Only if it is ours: a ticker the user set up for something else must
      // survive removing this field.
      this.ownsCurrentTicker()
    );
    this.pendingGeneration = undefined;
    this.lastActionMessage =
      strays === 0
        ? "Removed only this Vector Tools field."
        : `Removed this Vector Tools field. ${strays} item${
            strays === 1 ? "" : "s"
          } sharing its name were left alone, because they are not part of it.`;
    this.util.tick();
  }

  removeTestField() {
    if (!this.isTestLabVisible) return;
    const plan = createVectorFieldPlan(this.testConfig);
    this.expressions.removeGeneratedSet(
      plan.namespace,
      VectorTools.planIDs(plan)
    );
    this.pendingGeneration = undefined;
    this.lastActionMessage = "Removed the development test field.";
    this.util.tick();
  }

  get productionAudit(): ExpressionAudit {
    return this.audit(
      createVectorFieldPlan(this.getConfig(), this.generationOptions)
    );
  }

  get testAudit(): ExpressionAudit {
    return this.audit(createVectorFieldPlan(this.testConfig));
  }

  async copyDiagnostics() {
    if (!this.isTestLabVisible) return;
    const payload = {
      generatedAt: new Date().toISOString(),
      extensionVersion: VERSION,
      plugin: "vector-tools",
      testConfiguration: this.testConfig,
      testValidation: validateVectorFieldConfig(this.testConfig),
      audit: this.testAudit,
      manualChecklist: this.checklist,
      browser: navigator.userAgent,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      this.lastActionMessage = "Sanitized diagnostics copied to the clipboard.";
    } catch {
      this.lastActionMessage =
        "Could not copy diagnostics in this browser context.";
    }
    this.util.tick();
  }

  private generate(
    config: VectorFieldConfig,
    target: GenerationTarget,
    confirmed: boolean
  ) {
    const validation = validateVectorFieldConfig(config);
    if (!validation.canGenerate) {
      this.pendingGeneration = undefined;
      this.lastActionMessage = "Fix the validation errors before generating.";
      this.util.tick();
      return;
    }
    if (validation.requiresConfirmation && !confirmed) {
      this.pendingGeneration = target;
      this.lastActionMessage = `This will create ${validation.estimatedVectorCount.toLocaleString()} vectors. Confirm to continue.`;
      this.util.tick();
      return;
    }

    const plan = createVectorFieldPlan(config, this.generationOptions);
    try {
      this.applyPlan(plan);
      this.pendingGeneration = undefined;
      this.lastActionMessage = `Generated ${validation.estimatedVectorCount.toLocaleString()} vectors as ordinary Desmos expressions.`;
    } catch (error) {
      this.pendingGeneration = undefined;
      this.lastActionMessage = `Generation stopped safely: ${error instanceof Error ? error.message : "unknown error"}`;
    }
    this.util.tick();
  }

  private applyPlan(plan: VectorFieldPlan) {
    this.expressions.applyGeneratedSet(
      plan.namespace,
      plan.folder,
      plan.expressions,
      {
        ticker: this.tickerToWrite(plan),
        knownIDs: allGeneratedIDs(this.getConfig()),
      }
    );
  }

  /**
   * What to do with the graph's ticker when writing this plan.
   *
   * A ticker is graph-level, so it is the one part of a generated field that
   * can collide with something the user built. Taking one over silently would
   * stop whatever it was animating, so a foreign ticker is refused — and since
   * the whole write is one `setState`, refusing here means nothing is written
   * at all rather than a field landing next to a broken animation.
   *
   * A field that does not animate leaves the ticker alone rather than clearing
   * it, because not wanting one is not the same as wanting none.
   */
  private tickerToWrite(plan: VectorFieldPlan) {
    if (plan.ticker === undefined) {
      return this.ownsCurrentTicker() ? null : undefined;
    }
    const existing = this.expressions.getTicker();
    const inUse =
      existing?.handlerLatex !== undefined && existing.handlerLatex !== "";
    if (inUse && !this.ownsCurrentTicker()) {
      throw new Error(
        "this graph already has a ticker doing something else, and a field written in terms of t needs it. Remove that ticker, or rename t in the field."
      );
    }
    return plan.ticker;
  }

  private audit(plan: VectorFieldPlan) {
    const items: GeneratedItemSnapshot[] = this.expressions.getGeneratedItems(
      plan.namespace
    );
    return auditVectorFieldPlan(plan, items);
  }

  private saveLibrary(library: VectorFieldLibrary) {
    const serialized = JSON.stringify(library);
    // A drag delivers a pointermove per frame, and most of them land on the
    // value the setting already has — a slider that has run out of travel, or a
    // number that rounds to what it already was. Writing anyway meant a
    // settings round trip, a panel render and an arrow refresh for a change
    // that was not one.
    if (serialized === this.settings.serializedFieldConfig) return;
    this.dsm.setPluginSetting(
      "vector-tools",
      "serializedFieldConfig",
      serialized
    );
  }

  private ensureStoredConfigIsCurrent() {
    const normalized = this.getLibrary();
    const serialized = JSON.stringify(normalized);
    if (serialized !== this.settings.serializedFieldConfig) {
      this.dsm.setPluginSetting(
        "vector-tools",
        "serializedFieldConfig",
        serialized
      );
    }
  }
}
