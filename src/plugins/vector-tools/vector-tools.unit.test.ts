import { CalculatorExpressionAdapter } from "./desmos/ExpressionAdapter";
import {
  allGeneratedIDs,
  auditVectorFieldPlan,
  componentExpressionID,
  componentFunctionLatex,
  createVectorFieldPlan,
  editableSlots,
  namespaceForField,
  parseComponentFromLatex,
  setSlotBody,
  slotBody,
} from "./generator";
import { TEST_FOLDER_ID, TEST_LINE_ID, TEST_NAMESPACE } from "./ids";
import {
  cloneDefaultConfig,
  configForPreset,
  DENSITY_PRESETS,
  effectiveFlowColor,
  FLOW_PARTICLE_MAXIMUM,
  FLOW_RENDER_SCALE_MINIMUM,
  FLOW_PARTICLE_MINIMUM,
  isDevelopmentBuild,
  lengthInputsFor,
  LIVE_ARROW_MAXIMUM,
  normalizeVectorFieldConfig,
  normalizeVectorFieldLibrary,
  activeField,
  cloneDefaultLibrary,
  MAX_FIELDS,
  nextFieldID,
  nextSymbolToken,
  uniqueFieldName,
  VECTOR_FIELD_SCHEMA_VERSION,
  PANEL_MAX_WIDTH,
  PANEL_MIN_HEIGHT,
  thinArrowGrid,
  validateVectorFieldConfig,
  VECTOR_FIELD_PRESETS,
} from "./model";
import {
  COLOR_CONTRAST_MINIMUM,
  COLOR_SATURATION_MAXIMUM,
} from "../../field-rendering/palettes";
import type { Calc } from "#globals";

interface FakeItem {
  id: string;
  type: "expression" | "folder";
  latex?: string;
  color?: string;
  colorLatex?: string;
  hidden?: boolean;
  secret?: boolean;
  title?: string;
  collapsed?: boolean;
  folderId?: string;
}

/**
 * Mirrors the parts of Desmos that Vector Tools depends on: state round-trips
 * through `getState`/`setState`, and `getState` omits properties left at their
 * defaults, exactly as the real calculator does.
 */
class FakeCalculator {
  items: FakeItem[] = [];
  setStateCalls = 0;
  lastSetStateOptions: unknown;

  readonly calc = {
    getState: () => ({
      version: 9,
      graph: { viewport: { xmin: -10, xmax: 10, ymin: -6, ymax: 6 } },
      expressions: {
        list: this.items.map((item) => {
          const copy: FakeItem = { ...item };
          if (copy.hidden === false) delete copy.hidden;
          if (copy.secret === false) delete copy.secret;
          return copy;
        }),
      },
    }),
    setState: (
      state: { expressions: { list: FakeItem[] } },
      opts?: unknown
    ) => {
      this.setStateCalls++;
      this.lastSetStateOptions = opts;
      this.items = state.expressions.list.map((item) => ({ ...item }));
    },
    controller: {
      getItemModel: (id: string) => this.getItem(id),
      getAllItemModels: () => this.items,
      updateViews: () => undefined,
    },
  };

  getItem(id: string) {
    return this.items.find((item) => item.id === id);
  }
}

function makeAdapter() {
  const fakeCalculator = new FakeCalculator();
  return {
    fakeCalculator,
    adapter: new CalculatorExpressionAdapter(
      fakeCalculator.calc as unknown as Calc
    ),
  };
}

const TEST_FOLDER = { id: TEST_FOLDER_ID, title: "Vector Tools — Test" };

describe("Vector Tools expression adapter", () => {
  test("uses stable IDs and rewrites the generated set in place", () => {
    const { adapter, fakeCalculator } = makeAdapter();
    adapter.applyGeneratedSet(TEST_NAMESPACE, TEST_FOLDER, [
      {
        id: TEST_LINE_ID,
        latex: "y=x",
        color: "#6042a6",
        folderId: TEST_FOLDER_ID,
      },
    ]);
    adapter.applyGeneratedSet(TEST_NAMESPACE, TEST_FOLDER, [
      {
        id: TEST_LINE_ID,
        latex: "y=2x",
        color: "#6042a6",
        folderId: TEST_FOLDER_ID,
      },
    ]);

    expect(fakeCalculator.items).toEqual([
      { id: TEST_FOLDER_ID, type: "folder", title: "Vector Tools — Test" },
      {
        id: TEST_LINE_ID,
        type: "expression",
        latex: "y=2x",
        color: "#6042a6",
        hidden: false,
        folderId: TEST_FOLDER_ID,
      },
    ]);
    expect(adapter.expressionExists(TEST_LINE_ID)).toBe(true);
    expect(fakeCalculator.lastSetStateOptions).toEqual({ allowUndo: true });
  });

  test("keeps mapped colors, folder assignment, and the field's list position", () => {
    const { adapter, fakeCalculator } = makeAdapter();
    fakeCalculator.items = [
      { id: "before_line", type: "expression", latex: "y=1" },
      { id: "after_line", type: "expression", latex: "y=2" },
    ];
    adapter.applyGeneratedSet(TEST_NAMESPACE, TEST_FOLDER, [
      {
        id: TEST_LINE_ID,
        latex: "y=x",
        folderId: TEST_FOLDER_ID,
        colorLatex: "v_{tftc}",
      },
    ]);
    // Regenerating must not move the field to the end of the list.
    fakeCalculator.items.push({
      id: "trailing_line",
      type: "expression",
      latex: "y=3",
    });
    adapter.applyGeneratedSet(TEST_NAMESPACE, TEST_FOLDER, [
      {
        id: TEST_LINE_ID,
        latex: "y=x",
        folderId: TEST_FOLDER_ID,
        colorLatex: "v_{tftc}",
      },
    ]);

    expect(fakeCalculator.items.map((item) => item.id)).toEqual([
      "before_line",
      "after_line",
      TEST_FOLDER_ID,
      TEST_LINE_ID,
      "trailing_line",
    ]);
    expect(fakeCalculator.getItem(TEST_LINE_ID)).toMatchObject({
      colorLatex: "v_{tftc}",
      folderId: TEST_FOLDER_ID,
    });
    expect(adapter.getGeneratedItems(TEST_NAMESPACE)).toEqual([
      {
        id: TEST_FOLDER_ID,
        type: "folder",
        latex: undefined,
        hidden: undefined,
        secret: false,
        colorLatex: undefined,
        folderId: undefined,
      },
      {
        id: TEST_LINE_ID,
        type: "expression",
        latex: "y=x",
        hidden: false,
        secret: false,
        colorLatex: "v_{tftc}",
        folderId: TEST_FOLDER_ID,
      },
    ]);
  });

  test("removes only items in the requested generated namespace", () => {
    const { adapter, fakeCalculator } = makeAdapter();
    adapter.applyGeneratedSet(TEST_NAMESPACE, TEST_FOLDER, [
      { id: TEST_LINE_ID, latex: "y=x", folderId: TEST_FOLDER_ID },
    ]);
    fakeCalculator.items.push({
      id: "unrelated_line",
      type: "expression",
      latex: "y=x^2",
    });

    adapter.removeGeneratedSet(TEST_NAMESPACE, [TEST_FOLDER_ID, TEST_LINE_ID]);

    expect(fakeCalculator.items).toEqual([
      { id: "unrelated_line", type: "expression", latex: "y=x^2" },
    ]);
  });

  test("will not delete a stray item that merely shares the namespace", () => {
    // The namespace is a prefix, not a claim of ownership. An expression the
    // user happens to name `<namespace>_scratch` matched it and was being
    // deleted by both generation and removal — silently, and in the case of
    // generation while a comment two functions away promised it would be
    // reported instead.
    const { adapter, fakeCalculator } = makeAdapter();
    adapter.applyGeneratedSet(TEST_NAMESPACE, TEST_FOLDER, [
      { id: TEST_LINE_ID, latex: "y=x", folderId: TEST_FOLDER_ID },
    ]);
    const stray = {
      id: `${TEST_NAMESPACE}_scratch`,
      type: "expression" as const,
      latex: "y=99",
    };
    fakeCalculator.items.push({ ...stray });

    // Regenerating over it is refused, and refused before anything is written.
    const before = fakeCalculator.setStateCalls;
    expect(() =>
      adapter.applyGeneratedSet(TEST_NAMESPACE, TEST_FOLDER, [
        { id: TEST_LINE_ID, latex: "y=2x", folderId: TEST_FOLDER_ID },
      ])
    ).toThrow("shares its namespace");
    expect(fakeCalculator.setStateCalls).toBe(before);
    expect(fakeCalculator.getItem(stray.id)).toEqual(stray);

    // Removing the field leaves it behind, and says so.
    const { strays } = adapter.removeGeneratedSet(TEST_NAMESPACE, [
      TEST_FOLDER_ID,
      TEST_LINE_ID,
    ]);
    expect(strays).toBe(1);
    expect(fakeCalculator.items).toEqual([stray]);
  });

  test("rejects malformed generated specs before touching calculator state", () => {
    const { adapter, fakeCalculator } = makeAdapter();
    const apply = (
      namespace: string,
      folder: { id: string; title: string },
      expressions: Parameters<typeof adapter.applyGeneratedSet>[2]
    ) => adapter.applyGeneratedSet(namespace, folder, expressions);

    expect(() =>
      apply(TEST_NAMESPACE, { id: "vector-tools", title: "T" }, [])
    ).toThrow("valid Desmos identifier");
    expect(() =>
      apply(TEST_NAMESPACE, TEST_FOLDER, [{ id: TEST_LINE_ID, latex: "   " }])
    ).toThrow("LaTeX must not be empty");
    expect(() =>
      apply(TEST_NAMESPACE, TEST_FOLDER, [
        { id: TEST_LINE_ID, latex: "y=x", color: "purple" },
      ])
    ).toThrow("hex color");
    expect(() =>
      apply(TEST_NAMESPACE, TEST_FOLDER, [{ id: "escaped_id", latex: "y=x" }])
    ).toThrow("outside the vector_tools_test namespace");
    expect(fakeCalculator.setStateCalls).toBe(0);
  });

  test("refuses to overwrite a foreign item that shares the namespace prefix", () => {
    const { adapter, fakeCalculator } = makeAdapter();
    fakeCalculator.items = [
      { id: TEST_LINE_ID, type: "folder", title: "Mine" },
    ];

    expect(() =>
      adapter.applyGeneratedSet(TEST_NAMESPACE, TEST_FOLDER, [
        { id: TEST_LINE_ID, latex: "y=x", folderId: TEST_FOLDER_ID },
      ])
    ).toThrow("already used by a folder");
    expect(fakeCalculator.setStateCalls).toBe(0);
  });
});

describe("Vector Tools field configuration", () => {
  test("normalizes persisted data to the current serializable schema", () => {
    const config = normalizeVectorFieldConfig({
      schemaVersion: 0,
      id: "saved_field",
      name: "Saved field",
      components: { xLatex: "", yLatex: "x+y" },
      domain: { x: { min: -2, max: 2, mode: "count", count: 5 }, y: {} },
      color: { fixedColor: "not-a-color" },
    });

    expect(config).toMatchObject({
      schemaVersion: VECTOR_FIELD_SCHEMA_VERSION,
      id: "saved_field",
      name: "Saved field",
      components: { xLatex: "", yLatex: "x+y" },
      domain: { x: { mode: "count", count: 5 }, y: { min: -6, max: 6 } },
      color: { fixedColor: "not-a-color" },
      // Schema 2 and earlier had no source. Those are all component fields,
      // and reading one as a gradient would silently replace the user's field.
      source: "components",
    });
    expect(config.scalar.fLatex).toBe(cloneDefaultConfig().scalar.fLatex);
  });

  test("keeps a saved gradient field a gradient field", () => {
    const config = normalizeVectorFieldConfig({
      schemaVersion: 3,
      source: "gradient",
      scalar: { fLatex: "\\sin(x)+y^{2}" },
    });
    expect(config.source).toBe("gradient");
    expect(config.scalar.fLatex).toBe("\\sin(x)+y^{2}");

    // Anything else in `source` is not a field the plugin knows how to build.
    expect(normalizeVectorFieldConfig({ source: "curl" }).source).toBe(
      "components"
    );
  });

  test("fills in and clamps flow settings saved by an older schema", () => {
    const upgraded = normalizeVectorFieldConfig({
      schemaVersion: 1,
      components: { xLatex: "-y", yLatex: "x" },
    });
    expect(upgraded.flow).toEqual(cloneDefaultConfig().flow);

    // Schema 2 stored a texture edge length instead of a particle count.
    expect(
      normalizeVectorFieldConfig({ flow: { particleResolution: 192 } }).flow
        .particleCount
    ).toBe(192 * 192);

    const clamped = normalizeVectorFieldConfig({
      flow: {
        particleCount: 1e9,
        speed: 1e9,
        trailPersistence: 5,
        dropRate: -1,
        opacity: 0,
        pointSize: 100,
        colorMode: "nonsense",
        normalizeSpeed: "yes",
        renderScale: 0,
        saturation: 9,
        contrast: -4,
      },
    });
    expect(clamped.flow).toEqual({
      particleCount: FLOW_PARTICLE_MAXIMUM,
      speed: 8,
      trailPersistence: 0.995,
      dropRate: 0,
      opacity: 0.05,
      pointSize: 6,
      renderScale: FLOW_RENDER_SCALE_MINIMUM,
      colorMode: "speed",
      // Clamped like every other slider, so a hand-edited setting cannot ask
      // for a colour the shader would drive to a flat block.
      saturation: COLOR_SATURATION_MAXIMUM,
      contrast: COLOR_CONTRAST_MINIMUM,
      // Neither was in the saved object, so both fall back to the default.
      palette: "spectral",
      look: "streamlines",
      normalizeSpeed: true,
      // The visual extras, which a setting saved before them has none of.
      // Both are off-or-default rather than silently applied: the glow is on
      // because it only changes how a particle is drawn, and the backdrop is
      // off because it hides the graph paper behind it.
      glow: 0.45,
      glowEnabled: true,
      backdropEnabled: false,
      backdropColor: "#080b18",
      backdropOpacity: 0.92,
    });
    expect(
      normalizeVectorFieldConfig({ flow: { particleCount: 1 } }).flow
        .particleCount
    ).toBe(FLOW_PARTICLE_MINIMUM);
  });

  test("clamps persisted panel geometry and falls back to a known tab", () => {
    // Panel geometry belongs to the library rather than to a field: dragging
    // the corner is not a property of the maths, and switching fields must not
    // resize the window.
    expect(
      normalizeVectorFieldLibrary({
        panel: { width: 10_000, height: 4, tab: "nope" },
      }).panel
    ).toEqual({
      width: PANEL_MAX_WIDTH,
      height: PANEL_MIN_HEIGHT,
      tab: "field",
    });
    expect(
      normalizeVectorFieldLibrary({ panel: { width: 460, tab: "flow" } }).panel
    ).toMatchObject({ width: 460, tab: "flow" });
  });

  test("rejects incomplete fields and unsafe sampling while requiring a warning confirmation", () => {
    const invalid = cloneDefaultConfig();
    invalid.components.xLatex = "x+";
    invalid.domain.x.step = 0;
    invalid.color.rangeMode = "manual";
    invalid.color.minimum = 1;
    invalid.color.maximum = 1;
    const invalidValidation = validateVectorFieldConfig(invalid);
    expect(invalidValidation.canGenerate).toBe(false);
    expect(invalidValidation.issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("P(x,y) appears incomplete"),
        expect.stringContaining("x step"),
        expect.stringContaining("Manual color"),
      ])
    );

    const warning = cloneDefaultConfig();
    warning.domain.x = { ...warning.domain.x, mode: "count", count: 52 };
    warning.domain.y = { ...warning.domain.y, mode: "count", count: 50 };
    const warningValidation = validateVectorFieldConfig(warning);
    expect(warningValidation).toMatchObject({
      canGenerate: true,
      requiresConfirmation: true,
      estimatedVectorCount: 2600,
    });

    warning.domain.x.count = 201;
    warning.domain.y.count = 51;
    expect(validateVectorFieldConfig(warning).canGenerate).toBe(false);
  });

  test("keeps the developer lab out of a production build", () => {
    expect(isDevelopmentBuild(false)).toBe(false);
    expect(
      DENSITY_PRESETS.find((preset) => preset.id === "warning")
    ).toMatchObject({
      xCount: 52,
      yCount: 50,
    });
  });
});

describe("Vector Tools Desmos expression plans", () => {
  test("creates namespaced helper expressions and visible arrow geometry", () => {
    const config = cloneDefaultConfig();
    config.id = "orbit";
    config.name = "Orbit";
    const plan = createVectorFieldPlan(config);

    expect(plan.namespace).toBe(namespaceForField(config));
    expect(plan.folder.id).toBe("vector_tools_vf_orbit_folder");
    expect(
      new Set(plan.expressions.map((expression) => expression.id)).size
    ).toBe(plan.expressions.length);
    expect(
      plan.expressions.find((expression) => expression.purpose === "shafts")
    ).toMatchObject({ hidden: false, colorLatex: "v_{tfdc}" });
    expect(
      plan.expressions.find(
        (expression) => expression.purpose === "x component function"
      )?.latex
    ).toContain("v_{tfdp}");
    expect(
      plan.expressions.find((expression) => expression.purpose === "color list")
        ?.latex
    ).toContain("rgb");
  });

  test("derives P and Q from f for a gradient field", () => {
    const config = cloneDefaultConfig();
    config.source = "gradient";
    config.scalar.fLatex = "x^{2}+y^{2}";
    const plan = createVectorFieldPlan(config);
    const latexFor = (purpose: string) =>
      plan.expressions.find((expression) => expression.purpose === purpose)
        ?.latex;

    // The scalar is an ordinary expression in the folder, and the components
    // are Desmos's own partials of it — `\frac{d}{dx}` of a two-argument
    // function, which is the only spelling a real Desmos accepts.
    expect(latexFor("scalar function")).toBe(
      "v_{tfdf}\\left(x,y\\right)=\\left(x^{2}+y^{2}\\right)"
    );
    expect(latexFor("x component function")).toBe(
      "v_{tfdp}\\left(x,y\\right)=\\left(\\frac{d}{dx}v_{tfdf}\\left(x,y\\right)\\right)"
    );
    expect(latexFor("y component function")).toBe(
      "v_{tfdq}\\left(x,y\\right)=\\left(\\frac{d}{dy}v_{tfdf}\\left(x,y\\right)\\right)"
    );
    // Everything downstream is unchanged: the arrows do not know or care that
    // the components were derived.
    expect(latexFor("shafts")).toBe(
      createVectorFieldPlan(cloneDefaultConfig()).expressions.find(
        (expression) => expression.purpose === "shafts"
      )?.latex
    );
    expect(
      new Set(plan.expressions.map((expression) => expression.id)).size
    ).toBe(plan.expressions.length);
  });

  test("carries the scalar function only for a gradient field", () => {
    const components = createVectorFieldPlan(cloneDefaultConfig());
    const gradient = cloneDefaultConfig();
    gradient.source = "gradient";

    expect(
      components.expressions.some(
        (expression) => expression.purpose === "scalar function"
      )
    ).toBe(false);
    expect(createVectorFieldPlan(gradient).expressions).toHaveLength(
      components.expressions.length + 1
    );
  });

  test("mirrors only the slots the user types into", () => {
    const config = cloneDefaultConfig();
    expect(editableSlots(config)).toEqual(["p", "q"]);
    config.source = "gradient";
    // P and Q are derived, so adopting an edit to them would overwrite the
    // derivative the generator owns.
    expect(editableSlots(config)).toEqual(["f"]);

    expect(componentExpressionID(config, "f")).toBe(
      "vector_tools_vf_default_f_function"
    );
    expect(
      parseComponentFromLatex(config, "f", componentFunctionLatex(config, "f"))
    ).toBe(config.scalar.fLatex);

    setSlotBody(config, "f", "\\sin(xy)");
    expect(slotBody(config, "f")).toBe("\\sin(xy)");
    expect(config.scalar.fLatex).toBe("\\sin(xy)");
  });

  test.each([
    "actual",
    "normalized",
    "scaled",
    "clamped",
    "compressed",
    "direction-only",
  ] as const)("supports the %s arrow-length mode", (mode) => {
    const config = cloneDefaultConfig();
    config.length.mode = mode;
    const plan = createVectorFieldPlan(config);
    const display = plan.expressions.find(
      (expression) => expression.purpose === "displayed x components"
    );
    expect(display?.latex).toContain("v_{tfddu}");
  });

  test("round-trips components through their expression-list definitions", () => {
    const config = cloneDefaultConfig();
    expect(componentExpressionID(config, "p")).toBe(
      "vector_tools_vf_default_p_function"
    );
    expect(componentFunctionLatex(config, "p")).toBe(
      "v_{tfdp}\\left(x,y\\right)=\\left(-y\\right)"
    );
    expect(
      parseComponentFromLatex(config, "p", componentFunctionLatex(config, "p"))
    ).toBe("-y");
    // Bodies a person would type by hand, with and without wrapping.
    expect(
      parseComponentFromLatex(config, "q", "v_{tfdq}\\left(x,y\\right)=3x")
    ).toBe("3x");
    // Only a paired outer group is stripped, never two adjacent ones.
    expect(
      parseComponentFromLatex(
        config,
        "q",
        "v_{tfdq}\\left(x,y\\right)=\\left(x\\right)+\\left(y\\right)"
      )
    ).toBe("\\left(x\\right)+\\left(y\\right)");
    // A renamed or re-signatured definition is no longer this field's.
    expect(
      parseComponentFromLatex(config, "p", "g\\left(x,y\\right)=-y")
    ).toBeUndefined();
    expect(
      parseComponentFromLatex(config, "p", "v_{tfdp}\\left(t\\right)=-y")
    ).toBeUndefined();
    expect(parseComponentFromLatex(config, "p", undefined)).toBeUndefined();
  });

  test("audits missing and unexpected expressions without treating a manual probe as a pass", () => {
    const config = configForPreset(
      VECTOR_FIELD_PRESETS[0],
      DENSITY_PRESETS[0],
      "normalized",
      "magnitude"
    );
    const plan = createVectorFieldPlan(config);
    const current = [
      { id: plan.folder.id, type: "folder" as const },
      ...plan.expressions.slice(0, 2).map((expression) => ({
        id: expression.id,
        type: "expression" as const,
        latex: expression.latex,
        hidden: expression.hidden,
        folderId: plan.folder.id,
      })),
      { id: `${plan.namespace}_manual_probe`, type: "expression" as const },
    ];
    const audit = auditVectorFieldPlan(plan, current);

    expect(audit.missing).toHaveLength(plan.expressions.length - 2);
    expect(audit.unexpected).toEqual([`${plan.namespace}_manual_probe`]);
    expect(audit.renderMissing).toBe(true);
  });
});

describe("Vector Tools live arrow grid", () => {
  test("leaves a grid that is already readable alone", () => {
    expect(thinArrowGrid(21, 13)).toEqual({
      columns: 21,
      rows: 13,
      thinned: false,
      requested: 273,
    });
  });

  test("thins a domain matched to a zoomed-out viewport", () => {
    // 801 by 467 is what matching the domain to a view 800 units wide asks for
    // at a step of 1. Every one of those arrows lands inside a pixel, and what
    // you see is the moire between the two grids rather than the field.
    const thinned = thinArrowGrid(801, 467);
    expect(thinned.thinned).toBe(true);
    expect(thinned.requested).toBe(374067);
    expect(thinned.columns * thinned.rows).toBeLessThanOrEqual(
      LIVE_ARROW_MAXIMUM
    );
    // Scaled by one factor, so the arrows stay square to the grid rather than
    // stretching along whichever axis had more of them.
    const before = 801 / 467;
    const after = thinned.columns / thinned.rows;
    expect(Math.abs(after - before)).toBeLessThan(0.05);
  });

  test("never thins below a grid that can still show a direction", () => {
    expect(thinArrowGrid(100000, 2).rows).toBeGreaterThanOrEqual(2);
    expect(thinArrowGrid(2, 100000).columns).toBeGreaterThanOrEqual(2);
  });

  test("has nothing to say about an empty grid", () => {
    expect(thinArrowGrid(0, 0).thinned).toBe(false);
  });

  test("is a default rather than a rule", () => {
    // Live rendering is the half of this plugin with no limit. The density
    // limit is on so a domain matched to a zoomed-out viewport does not draw
    // hundreds of thousands of sub-pixel arrows by accident — not because
    // asking for them on purpose is wrong.
    expect(cloneDefaultConfig().arrowDensityLimit).toBe(true);
    expect(
      normalizeVectorFieldConfig({ arrowDensityLimit: false }).arrowDensityLimit
    ).toBe(false);
    // Anything unreadable falls back to the protective default.
    expect(
      normalizeVectorFieldConfig({ arrowDensityLimit: "no" }).arrowDensityLimit
    ).toBe(true);
  });
});

describe("Vector Tools colour range mode", () => {
  test("saturates by default rather than stretching between two ends", () => {
    // The default ramp is the flow's, so an arrow and the particles over it are
    // the same colour, and neither can be taken over by a pole.
    expect(cloneDefaultConfig().color.rangeMode).toBe("automatic");
  });

  test("keeps an explicit scale, and falls back to automatic otherwise", () => {
    expect(
      normalizeVectorFieldConfig({ color: { rangeMode: "manual" } }).color
        .rangeMode
    ).toBe("manual");
    // `visible` and `domain` named the two boxes the range used to be measured
    // over. Neither is measured now, so a graph saved under either reads as
    // automatic.
    for (const old of ["visible", "domain", "nonsense"]) {
      expect(
        normalizeVectorFieldConfig({ color: { rangeMode: old } }).color
          .rangeMode
      ).toBe("automatic");
    }
  });
});

describe("Vector Tools length inputs", () => {
  /**
   * The panel shows only the numbers the chosen mode reads, so this mapping is
   * what decides whether a control the field depends on is on screen. Both the
   * shader's `vtLengthFactor` and the generator's `factor` are the same five
   * cases; if either grows one, this has to grow with it.
   */
  test("names exactly the numbers each mode scales by", () => {
    expect(lengthInputsFor("actual")).toEqual({
      targetLength: false,
      scale: false,
      maximumLength: false,
      compression: false,
    });
    for (const mode of ["normalized", "direction-only"] as const) {
      expect(lengthInputsFor(mode).targetLength).toBe(true);
      expect(lengthInputsFor(mode).scale).toBe(false);
    }
    expect(lengthInputsFor("scaled")).toMatchObject({
      scale: true,
      maximumLength: false,
      compression: false,
    });
    expect(lengthInputsFor("clamped")).toMatchObject({
      scale: true,
      maximumLength: true,
      compression: false,
    });
    expect(lengthInputsFor("compressed")).toMatchObject({
      scale: true,
      maximumLength: false,
      compression: true,
    });
  });

  test("leaves no mode without a control except the one that needs none", () => {
    const modes = [
      "actual",
      "normalized",
      "scaled",
      "clamped",
      "compressed",
      "direction-only",
    ] as const;
    for (const mode of modes) {
      const shown = Object.values(lengthInputsFor(mode)).filter(Boolean).length;
      // Actual draws the field's own magnitude and reads nothing; every other
      // mode has at least one number, or its section would be empty.
      if (mode === "actual") expect(shown).toBe(0);
      else expect(shown).toBeGreaterThan(0);
    }
  });
});

describe("Vector Tools generated-ID vocabulary", () => {
  test("covers every ID any configuration can produce", () => {
    // `allGeneratedIDs` is how the adapter tells "mine, no longer wanted" from
    // "somebody else's". A suffix the generator emits but this list forgets
    // would be treated as a stray: it could not be removed, and regenerating
    // over it would be refused. So every plan the generator can make is checked
    // against it rather than the list being trusted.
    const configs = [
      cloneDefaultConfig(),
      (() => {
        const config = cloneDefaultConfig();
        config.source = "gradient";
        return config;
      })(),
      (() => {
        const config = cloneDefaultConfig();
        config.zeroVectorMode = "point";
        config.curve.enabled = true;
        config.curve.showPoint = true;
        return config;
      })(),
    ];
    for (const config of configs) {
      for (const animateTime of [false, true]) {
        const plan = createVectorFieldPlan(config, { animateTime });
        const known = new Set(allGeneratedIDs(config));
        const produced = [plan.folder.id, ...plan.expressions.map((e) => e.id)];
        for (const id of produced) {
          expect([id, known.has(id)]).toEqual([id, true]);
        }
      }
    }
  });

  test("a plan is a subset, not the whole vocabulary", () => {
    // The distinction only earns its keep because plans really do vary.
    const components = cloneDefaultConfig();
    const gradient = cloneDefaultConfig();
    gradient.source = "gradient";
    const idsOf = (config: ReturnType<typeof cloneDefaultConfig>) =>
      new Set(createVectorFieldPlan(config).expressions.map((e) => e.id));
    expect(idsOf(components).size).toBeLessThan(
      allGeneratedIDs(components).length
    );
    expect([...idsOf(gradient)]).toContain(
      `${namespaceForField(gradient)}_f_function`
    );
    expect([...idsOf(components)]).not.toContain(
      `${namespaceForField(components)}_f_function`
    );
  });
});

describe("Vector Tools flow colour matching", () => {
  const configWith = (matchFlow: boolean) => {
    const config = cloneDefaultConfig();
    config.color.mode = "magnitude";
    config.color.palette = "turbo";
    config.color.matchFlow = matchFlow;
    config.color.saturation = 1.4;
    config.color.contrast = 0.8;
    config.flow.colorMode = "direction";
    config.flow.palette = "ocean";
    config.flow.saturation = 0.6;
    config.flow.contrast = 1.6;
    return config;
  };

  test("overrides the flow's colours without overwriting them", () => {
    // This is the whole design. The first version copied the arrow settings
    // over the flow's and then hid the button that had done it, leaving no way
    // back — the flow's own choices were gone. Matching must be a view, so that
    // turning it off restores exactly what was there.
    const matched = configWith(true);
    expect(effectiveFlowColor(matched)).toEqual({
      colorMode: "speed",
      palette: "turbo",
      // "The same colors" has to include how hard they are pushed, or a
      // matched flow would follow the ramp and not the picture.
      saturation: 1.4,
      contrast: 0.8,
    });
    expect(matched.flow.colorMode).toBe("direction");
    expect(matched.flow.palette).toBe("ocean");
    expect(matched.flow.saturation).toBe(0.6);

    matched.color.matchFlow = false;
    expect(effectiveFlowColor(matched)).toEqual({
      colorMode: "direction",
      palette: "ocean",
      saturation: 0.6,
      contrast: 1.6,
    });
  });

  test("unmatched, the flow answers for itself", () => {
    expect(effectiveFlowColor(configWith(false))).toEqual({
      colorMode: "direction",
      palette: "ocean",
      saturation: 0.6,
      contrast: 1.6,
    });
  });

  test("every arrow mode maps to a particle mode", () => {
    // An arrow can be coloured by its x component; a particle's only scalar is
    // its speed. Anything that reads some measure of size has to land there, or
    // matching would silently pick a mode the flow cannot draw.
    const config = configWith(true);
    for (const mode of [
      "fixed",
      "magnitude",
      "log-magnitude",
      "direction",
      "x-component",
      "y-component",
    ] as const) {
      config.color.mode = mode;
      const { colorMode } = effectiveFlowColor(config);
      expect([mode, colorMode]).toEqual([
        mode,
        expect.stringMatching(/^(speed|direction|fixed)$/),
      ]);
    }
  });
});

/**
 * The library is where a saved setting from before it existed has to land, and
 * where two fields have to stay distinguishable. Both of those are silent
 * failures if they go wrong: a migration that drops the user's field loses
 * work, and two fields sharing a symbol token produce a duplicate-definition
 * error in Desmos rather than an error here.
 */
describe("the field library", () => {
  test("a setting saved before libraries existed becomes a one-field library", () => {
    const legacy = {
      schemaVersion: 3,
      id: "default",
      name: "My Field",
      components: { xLatex: "y", yLatex: "-x" },
      panel: { width: 500, height: 600, tab: "flow" },
    };
    const library = normalizeVectorFieldLibrary(legacy);
    expect(library.fields).toHaveLength(1);
    expect(library.activeId).toBe("default");
    expect(library.fields[0].name).toBe("My Field");
    // R did not exist then; it takes 0, so the field lies flat on Desmos 3D.
    expect(library.fields[0].components).toEqual({
      xLatex: "y",
      yLatex: "-x",
      zLatex: "0",
    });
    // The id and the token address expressions already written into the user's
    // saved graphs, so the migration is not allowed to reassign either.
    expect(library.fields[0].id).toBe("default");
    expect(library.fields[0].symbolToken).toBe("d");
    // The panel geometry comes out of the field and up to the library.
    expect(library.panel).toMatchObject({ width: 500, tab: "flow" });
  });

  test("anything unreadable falls back rather than throwing", () => {
    // A library the user cannot get back to is worse than a default one.
    expect(normalizeVectorFieldLibrary(null).fields).toHaveLength(1);
    expect(normalizeVectorFieldLibrary({ fields: [] }).fields).toHaveLength(1);
    expect(
      normalizeVectorFieldLibrary({ fields: [{}, {}] }).fields
    ).toHaveLength(2);
  });

  test("repeated ids and symbol tokens are moved apart", () => {
    const library = normalizeVectorFieldLibrary({
      fields: [
        { id: "default", symbolToken: "d" },
        { id: "default", symbolToken: "d" },
        { id: "other", symbolToken: "d" },
      ],
    });
    expect(new Set(library.fields.map((f) => f.id)).size).toBe(3);
    expect(new Set(library.fields.map((f) => f.symbolToken)).size).toBe(3);
    // The first field keeps what it had; only the later clashes move.
    expect(library.fields[0].id).toBe("default");
    expect(library.fields[0].symbolToken).toBe("d");
  });

  test("an active id pointing at nothing falls back to the first field", () => {
    const library = normalizeVectorFieldLibrary({
      fields: [{ id: "one" }, { id: "two" }],
      activeId: "gone",
    });
    expect(library.activeId).toBe("one");
    expect(activeField(library).id).toBe("one");
  });

  test("it will not hold more fields than there are symbols for", () => {
    const library = normalizeVectorFieldLibrary({
      fields: Array.from({ length: MAX_FIELDS + 5 }, (_, index) => ({
        id: `f${index}`,
      })),
    });
    expect(library.fields).toHaveLength(MAX_FIELDS);
    expect(nextSymbolToken(library)).toBeUndefined();
  });

  test("new fields get a free token, a free id and a name of their own", () => {
    const library = cloneDefaultLibrary();
    expect(nextSymbolToken(library)).toBe("e");
    expect(nextFieldID(library)).toBe("field1");
    expect(uniqueFieldName(library, "Vector Field")).toBe("Vector Field 2");
    expect(uniqueFieldName(library, "Something else")).toBe("Something else");
  });
});

describe("generated symbols are the field's own", () => {
  test("two fields do not both define the same Desmos symbol", () => {
    // Before the library existed the generator took the field's id and threw
    // it away, so every field emitted `v_{tfdp}`. Invisible while only one
    // field could exist; a duplicate-definition error the moment two could.
    const library = cloneDefaultLibrary();
    const [first] = library.fields;
    const second = {
      ...cloneDefaultConfig(),
      id: "field1",
      symbolToken: nextSymbolToken(library)!,
    };

    const latexOf = (config: typeof first) =>
      createVectorFieldPlan(config)
        .expressions.map((expression) => expression.latex ?? "")
        .join(" ");

    expect(latexOf(first)).toContain("v_{tfdp}");
    expect(latexOf(second)).toContain("v_{tfep}");
    expect(latexOf(second)).not.toContain("v_{tfdp}");
  });

  test("and their expression ids stay apart too", () => {
    const first = cloneDefaultConfig();
    const second = { ...cloneDefaultConfig(), id: "field1", symbolToken: "e" };
    const ids = (config: typeof first) => new Set(allGeneratedIDs(config));
    const shared = [...ids(first)].filter((id) => ids(second).has(id));
    expect(shared).toEqual([]);
  });
});
