import {
  clean,
  Driver,
  testWithPage,
  testWithPageAndOpts,
} from "../../tests/puppeteer-utils";
import type { Calc as CalcType } from "#globals";
import { PANEL_TABS, type PanelTab } from "./model";

declare let Calc: CalcType;
declare let DSM: Window["DSM"];

const BUTTON = ".dsm-action-menu .dsm-icon-compass2";
const PANEL = ".dsm-vector-tools-menu";
const GENERATE = ".dsm-vector-tools-generate";
const REMOVE = ".dsm-vector-tools-remove";
const RESET = ".dsm-vector-tools-reset";
const VISUALIZE = ".dsm-vector-tools-visualize";
const TEST_LAB = ".dsm-vector-tools-test-lab";
const FLOW_CANVAS = "#dsm-vector-tools-flow-canvas";
const NAMESPACE = "vector_tools_vf_default";
const FOLDER_ID = `${NAMESPACE}_folder`;
const UNRELATED_LINE_ID = "unrelated_line";

testWithPage(
  "Vector Tools generates a stable production field and does not expose its development lab in a production build",
  async (driver) => {
    expect(await driver.getEnabledPlugins()).not.toContain("vector-tools");
    await driver.enablePlugin("vector-tools");
    await driver.assertSelectorEventually(BUTTON);
    expect(await driver.$$(BUTTON)).toHaveLength(1);

    await driver.click(BUTTON);
    await driver.assertSelector(PANEL, GENERATE, REMOVE);
    await driver.assertSelectorNot(TEST_LAB);
    await driver.click(GENERATE);
    await driver.waitForSync();

    let items = (await driver.getState()).expressions.list;
    expect(items.filter((item) => item.id === FOLDER_ID)).toHaveLength(1);
    expect(items.find((item) => item.id === FOLDER_ID)).toMatchObject({
      type: "folder",
      title: "Vector Tools — Vector Field",
    });
    expect(
      items.filter((item) => item.id?.startsWith(`${NAMESPACE}_`)).length
    ).toBe(20);
    expect(
      items.find((item) => item.id === `${NAMESPACE}_shafts`)
    ).toMatchObject({
      type: "expression",
      folderId: FOLDER_ID,
      // Desmos drops colorLatex from setExpression and ignores the
      // set-item-colorLatex action, so a regression here means every arrow
      // silently renders in the same flat color.
      colorLatex: "v_{tfdc}",
    });
    expect(
      items.find((item) => item.id === `${NAMESPACE}_p_function`)
    ).toMatchObject({
      latex: "v_{tfdp}\\left(x,y\\right)=\\left(-y\\right)",
      hidden: true,
    });
    const semanticSnapshot = await driver.evaluate(
      (namespace) =>
        Calc.controller
          .getAllItemModels()
          .filter((item) => item.id.startsWith(`${namespace}_`))
          .map((item) => {
            const expression = item as typeof item & {
              formula?: { expression_type?: string };
              error?: unknown;
            };
            return {
              id: item.id,
              expressionType: expression.formula?.expression_type,
              hasError: expression.error !== undefined,
              error:
                expression.error === undefined
                  ? undefined
                  : JSON.stringify(expression.error),
            };
          }),
      NAMESPACE
    );
    expect(semanticSnapshot).toHaveLength(20);
    expect(semanticSnapshot.filter((item) => item.hasError)).toEqual([]);
    await driver.click(GENERATE);
    await driver.waitForSync();
    items = (await driver.getState()).expressions.list;
    expect(
      items.filter((item) => item.id?.startsWith(`${NAMESPACE}_`))
    ).toHaveLength(20);

    await driver.evaluate(
      (id) => Calc.setExpression({ id, latex: "y=x^2" }),
      UNRELATED_LINE_ID
    );
    await driver.waitForSync();
    await driver.click(REMOVE);
    await driver.waitForSync();

    items = (await driver.getState()).expressions.list;
    expect(items.find((item) => item.id === FOLDER_ID)).toBeUndefined();
    expect(
      items.find((item) => item.id?.startsWith(`${NAMESPACE}_`))
    ).toBeUndefined();
    expect(items.find((item) => item.id === UNRELATED_LINE_ID)).toMatchObject({
      type: "expression",
      latex: "y=x^2",
    });

    await driver.disablePlugin("vector-tools");
    await driver.assertSelectorNot(BUTTON, PANEL);
    await driver.enablePlugin("vector-tools");
    await driver.assertSelectorEventually(BUTTON);
    expect(await driver.$$(BUTTON)).toHaveLength(1);
    await driver.disablePlugin("vector-tools");
    await driver.setBlank();
    await driver.waitForSync();

    return clean;
  },
  90000
);

/** Chips replaced the panel's dropdowns; this is how one is read and pressed. */
const selectedChip = (label: string) =>
  [
    ...document.querySelectorAll<HTMLElement>(
      `.dsm-vector-tools-menu [aria-label="${label}"] .dsm-vector-tools-chip`
    ),
  ].find((chip) => chip.getAttribute("aria-pressed") === "true")?.dataset.value;

/**
 * `evaluate` stringifies its callback, so nothing from module scope is in
 * scope inside one. Read the stored config through its own round trip.
 */
const storedLibrary = async (driver: Driver) =>
  await driver.evaluate(() =>
    JSON.parse(
      DSM.pluginSettings["vector-tools"]!.serializedFieldConfig as string
    )
  );

/** The field the panel is editing, read back out of the stored library. */
const storedConfig = async (driver: Driver) => {
  const library = await storedLibrary(driver);
  return library.fields.find(
    (field: { id: string }) => field.id === library.activeId
  );
};

/**
 * Opens a tab by name rather than by position.
 *
 * These used to take an index, and inserting the Curve tab between Color and
 * Flow silently pointed three flow tests at the wrong panel — they went on
 * querying for controls that were no longer rendered and failed on `undefined`.
 * A name cannot be shifted by adding a tab somewhere else.
 */
async function openTab(driver: Driver, id: PanelTab) {
  const index = PANEL_TABS.findIndex((tab) => tab.id === id);
  if (index < 0) throw new Error(`No such panel tab: ${id}`);
  await driver.click(
    `.dsm-vector-tools-tabs .dcg-segmented-control-btn:nth-child(${index + 1})`
  );
}

testWithPage(
  "Vector Tools panel controls show the stored configuration",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    await driver.assertSelectorEventually(BUTTON);
    await driver.click(BUTTON);

    // The panel opens on Field, and its sampling chips reflect stored state.
    expect(await driver.evaluate(selectedChip, "Sampling x by")).toBe("step");
    // Each axis has its own group. They used to share one aria-label, so
    // nothing could tell the two apart.
    expect(await driver.evaluate(selectedChip, "Sampling y by")).toBe("step");

    // Number inputs must be unique per axis, or the labels point at the wrong
    // field and the y axis mirrors the x axis.
    const numberIDs = await driver.evaluate(() =>
      [
        ...document.querySelectorAll(
          ".dsm-vector-tools-menu input[type=number]"
        ),
      ].map((input) => input.id)
    );
    expect(new Set(numberIDs).size).toBe(numberIDs.length);
    expect(numberIDs).toContain("dsm-vector-tools-x-minimum");
    expect(numberIDs).toContain("dsm-vector-tools-y-minimum");

    // DCGView writes props as attributes, and `disabled="false"` still
    // disables an input, so every number field used to be unusable.
    const disabled = await driver.evaluate(() =>
      [
        ...document.querySelectorAll<HTMLInputElement>(
          ".dsm-vector-tools-menu input[type=number]"
        ),
      ].map((input) => input.disabled)
    );
    expect(disabled).not.toContain(true);

    // Typing must actually reach the stored configuration.
    await driver.page.click("#dsm-vector-tools-x-minimum", { clickCount: 3 });
    await driver.page.keyboard.type("-4");
    await driver.waitForSync();
    expect((await storedConfig(driver)).domain.x.min).toBe(-4);

    await openTab(driver, "arrows");
    expect(await driver.evaluate(selectedChip, "Length mode")).toBe(
      "normalized"
    );
    await driver.click('[aria-label="Length mode"] [data-value="compressed"]');
    await driver.waitForSync();
    expect(await driver.evaluate(selectedChip, "Length mode")).toBe(
      "compressed"
    );

    await driver.click(RESET);
    await driver.waitForSync();
    expect(await driver.evaluate(selectedChip, "Length mode")).toBe(
      "normalized"
    );

    await driver.disablePlugin("vector-tools");
    await driver.setBlank();
    await driver.waitForSync();
  },
  90000
);

testWithPage(
  "Vector Tools panel is resizable and its popover grows with it",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    await driver.assertSelectorEventually(BUTTON);
    await driver.click(BUTTON);

    // Resizing is a corner drag on the panel itself, so the size has to be
    // read back off the element and persisted.
    await driver.evaluate(() => {
      const menu = document.querySelector<HTMLElement>(
        ".dsm-vector-tools-menu"
      )!;
      menu.style.width = "470px";
    });
    // The size is debounced before it is written, and writing a plugin setting
    // is itself deferred, so wait for the value rather than for a duration.
    await driver.page.waitForFunction(
      () =>
        JSON.parse(
          (window as unknown as { DSM: { pluginSettings: any } }).DSM
            .pluginSettings["vector-tools"].serializedFieldConfig
        ).panel.width === 470
    );

    const geometry = await driver.evaluate(() => {
      const menu = document.querySelector<HTMLElement>(
        ".dsm-vector-tools-menu"
      )!;
      const popover = menu.closest<HTMLElement>(".dsm-pillbox-popover")!;
      const body = menu.querySelector<HTMLElement>(".dsm-vector-tools-body")!;
      return {
        resize: getComputedStyle(menu).resize,
        menuWidth: Math.round(menu.getBoundingClientRect().width),
        // A fixed-width pillbox popover would clip the resized panel.
        popoverWidth: Math.round(popover.getBoundingClientRect().width),
        // The body scrolls so the tabs and action buttons stay put.
        bodyScrolls: body.scrollHeight > body.clientHeight,
        footerPresent: menu.querySelector(".dsm-vector-tools-footer") !== null,
        storedWidth: JSON.parse(
          DSM.pluginSettings["vector-tools"]!.serializedFieldConfig as string
        ).panel.width,
      };
    });
    expect(geometry.resize).toBe("both");
    expect(geometry.menuWidth).toBe(470);
    expect(geometry.popoverWidth).toBe(470);
    expect(geometry.bodyScrolls).toBe(true);
    expect(geometry.footerPresent).toBe(true);
    expect(geometry.storedWidth).toBe(470);

    // Closing and reopening must bring the panel back at the chosen size.
    await driver.click(BUTTON);
    await driver.assertSelectorNot(PANEL);
    await driver.click(BUTTON);
    expect(
      await driver.evaluate(() =>
        Math.round(
          document
            .querySelector(".dsm-vector-tools-menu")!
            .getBoundingClientRect().width
        )
      )
    ).toBe(470);

    await driver.disablePlugin("vector-tools");
    await driver.setBlank();
    await driver.waitForSync();
  },
  90000
);

testWithPage(
  "Vector Tools mirrors P and Q through the expression list",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    await driver.assertSelectorEventually(BUTTON);
    await driver.click(BUTTON);

    await driver.click(".dsm-vector-tools-link-components");
    await driver.waitForSync();

    // Only the folder and the two definitions: this must not conjure a whole
    // field the user did not ask to generate.
    expect(
      await driver.evaluate(() =>
        Calc.getState()
          .expressions.list.filter((item) =>
            item.id?.startsWith("vector_tools_vf_default")
          )
          .map((item) => item.id)
      )
    ).toEqual([
      FOLDER_ID,
      `${NAMESPACE}_p_function`,
      `${NAMESPACE}_q_function`,
    ]);

    // Editing the definition in the expression list reaches the panel.
    await driver.evaluate(() =>
      Calc.controller.dispatch({
        type: "set-item-latex",
        id: "vector_tools_vf_default_p_function",
        latex: "v_{tfdp}\\left(x,y\\right)=\\left(-3y\\right)",
      })
    );
    await driver.waitForSync();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect((await storedConfig(driver)).components).toEqual({
      xLatex: "-3y",
      yLatex: "x",
    });

    // A definition renamed out from under the plugin is reported, not adopted.
    await driver.evaluate(() =>
      Calc.controller.dispatch({
        type: "set-item-latex",
        id: "vector_tools_vf_default_q_function",
        latex: "g\\left(x,y\\right)=x",
      })
    );
    await driver.waitForSync();
    await new Promise((resolve) => setTimeout(resolve, 400));
    const afterRename = await driver.evaluate(() => ({
      hint: document.querySelector(
        ".dsm-vector-tools-link-row .dsm-vector-tools-hint"
      )?.textContent,
      components: JSON.parse(
        DSM.pluginSettings["vector-tools"]!.serializedFieldConfig as string
      ).fields[0].components,
    }));
    expect(afterRename.hint).toContain("no longer matches");
    expect(afterRename.components.yLatex).toBe("x");

    await driver.disablePlugin("vector-tools");
    await driver.setBlank();
    await driver.waitForSync();
  },
  90000
);

testWithPage(
  "Vector Tools generates a gradient field Desmos differentiates itself",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    await driver.assertSelectorEventually(BUTTON);
    await driver.click(BUTTON);
    await openTab(driver, "field");

    await driver.click('[aria-label="Field from"] [data-value="gradient"]');
    await driver.waitForSync();
    expect((await storedConfig(driver)).source).toBe("gradient");

    await driver.click(GENERATE);
    await driver.waitForSync();

    const items = (await driver.getState()).expressions.list;
    // The scalar joins the folder, and P and Q become its partials.
    expect(
      items.find((item) => item.id === `${NAMESPACE}_f_function`)
    ).toMatchObject({
      latex: "v_{tfdf}\\left(x,y\\right)=\\left(x^{2}+y^{2}\\right)",
      hidden: true,
    });
    expect(
      items.find((item) => item.id === `${NAMESPACE}_p_function`)
    ).toMatchObject({
      latex:
        "v_{tfdp}\\left(x,y\\right)=\\left(\\frac{d}{dx}v_{tfdf}\\left(x,y\\right)\\right)",
    });
    expect(
      items.filter((item) => item.id?.startsWith(`${NAMESPACE}_`))
    ).toHaveLength(21);

    // Nothing errors, and the derivative is Desmos's own, so it is exact
    // rather than approximated: ∇(x²+y²) = (2x, 2y).
    const evaluated = await driver.evaluate(async () => {
      const read = async (latex: string) => {
        const helper = Calc.HelperExpression({ latex });
        return await new Promise<number>((resolve) => {
          const timer = setTimeout(() => resolve(Number.NaN), 3000);
          helper.observe("numericValue", () => {
            clearTimeout(timer);
            resolve(helper.numericValue);
          });
        });
      };
      return {
        p: await read("v_{tfdp}\\left(3,4\\right)"),
        q: await read("v_{tfdq}\\left(3,4\\right)"),
        errors: Calc.controller
          .getAllItemModels()
          .filter(
            (item) =>
              item.id.startsWith("vector_tools_vf_default_") &&
              (item as { error?: unknown }).error !== undefined
          )
          .map((item) => item.id),
      };
    });
    expect(evaluated.p).toBe(6);
    expect(evaluated.q).toBe(8);
    expect(evaluated.errors).toEqual([]);

    // Editing f in the panel has to rewrite the derived components too, or the
    // graph keeps the old gradient.
    await driver.evaluate(() => {
      // The panel calls this from its math input; reaching it directly keeps
      // the test off MathQuill's keystroke handling.
      (
        DSM.enabledPlugins["vector-tools"] as unknown as {
          setSlot: (slot: string, latex: string) => void;
        }
      ).setSlot("f", "x^{3}");
    });
    await driver.waitForSync();
    expect(
      (await driver.getState()).expressions.list.find(
        (item) => item.id === `${NAMESPACE}_f_function`
      )
    ).toMatchObject({
      latex: "v_{tfdf}\\left(x,y\\right)=\\left(x^{3}\\right)",
    });
    expect(
      await driver.evaluate(async () => {
        const helper = Calc.HelperExpression({
          latex: "v_{tfdp}\\left(2,0\\right)",
        });
        return await new Promise<number>((resolve) => {
          const timer = setTimeout(() => resolve(Number.NaN), 3000);
          helper.observe("numericValue", () => {
            clearTimeout(timer);
            resolve(helper.numericValue);
          });
        });
      })
    ).toBe(12);

    await driver.click(REMOVE);
    await driver.waitForSync();
    await driver.click('[aria-label="Field from"] [data-value="components"]');
    await driver.waitForSync();
    await driver.disablePlugin("vector-tools");
    await driver.setBlank();
    await driver.waitForSync();
    // Plugin settings are written to extension storage on a delay, and every
    // later test opens a fresh page that reads them back. Without this the
    // source would still be `gradient` for the rest of the run.
    await driver.page.waitForFunction(() => !DSM.delaySetPluginSettings);
  },
  90000
);

testWithPage(
  "Vector Tools fills the sampling domain from the visible graph",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    await driver.assertSelectorEventually(BUTTON);
    await driver.click(BUTTON);
    // The open tab is persisted, so this test cannot assume the panel opens on
    // the tab that holds the sampling domain.
    await openTab(driver, "field");

    await driver.evaluate(() =>
      Calc.setMathBounds({ left: -3, right: 7, bottom: -2, top: 5 })
    );
    await driver.waitForSync();
    await driver.click(".dsm-vector-tools-match-viewport");
    await driver.waitForSync();

    // Desmos adjusts the requested bounds to the graph paper's aspect ratio, so
    // the check is against what the viewport actually became.
    const { domain, bounds } = await driver.evaluate(() => ({
      domain: JSON.parse(
        DSM.pluginSettings["vector-tools"]!.serializedFieldConfig as string
      ).fields[0].domain,
      bounds: Calc.graphpaperBounds.mathCoordinates,
    }));
    const round = (value: number) => Math.round(value * 1000) / 1000;
    expect(domain.x.min).toBe(round(bounds.left));
    expect(domain.x.max).toBe(round(bounds.right));
    expect(domain.y.min).toBe(round(bounds.bottom));
    expect(domain.y.max).toBe(round(bounds.top));
    expect(domain.x.min).toBe(-3);
    expect(domain.x.max).toBe(7);
    // Only the four bounds move: the sampling mode and step are the user's.
    expect(domain.x.mode).toBe("step");
    expect(domain.x.step).toBe(1);

    // The panel's own number fields have to show the new bounds too.
    expect(
      await driver.evaluate(
        () =>
          document.querySelector<HTMLInputElement>(
            "#dsm-vector-tools-x-maximum"
          )?.value
      )
    ).toBe("7");

    await driver.disablePlugin("vector-tools");
    await driver.setBlank();
    await driver.waitForSync();
  },
  90000
);

testWithPageAndOpts(
  "Vector Tools flow visualizer runs on the geometry graph paper",
  { path: "/geometry", timeout: 90000 },
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    await driver.assertSelectorEventually(BUTTON);
    await driver.click(BUTTON);
    await openTab(driver, "flow");

    await driver.click(VISUALIZE);
    await driver.assertSelectorEventually(FLOW_CANVAS);

    // Geometry is the same 2D graph paper, so the overlay registers with it
    // exactly as it does in the calculator.
    const geometry = await driver.evaluate(() => {
      const overlay = document.querySelector<HTMLCanvasElement>(
        "#dsm-vector-tools-flow-canvas"
      )!;
      const graph = document.querySelector<HTMLCanvasElement>(
        "canvas.dcg-graph-inner"
      )!;
      const a = overlay.getBoundingClientRect();
      const b = graph.getBoundingClientRect();
      return {
        aligned:
          Math.abs(a.x - b.x) < 1 &&
          Math.abs(a.y - b.y) < 1 &&
          Math.abs(a.width - b.width) < 1 &&
          Math.abs(a.height - b.height) < 1,
        pointerEvents: getComputedStyle(overlay).pointerEvents,
        hasBuffer: overlay.width > 0 && overlay.height > 0,
      };
    });
    expect(geometry.aligned).toBe(true);
    expect(geometry.pointerEvents).toBe("none");
    expect(geometry.hasBuffer).toBe(true);

    await driver.disablePlugin("vector-tools");
    await driver.assertSelectorNot(FLOW_CANVAS);
  }
);

testWithPageAndOpts(
  "Vector Tools refuses to flow over the 3D calculator",
  { path: "/3d", timeout: 90000 },
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    await driver.assertSelectorEventually(BUTTON);
    await driver.click(BUTTON);
    await openTab(driver, "flow");

    // The overlay maps math coordinates linearly onto the graph paper's rect,
    // which the 3D product's rotatable x/y/z box does not support — and the 3D
    // canvas paints over the overlay anyway. Say so instead of animating a
    // wrong, invisible field.
    const state = await driver.evaluate(() => ({
      disabled: document
        .querySelector(".dsm-vector-tools-visualize")
        ?.classList.contains("dsm-btn-disabled"),
      warning: document.querySelector(
        ".dsm-vector-tools-flow .dsm-vector-tools-warning"
      )?.textContent,
    }));
    expect(state.disabled).toBe(true);
    expect(state.warning).toContain("3D calculator");

    await driver.click(VISUALIZE);
    await driver.assertSelectorNot(FLOW_CANVAS);
    // Generation is unaffected: the field is ordinary Desmos expressions.
    await driver.click(GENERATE);
    await driver.waitForSync();
    expect(
      (await driver.getState()).expressions.list.filter((item) =>
        item.id?.startsWith(`${NAMESPACE}_`)
      )
    ).toHaveLength(20);

    await driver.click(REMOVE);
    await driver.waitForSync();
    await driver.disablePlugin("vector-tools");
    await driver.setBlank();
    await driver.waitForSync();
  }
);

testWithPage(
  "Vector Tools flow visualizer covers the graph paper and cleans up after itself",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    await driver.assertSelectorEventually(BUTTON);
    await driver.click(BUTTON);
    await openTab(driver, "flow");

    await driver.assertSelectorNot(FLOW_CANVAS);
    await driver.click(VISUALIZE);
    await driver.assertSelectorEventually(FLOW_CANVAS);

    const geometry = await driver.evaluate(() => {
      const overlay = document.querySelector<HTMLCanvasElement>(
        "#dsm-vector-tools-flow-canvas"
      )!;
      const graph = document.querySelector<HTMLCanvasElement>(
        "canvas.dcg-graph-inner"
      )!;
      const a = overlay.getBoundingClientRect();
      const b = graph.getBoundingClientRect();
      return {
        aligned:
          Math.abs(a.x - b.x) < 1 &&
          Math.abs(a.y - b.y) < 1 &&
          Math.abs(a.width - b.width) < 1 &&
          Math.abs(a.height - b.height) < 1,
        pointerEvents: getComputedStyle(overlay).pointerEvents,
        hasBuffer: overlay.width > 0 && overlay.height > 0,
        // Under the graph by default, which is what lets a plotted function
        // come out on top of the field. Desmos's canvas is transparent
        // wherever it has not drawn something, so this hides nothing.
        drawnAfterGraph:
          graph.compareDocumentPosition(overlay) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      };
    });
    expect(geometry.aligned).toBe(true);
    expect(geometry.pointerEvents).toBe("none");
    expect(geometry.hasBuffer).toBe(true);
    expect(geometry.drawnAfterGraph).toBe(0);

    // Particle count is a free number, not a menu of fixed sizes.
    await driver.page.click("#dsm-vector-tools-particle-count", {
      clickCount: 3,
    });
    await driver.page.keyboard.type("37500");
    await driver.page.keyboard.press("Tab");
    await driver.waitForSync();
    expect((await storedConfig(driver)).flow.particleCount).toBe(37500);

    // A component the GPU cannot evaluate must disable the button with a
    // reason rather than failing when it is pressed. `a_{1}` is refused now
    // for being undefined rather than for being subscripted: a name the graph
    // does define is compiled, so the reason has to name the name.
    await driver.evaluate(() => {
      const library = JSON.parse(
        DSM.pluginSettings["vector-tools"]!.serializedFieldConfig as string
      );
      library.fields[0].components.xLatex = "a_{1}";
      DSM.setPluginSetting(
        "vector-tools",
        "serializedFieldConfig",
        JSON.stringify(library)
      );
    });
    await driver.waitForSync();
    expect(
      await driver.evaluate(
        () =>
          document.querySelector(
            ".dsm-vector-tools-flow .dsm-vector-tools-warning"
          )?.textContent
      )
    ).toContain("is not defined");

    await driver.disablePlugin("vector-tools");
    await driver.assertSelectorNot(FLOW_CANVAS);
    await driver.setBlank();
    await driver.waitForSync();
  },
  90000
);

/**
 * The parts of the frame that only a GPU can answer for: that the pipeline
 * still paints after the vertex arrays were shared between programs, that
 * render scale really does shrink the buffer being filled, and that a drag —
 * which arrives as a burst of bounds changes — reprojects the trails instead of
 * erroring or wiping them.
 */
testWithPage(
  "Vector Tools flow visualizer paints, scales, and survives a drag",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    await driver.evaluate(() => {
      (DSM.enabledPlugins["vector-tools"] as any).toggleFlow();
    });
    await driver.assertSelectorEventually(FLOW_CANVAS);
    await new Promise((resolve) => setTimeout(resolve, 1200));

    /**
     * Opaque pixels in the drawing buffer, read inside a frame callback.
     * `preserveDrawingBuffer` is off, so this is only valid before the frame
     * is composited away.
     */
    const litPixels = async () =>
      await driver.evaluate(
        async () =>
          await new Promise<number>((resolve) => {
            requestAnimationFrame(() => {
              const canvas = document.querySelector<HTMLCanvasElement>(
                "#dsm-vector-tools-flow-canvas"
              )!;
              const gl = canvas.getContext("webgl2")!;
              const pixels = new Uint8Array(canvas.width * canvas.height * 4);
              gl.bindFramebuffer(gl.FRAMEBUFFER, null);
              gl.readPixels(
                0,
                0,
                canvas.width,
                canvas.height,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                pixels
              );
              let lit = 0;
              for (let i = 3; i < pixels.length; i += 4) {
                if (pixels[i] > 8) lit++;
              }
              resolve(lit);
            });
          })
      );
    const canvasSize = async () =>
      await driver.evaluate(() => {
        const canvas = document.querySelector<HTMLCanvasElement>(
          "#dsm-vector-tools-flow-canvas"
        )!;
        const gl = canvas.getContext("webgl2")!;
        return {
          buffer: canvas.width,
          css: canvas.clientWidth,
          error: gl.getError(),
        };
      });

    const full = await canvasSize();
    expect(full.error, "the flow reported a WebGL error").toBe(0);
    // Something has to actually be on the canvas; a broken vertex binding
    // would leave it perfectly empty while everything else still looked fine.
    expect(await litPixels()).toBeGreaterThan(full.buffer * 4);

    // Half the render scale is a quarter of the pixels, with the element and
    // its layout untouched.
    await driver.evaluate(() => {
      (DSM.enabledPlugins["vector-tools"] as any).setFlow("renderScale", 0.5);
    });
    await new Promise((resolve) => setTimeout(resolve, 400));
    const halved = await canvasSize();
    expect(halved.buffer).toBe(Math.round(full.buffer / 2));
    expect(halved.css).toBe(full.css);
    expect(await litPixels()).toBeGreaterThan(halved.buffer * 4);

    // A drag is a burst of bounds changes, not one. Reprojecting on each has
    // to leave the visualizer running and error-free.
    await driver.evaluate(() => {
      for (let i = 1; i <= 20; i++) {
        Calc.setMathBounds({
          left: -10 + i * 0.1,
          right: 10 + i * 0.1,
          bottom: -6,
          top: 6,
        });
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 400));
    const panned = await canvasSize();
    expect(panned.error, "panning left the flow in a WebGL error state").toBe(
      0
    );
    expect(
      await driver.evaluate(
        () => (DSM.enabledPlugins["vector-tools"] as any).flowStatus
      )
    ).toContain("Streaming");
    expect(await litPixels()).toBeGreaterThan(panned.buffer * 4);

    await driver.disablePlugin("vector-tools");
    await driver.assertSelectorNot(FLOW_CANVAS);
    await driver.setBlank();
    await driver.waitForSync();
  },
  90000
);

const ARROW_CANVAS = "#dsm-vector-tools-arrow-canvas";

/**
 * The live arrows are the half of the plugin Desmos does not draw, so nothing
 * about them shows up in the expression list. What can be checked is that they
 * mount, that they follow the configuration, and that choosing Desmos instead
 * puts the graph back the way it was.
 */
testWithPage(
  "Vector Tools draws arrows itself, and hands them back to Desmos on request",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    // The configuration persists across tests on a shared page, so this starts
    // from the defaults and puts them back before it leaves.
    await driver.evaluate(() =>
      (DSM.enabledPlugins["vector-tools"] as any).resetConfig()
    );
    /**
     * Settings are written asynchronously and the arrows follow a tick later,
     * so the count is what to wait on rather than a fixed pause.
     */
    const waitForArrows = async (count: number) =>
      await driver.waitForFunction(
        (expected: number) =>
          ((DSM.enabledPlugins["vector-tools"] as any)
            .arrowStatus as string) === `Drawing ${expected} arrows live.`,
        {},
        count
      );
    await waitForArrows(273);

    const vt = async () =>
      await driver.evaluate(() => {
        const plugin = DSM.enabledPlugins["vector-tools"] as any;
        const canvas = document.querySelector<HTMLCanvasElement>(
          "#dsm-vector-tools-arrow-canvas"
        );
        return {
          mode: plugin.arrowMode as string,
          status: plugin.arrowStatus as string,
          mounted: canvas !== null,
          // A zero-sized drawing buffer would mount and draw nothing at all.
          width: canvas?.width ?? 0,
          expressions: Calc.getState().expressions.list.length,
        };
      });

    // Live is the default, so enabling the plugin is enough to see the field.
    await driver.assertSelectorEventually(ARROW_CANVAS);
    const live = await vt();
    expect(live.mode).toBe("live");
    expect(live.mounted).toBe(true);
    expect(live.width).toBeGreaterThan(0);
    expect(live.status).toContain("273");
    // Nothing was written to the expression list to get that picture.
    expect(live.expressions).toBe(1);

    // The grid follows the sampling domain, so a coarser axis means fewer.
    await driver.evaluate(() => {
      const plugin = DSM.enabledPlugins["vector-tools"] as any;
      plugin.setAxis("x", "mode", "count");
      plugin.setAxis("x", "count", 11);
    });
    await waitForArrows(143);

    // Handing the arrows back to Desmos takes the canvas away entirely.
    await driver.evaluate(() =>
      (DSM.enabledPlugins["vector-tools"] as any).setArrowMode("desmos")
    );
    await driver.assertSelectorNot(ARROW_CANVAS);
    const generated = await vt();
    expect(generated.mode).toBe("desmos");
    expect(generated.mounted).toBe(false);
    await driver.assertSelectorNot(ARROW_CANVAS);

    await driver.evaluate(() =>
      (DSM.enabledPlugins["vector-tools"] as any).setArrowMode("live")
    );
    await driver.assertSelectorEventually(ARROW_CANVAS);

    // Off is neither of the other two: nothing is drawn, and nothing is
    // written either.
    await driver.evaluate(() =>
      (DSM.enabledPlugins["vector-tools"] as any).setArrowMode("off")
    );
    await driver.assertSelectorNot(ARROW_CANVAS);
    expect((await vt()).status).toBe("Arrows are off.");
    await driver.evaluate(() =>
      (DSM.enabledPlugins["vector-tools"] as any).setArrowMode("live")
    );
    await waitForArrows(143);

    // A domain matched to a zoomed-out viewport asks for far more arrows than
    // there are pixels. That is thinned by default and drawn in full on
    // request — the point of drawing here rather than through Desmos.
    await driver.evaluate(() => {
      const plugin = DSM.enabledPlugins["vector-tools"] as any;
      plugin.setAxis("x", "mode", "step");
      plugin.setAxis("x", "min", -400);
      plugin.setAxis("x", "max", 400);
      plugin.setAxis("y", "min", -233);
      plugin.setAxis("y", "max", 233);
    });
    await driver.waitForFunction(() =>
      (
        (DSM.enabledPlugins["vector-tools"] as any).arrowStatus as string
      ).includes("of 374067 arrows")
    );
    expect((await vt()).status).toContain("sampled coarsely");
    expect(
      (await driver.evaluate(
        () => (DSM.enabledPlugins["vector-tools"] as any).arrowViewport
      )) !== undefined
    ).toBe(true);

    await driver.evaluate(() =>
      (DSM.enabledPlugins["vector-tools"] as any).setArrowDensityLimit(false)
    );
    await waitForArrows(374067);
    // Turning it back on is what the rest of this test assumes.
    await driver.evaluate(() =>
      (DSM.enabledPlugins["vector-tools"] as any).resetConfig()
    );
    await waitForArrows(273);

    // Changing a setting re-measures the field's magnitude range, and that
    // pass renders into a grid-sized buffer of its own. Leaving the viewport
    // at that size drew the whole field into a corner — a failure nothing but
    // the pixels could see, so what the frame drew into is checked directly.
    await driver.evaluate(() =>
      (DSM.enabledPlugins["vector-tools"] as any).setColor(
        "palette",
        "sequential-a"
      )
    );
    await new Promise((resolve) => setTimeout(resolve, 400));
    const viewport = await driver.evaluate(
      () => (DSM.enabledPlugins["vector-tools"] as any).arrowViewport
    );
    expect(viewport.drawn).toEqual(viewport.canvas);
    expect(viewport.drawn.width).toBeGreaterThan(100);

    await driver.evaluate(() =>
      (DSM.enabledPlugins["vector-tools"] as any).resetConfig()
    );

    // Disabling the plugin has to leave the page as it found it.
    await driver.disablePlugin("vector-tools");
    await driver.assertSelectorNot(ARROW_CANVAS);
    await driver.setBlank();
    await driver.waitForSync();
  },
  90000
);

testWithPage(
  "Vector Tools compiles a field against what the rest of the graph defines",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    await driver.assertSelectorEventually(BUTTON);
    await driver.click(BUTTON);

    // Neither of these belongs to the plugin. A component may still use them.
    await driver.evaluate(() => {
      Calc.setExpression({ id: "vt_slider_a", latex: "a=2" });
      Calc.setExpression({ id: "vt_fn_f", latex: "f\\left(u\\right)=u^{2}" });
    });
    await driver.evaluate(() => {
      const vt = DSM.enabledPlugins["vector-tools"] as any;
      vt.setSlot("p", "ay");
      vt.setSlot("q", "f\\left(x\\right)");
    });

    const compiled = async () =>
      await driver.evaluate(() => {
        const result = (DSM.enabledPlugins["vector-tools"] as any)
          .flowAvailability;
        return {
          ok: result.ok,
          error: result.ok ? "" : result.error,
          params: result.ok ? (result.field.params ?? []) : [],
          helpers: result.ok
            ? (result.field.helpers ?? []).map((h: any) => h.name)
            : [],
        };
      });

    // The scan is coalesced off the dispatcher, so this settles rather than
    // being immediate.
    await driver.waitForFunction(
      () =>
        ((DSM.enabledPlugins["vector-tools"] as any).flowAvailability.ok as
          | boolean
          | undefined) === true,
      { timeout: 8000 }
    );

    const used = await compiled();
    // The value is a uniform and the definition is a compiled GLSL function:
    // the two halves of what the environment is for.
    expect(used.params).toEqual(["a"]);
    expect(used.helpers).toEqual(["f"]);
    expect(
      await driver.evaluate(
        () => (DSM.enabledPlugins["vector-tools"] as any).fieldReferenceStatus
      )
    ).toContain("f()");

    // Deleting a definition the field depends on must say which name went, not
    // fail somewhere unrecognisable.
    await driver.evaluate(() => Calc.removeExpression({ id: "vt_fn_f" }));
    await driver.waitForFunction(
      () =>
        ((DSM.enabledPlugins["vector-tools"] as any).flowAvailability.ok as
          | boolean
          | undefined) === false,
      { timeout: 8000 }
    );
    expect((await compiled()).error).toContain('"f" is not defined');

    await driver.evaluate(() =>
      (DSM.enabledPlugins["vector-tools"] as any).resetConfig()
    );
    await driver.disablePlugin("vector-tools");
    await driver.setBlank();
    await driver.waitForSync();
  },
  90000
);

testWithPage(
  "Vector Tools animates a field written in terms of t, and yields t to the graph",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    await driver.assertSelectorEventually(BUTTON);
    await driver.click(BUTTON);

    const clock = async () =>
      await driver.evaluate(() => {
        const vt = DSM.enabledPlugins["vector-tools"] as any;
        const compiled = vt.flowAvailability;
        return {
          usesTime: compiled.ok ? compiled.field.usesTime === true : false,
          seconds: vt.clockReadout as number,
        };
      });

    // A field with no `t` in it must cost nothing: no clock, no uniform.
    expect((await clock()).usesTime).toBe(false);

    await driver.evaluate(() => {
      const vt = DSM.enabledPlugins["vector-tools"] as any;
      vt.setSlot("p", "\\sin\\left(y+t\\right)");
      vt.setSlot("q", "\\cos\\left(x-t\\right)");
    });
    await driver.waitForFunction(
      () =>
        ((DSM.enabledPlugins["vector-tools"] as any).clockReadout as number) >
        0.2,
      { timeout: 8000 }
    );
    expect((await clock()).usesTime).toBe(true);

    // Pausing has to actually stop it, not just stop saying it is running.
    await driver.evaluate(() =>
      (DSM.enabledPlugins["vector-tools"] as any).setTimePlaying(false)
    );
    const paused = (await clock()).seconds;
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect((await clock()).seconds).toBe(paused);

    // A graph that defines `t` itself means that `t`, not the clock: an
    // explicit definition beats an implicit meaning, which is also what keeps
    // `t` usable as an ordinary slider.
    await driver.evaluate(() =>
      Calc.setExpression({ id: "vt_t_slider", latex: "t=3" })
    );
    await driver.waitForFunction(
      () =>
        ((DSM.enabledPlugins["vector-tools"] as any).flowAvailability.field
          ?.usesTime as boolean | undefined) !== true,
      { timeout: 8000 }
    );
    expect((await clock()).usesTime).toBe(false);

    await driver.evaluate(() => Calc.removeExpression({ id: "vt_t_slider" }));
    await driver.waitForFunction(
      () =>
        ((DSM.enabledPlugins["vector-tools"] as any).flowAvailability.field
          ?.usesTime as boolean | undefined) === true,
      { timeout: 8000 }
    );

    await driver.evaluate(() =>
      (DSM.enabledPlugins["vector-tools"] as any).resetConfig()
    );
    await driver.disablePlugin("vector-tools");
    await driver.setBlank();
    await driver.waitForSync();
  },
  90000
);

testWithPage(
  "Vector Tools can stop matching the flow's colours to the arrows'",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    await driver.assertSelectorEventually(BUTTON);
    await driver.click(BUTTON);
    await openTab(driver, "color");

    // Set the two apart, so matching has something visible to do.
    await driver.evaluate(() => {
      const vt = DSM.enabledPlugins["vector-tools"] as any;
      vt.setColor("mode", "magnitude");
      vt.setColor("palette", "turbo");
      vt.setFlow("colorMode", "direction");
      vt.setFlow("palette", "ocean");
    });
    await driver.waitForSync();

    // Only the two keys this test is about. `flowColor` also carries the
    // saturation and contrast the flow is drawn at, which the match brings
    // across as well, and asserting the whole object here would make every
    // colour setting added later look like a failure of this one.
    const flowColor = async () =>
      await driver.evaluate(() => {
        const { colorMode, palette } = (
          DSM.enabledPlugins["vector-tools"] as any
        ).flowColor;
        return { colorMode, palette };
      });

    // The arrows' half is open by default and the flow's is closed.
    expect(
      await driver.evaluate(() =>
        [
          ...document.querySelectorAll<HTMLDetailsElement>(
            ".dsm-vector-tools-menu details"
          ),
        ].map((section) => section.open)
      )
    ).toEqual([true, false]);

    expect(await flowColor()).toEqual({
      colorMode: "direction",
      palette: "ocean",
    });

    const toggle = ".dsm-vector-tools-match-colors input";
    await driver.click(toggle);
    await driver.waitForSync();
    expect(await flowColor()).toEqual({ colorMode: "speed", palette: "turbo" });

    // The point of the toggle. An earlier version copied the settings across
    // and then hid the button, so there was no way back and the flow's own
    // choices were gone; matching overrides instead, and turning it off puts
    // them back.
    await driver.click(toggle);
    await driver.waitForSync();
    expect(await flowColor()).toEqual({
      colorMode: "direction",
      palette: "ocean",
    });

    await driver.evaluate(() =>
      (DSM.enabledPlugins["vector-tools"] as any).resetConfig()
    );
    await driver.disablePlugin("vector-tools");
    await driver.setBlank();
    await driver.waitForSync();
  },
  90000
);

testWithPage(
  "Vector Tools generates a field that animates itself, off a renamed clock",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    await driver.assertSelectorEventually(BUTTON);
    await driver.click(BUTTON);

    await driver.evaluate(() => {
      const vt = DSM.enabledPlugins["vector-tools"] as any;
      vt.setSlot("p", "\\sin\\left(y+t\\right)");
      vt.setSlot("q", "x");
      vt.setArrowMode("off");
    });
    await driver.waitForFunction(
      () =>
        ((DSM.enabledPlugins["vector-tools"] as any).fieldAnimatesTime as
          | boolean
          | undefined) === true,
      { timeout: 8000 }
    );

    await driver.click(GENERATE);
    await driver.waitForSync();

    const graph = async () =>
      await driver.evaluate((ns: string) => {
        const state = Calc.getState() as any;
        const item = (id: string) =>
          state.expressions.list.find((i: any) => i.id === id)?.latex as
            | string
            | undefined;
        const analysis = (Calc as any).expressionAnalysis ?? {};
        return {
          pFunction: item(`${ns}_p_function`),
          clock: item(`${ns}_time`),
          ticker: (state.expressions.ticker?.handlerLatex ?? null) as
            | string
            | null,
          shaftsError: (analysis[`${ns}_shafts`]?.errorMessage ?? null) as
            | string
            | null,
          shaftsEvaluated:
            analysis[`${ns}_shafts`]?.evaluationDisplayed ?? null,
        };
      }, NAMESPACE);

    const generated = await graph();

    // `t` must not reach the graph. Defining a global `t` does not error — it
    // quietly stops the shafts being parametrics, and Desmos draws a point per
    // arrow instead of a segment. `evaluationDisplayed` turning true is the
    // only assertable trace of that; the rest of the difference is visual.
    expect(generated.pFunction).toContain("v_{tfdt}");
    expect(generated.shaftsError).toBeNull();
    expect(generated.shaftsEvaluated).not.toBe(true);
    expect(generated.ticker).toContain("\\operatorname{dt}");

    // The clock advances on its own, with no help from the extension.
    const before = generated.clock;
    await new Promise((resolve) => setTimeout(resolve, 900));
    expect((await graph()).clock).not.toBe(before);

    // The panel keeps showing what the user wrote, not the rewritten form.
    expect(
      await driver.evaluate(
        () => (DSM.enabledPlugins["vector-tools"] as any).getConfig().components
      )
    ).toMatchObject({ xLatex: "\\sin\\left(y+t\\right)" });

    // A ticker is graph-level, so removing the field has to take it away too.
    await driver.click(REMOVE);
    await driver.waitForSync();
    expect(
      await driver.evaluate(
        () => (Calc.getState() as any).expressions.ticker ?? null
      )
    ).toBeNull();

    await driver.evaluate(() =>
      (DSM.enabledPlugins["vector-tools"] as any).resetConfig()
    );
    await driver.disablePlugin("vector-tools");
    await driver.setBlank();
    await driver.waitForSync();
  },
  90000
);

testWithPage(
  "Vector Tools draws a parametric curve, and takes it away again",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    await driver.assertSelectorEventually(BUTTON);
    await driver.click(BUTTON);

    // A static field, so anything that moves is the curve's doing.
    await driver.evaluate(() => {
      const vt = DSM.enabledPlugins["vector-tools"] as any;
      vt.setArrowMode("off");
      vt.setCurve("enabled", true);
      vt.setCurve("xLatex", "3\\cos\\left(t\\right)");
      vt.setCurve("yLatex", "2\\sin\\left(t\\right)");
      vt.setCurve("showPoint", true);
    });
    await driver.waitForSync();
    await driver.click(GENERATE);
    await driver.waitForSync();

    const curve = async () =>
      await driver.evaluate((ns: string) => {
        const state = Calc.getState() as any;
        const item = (id: string) =>
          state.expressions.list.find((i: any) => i.id === id);
        const analysis = (Calc as any).expressionAnalysis ?? {};
        return {
          latex: item(`${ns}_curve`)?.latex as string | undefined,
          color: item(`${ns}_curve`)?.color as string | undefined,
          point: item(`${ns}_curve_point`)?.latex as string | undefined,
          clock: item(`${ns}_time`)?.latex as string | undefined,
          ticker: (state.expressions.ticker?.handlerLatex ?? null) as
            | string
            | null,
          error: (analysis[`${ns}_curve`]?.errorMessage ?? null) as
            | string
            | null,
          evaluated: analysis[`${ns}_curve`]?.evaluationDisplayed ?? null,
        };
      }, NAMESPACE);

    const drawn = await curve();
    // One parametric with its own `t`, which is only safe because a
    // time-varying field is rewritten off `t` first.
    expect(drawn.latex).toContain("\\le t\\le");
    expect(drawn.error).toBeNull();
    expect(drawn.evaluated).not.toBe(true);
    expect(drawn.color).toBe("#c74440");
    // The dot reads the same two functions at the clock, so it cannot drift off
    // the curve. Wanting it is also what gives a static field a clock at all.
    expect(drawn.point).toContain("v_{tfdt}");
    expect(drawn.ticker).toContain("\\operatorname{dt}");
    const before = drawn.clock;
    await new Promise((resolve) => setTimeout(resolve, 900));
    expect((await curve()).clock).not.toBe(before);

    // Switching the curve off has to remove both of its expressions on the next
    // generate. They are the plugin's own, so this is a removal rather than the
    // refusal a stray sharing the namespace would get.
    await driver.evaluate(() =>
      (DSM.enabledPlugins["vector-tools"] as any).setCurve("enabled", false)
    );
    await driver.waitForSync();
    await driver.click(GENERATE);
    await driver.waitForSync();
    const gone = await curve();
    expect(gone.latex).toBeUndefined();
    expect(gone.point).toBeUndefined();
    expect(gone.ticker).toBeNull();

    await driver.evaluate(() =>
      (DSM.enabledPlugins["vector-tools"] as any).resetConfig()
    );
    await driver.click(REMOVE);
    await driver.disablePlugin("vector-tools");
    await driver.setBlank();
    await driver.waitForSync();
  },
  90000
);

testWithPage(
  "Vector Tools can keep its colours through the graph's reverse contrast",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    await driver.assertSelectorEventually(BUTTON);
    await driver.click(BUTTON);

    const state = async () =>
      await driver.evaluate(() => {
        const vt = DSM.enabledPlugins["vector-tools"] as any;
        const canvas = document.getElementById("dsm-vector-tools-arrow-canvas");
        return {
          reversed: vt.graphReversesContrast as boolean,
          keep: vt.keepColorsInReverseContrast as boolean,
          filter: canvas === null ? null : canvas.style.filter,
        };
      });

    // Reverse contrast is `filter: invert(1)` on `.dcg-container`, an ancestor
    // of the overlay canvases, so the field inverts with the page by default.
    expect(await state()).toMatchObject({ reversed: false, filter: "" });

    // Ticking it while the graph is normal must do nothing visible: there is
    // no inversion to cancel yet.
    await driver.evaluate(() =>
      (
        DSM.enabledPlugins["vector-tools"] as any
      ).setKeepColorsInReverseContrast(true)
    );
    await driver.waitForSync();
    expect(await state()).toMatchObject({ keep: true, filter: "" });

    // With both true, the canvas is inverted a second time, which cancels the
    // ancestor's inversion and leaves a dark graph carrying the real colours.
    await driver.evaluate(() =>
      Calc.updateSettings({ invertedColors: true } as any)
    );
    await driver.waitForFunction(
      () =>
        document.getElementById("dsm-vector-tools-arrow-canvas")?.style
          .filter === "invert(1)",
      { timeout: 8000 }
    );
    expect(await state()).toMatchObject({ reversed: true, keep: true });

    // Untick, and the field goes back to inverting along with everything else.
    await driver.evaluate(() =>
      (
        DSM.enabledPlugins["vector-tools"] as any
      ).setKeepColorsInReverseContrast(false)
    );
    await driver.waitForSync();
    expect(await state()).toMatchObject({ reversed: true, filter: "" });

    await driver.evaluate(() =>
      Calc.updateSettings({ invertedColors: false } as any)
    );
    await driver.evaluate(() =>
      (DSM.enabledPlugins["vector-tools"] as any).resetConfig()
    );
    await driver.disablePlugin("vector-tools");
    await driver.setBlank();
    await driver.waitForSync();
  },
  90000
);

const ADD_FIELD = ".dsm-vector-tools-add-field";
const DELETE_FIELD = ".dsm-vector-tools-delete-field";
const FIELD_CHIPS = ".dsm-vector-tools-field-chips [data-field]";
const SAVE_FIELD = ".dsm-vector-tools-save-field";

testWithPage(
  "two saved fields generate into one graph without colliding",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    await driver.assertSelectorEventually(BUTTON);
    await driver.click(BUTTON);
    await driver.assertSelector(PANEL);
    await openTab(driver, "field");

    const chipNames = async () =>
      await driver.evaluate(
        (selector: string) =>
          [...document.querySelectorAll<HTMLElement>(selector)].map(
            (chip) => chip.innerText
          ),
        FIELD_CHIPS
      );

    expect(await chipNames()).toEqual(["Vector Field"]);
    await driver.click(GENERATE);
    await driver.waitForSync();

    // A second field, which must not be handed the first one's symbols.
    await driver.click(ADD_FIELD);
    await driver.waitForSync();
    expect(await chipNames()).toEqual(["Vector Field", "Vector Field 2"]);
    const library = await storedLibrary(driver);
    expect(
      library.fields.map((f: { symbolToken: string }) => f.symbolToken)
    ).toEqual(["d", "e"]);
    expect(library.activeId).toBe("field1");

    await driver.click(GENERATE);
    await driver.waitForSync();

    // The check this whole change exists for. Before the library, every field
    // emitted `v_{tfdp}` — which was invisible while only one field could
    // exist, and a duplicate-definition error the moment two could.
    const definitions = await driver.evaluate(() => {
      const counts: Record<string, number> = {};
      for (const item of Calc.getState().expressions.list) {
        const match = /^(v_\{tf[a-z]+\})\\left\(/.exec(
          (item as { latex?: string }).latex ?? ""
        );
        if (match) counts[match[1]] = (counts[match[1]] ?? 0) + 1;
      }
      return counts;
    });
    expect(definitions["v_{tfdp}"]).toBe(1);
    expect(definitions["v_{tfep}"]).toBe(1);
    expect(Object.values(definitions).every((count) => count === 1)).toBe(true);

    // Both folders are in the graph at once.
    const folders = async () =>
      (await driver.getState()).expressions.list
        .filter((item) => item.type === "folder")
        .map((item) => item.id);
    expect(await folders()).toEqual(
      expect.arrayContaining([FOLDER_ID, "vector_tools_vf_field1_folder"])
    );

    // Switching is by chip, and switching does not touch the graph.
    await driver.click(`${FIELD_CHIPS}[data-field="default"]`);
    await driver.waitForSync();
    expect((await storedLibrary(driver)).activeId).toBe("default");
    expect(await folders()).toEqual(
      expect.arrayContaining([FOLDER_ID, "vector_tools_vf_field1_folder"])
    );

    // Deleting a field takes its expressions with it, and leaves the other
    // field's alone — a field the user can no longer see is one they can no
    // longer press Remove on.
    await driver.click(`${FIELD_CHIPS}[data-field="field1"]`);
    await driver.waitForSync();
    await driver.click(DELETE_FIELD);
    await driver.waitForSync();
    expect(await chipNames()).toEqual(["Vector Field"]);
    const remaining = await folders();
    expect(remaining).toContain(FOLDER_ID);
    expect(remaining).not.toContain("vector_tools_vf_field1_folder");

    await driver.click(REMOVE);
    await driver.waitForSync();
    // Settings reach extension storage on a debounce, and `waitForSync` waits
    // for the evaluator rather than for that. A page closed before the flush
    // leaves the next one reading a stale setting — which it migrates and
    // writes, with that write in flight when some later test asserts that
    // nothing is pending.
    await driver.waitForFunction(() => !DSM.delaySetPluginSettings);
    await driver.disablePlugin("vector-tools");
    await driver.setBlank();
    await driver.waitForSync();
  },
  90000
);

testWithPage(
  "a setting saved before libraries existed keeps its field",
  async (driver) => {
    // The migration that matters: somebody who used this yesterday has one
    // field stored at the top level, and it has to come back as their field
    // rather than as a default one.
    await driver.enablePlugin("vector-tools");
    await driver.evaluate(() => {
      DSM.setPluginSetting(
        "vector-tools",
        "serializedFieldConfig",
        JSON.stringify({
          schemaVersion: 3,
          id: "default",
          name: "Saved before libraries",
          source: "components",
          components: { xLatex: "2y", yLatex: "-2x" },
          panel: { width: 470, height: 600, tab: "field" },
        })
      );
    });
    await driver.waitForSync();

    // Off and on again, because migration happens when the plugin starts. Doing
    // it here rather than letting it happen on the next page also leaves the
    // stored setting already migrated — a half-written setting left behind is a
    // settings write still in flight while some later test asserts that nothing
    // is pending, which is how this was found.
    await driver.disablePlugin("vector-tools");
    await driver.enablePlugin("vector-tools");
    await driver.waitForSync();
    await driver.assertSelectorEventually(BUTTON);
    await driver.click(BUTTON);
    await driver.assertSelector(PANEL);
    await openTab(driver, "field");

    const field = await storedConfig(driver);
    expect(field.name).toBe("Saved before libraries");
    // And the stored value is now a library, so nothing migrates it again.
    expect((await storedLibrary(driver)).schemaVersion).toBe(4);
    expect(field.components).toEqual({ xLatex: "2y", yLatex: "-2x" });
    // Its id and token address expressions already in the user's saved graphs.
    expect(field.id).toBe("default");
    expect(field.symbolToken).toBe("d");
    expect((await storedLibrary(driver)).panel.width).toBe(470);

    await driver.waitForFunction(() => !DSM.delaySetPluginSettings);
    await driver.disablePlugin("vector-tools");
    await driver.setBlank();
    await driver.waitForSync();
  },
  90000
);

/**
 * Puts the stored library back to its defaults.
 *
 * Plugin settings live in the extension's storage, which outlasts the page —
 * so a test that assumes a default field is really asserting on whatever the
 * test before it left behind. An unparseable value is the documented way back
 * to the defaults, which is exactly what is wanted here.
 */
async function resetLibrary(driver: Driver) {
  await driver.evaluate(() => {
    DSM.setPluginSetting("vector-tools", "serializedFieldConfig", "");
  });
  await driver.waitForSync();
}

testWithPage(
  "loading a gallery field recompiles the flow, not just its colours",
  async (driver) => {
    // The bug this is here for: the flow visualizer was told the new palette
    // and never the new field, so a preset repainted the picture while it went
    // on simulating the one before it. Options and the compiled field are
    // different things, and only `startFlow` rebuilds the second.
    await driver.enablePlugin("vector-tools");
    await resetLibrary(driver);
    await driver.assertSelectorEventually(BUTTON);
    await driver.click(BUTTON);
    await driver.assertSelector(PANEL);
    await openTab(driver, "flow");

    await driver.click(VISUALIZE);
    await driver.waitForFunction(() => DSM.vectorTools!.isFlowRunning);

    // What the running simulation was compiled from. Private, and read here
    // anyway: the alternative is asserting on pixels, and a test that cannot
    // tell a repaint from a rebuild is the test that missed this.
    const compiledFrom = async () =>
      await driver.evaluate(
        () =>
          (DSM.vectorTools as unknown as { lastFlowSignature?: string })
            .lastFlowSignature ?? ""
      );

    const before = await compiledFrom();
    expect(before).toContain("-y");

    await driver.evaluate(() => {
      DSM.vectorTools!.applyGalleryPreset("cellular", false);
    });
    // The rebuild is debounced, because it throws the particles away.
    await driver.waitForFunction(
      () =>
        (
          DSM.vectorTools as unknown as { lastFlowSignature?: string }
        ).lastFlowSignature?.includes("sin") === true
    );

    const after = await compiledFrom();
    expect(after).not.toBe(before);
    expect(after).toContain("cos");

    // And a change that only affects colour must not rebuild, or every tweak
    // of a slider would throw away the particles on screen.
    await driver.evaluate(() => {
      DSM.vectorTools!.setFlow("opacity", 0.7);
    });
    await driver.waitForSync();
    expect(await compiledFrom()).toBe(after);

    await driver.click(VISUALIZE);
    await driver.waitForFunction(() => !DSM.delaySetPluginSettings);
    await driver.disablePlugin("vector-tools");
    await driver.setBlank();
    await driver.waitForSync();
  },
  90000
);

testWithPage(
  "Save keeps a copy of the field and leaves you on it",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    await resetLibrary(driver);
    await driver.assertSelectorEventually(BUTTON);
    await driver.click(BUTTON);
    await driver.assertSelector(PANEL);
    await openTab(driver, "field");

    await driver.click(SAVE_FIELD);
    await driver.waitForSync();

    const library = await storedLibrary(driver);
    expect(library.fields).toHaveLength(2);
    expect(library.fields.map((f: { name: string }) => f.name)).toEqual([
      "Vector Field",
      "Vector Field 2",
    ]);
    // The point of a checkpoint is that it does not interrupt what you were
    // doing — Duplicate is the one that moves you onto the copy.
    expect(library.activeId).toBe("default");
    // And the copy gets symbols of its own, or generating both would define
    // the same name twice.
    expect(library.fields[1].symbolToken).not.toBe(
      library.fields[0].symbolToken
    );

    await driver.waitForFunction(() => !DSM.delaySetPluginSettings);
    await driver.disablePlugin("vector-tools");
    await driver.setBlank();
    await driver.waitForSync();
  },
  90000
);

testWithPage(
  "both canvases move to the side of the graph the setting names",
  async (driver) => {
    // The whole point of the setting is what Desmos draws on top of. Its
    // graph canvas is transparent wherever nothing has been drawn, so putting
    // the overlays before it in the DOM puts the grid, the axes and every
    // plotted function over the field instead of under it.
    //
    // And within a side the order still matters: the arrows have to stay over
    // the particles, or a dense flow buries the thing the arrows are for. The
    // two overlays mount independently, so that is asserted on both sides
    // rather than assumed from the order they happened to start in.
    await driver.enablePlugin("vector-tools");
    await resetLibrary(driver);
    await driver.assertSelectorEventually(BUTTON);
    await driver.click(BUTTON);
    await driver.assertSelector(PANEL);

    await openTab(driver, "flow");
    await driver.click(VISUALIZE);
    await driver.assertSelectorEventually(FLOW_CANVAS);
    await driver.assertSelectorEventually(ARROW_CANVAS);

    /** Each canvas's index among its siblings, so one read orders all three. */
    const order = async () =>
      await driver.evaluate(() => {
        const graph = document.querySelector("canvas.dcg-graph-inner")!;
        const siblings = [...graph.parentElement!.children];
        const at = (selector: string) =>
          siblings.indexOf(document.querySelector(selector)!);
        return {
          flow: at("#dsm-vector-tools-flow-canvas"),
          arrows: at("#dsm-vector-tools-arrow-canvas"),
          graph: siblings.indexOf(graph),
        };
      });

    const under = await order();
    expect(under.flow).toBeLessThan(under.arrows);
    expect(under.arrows).toBeLessThan(under.graph);

    await openTab(driver, "color");
    await driver.click("#dsm-vector-tools-overlay-layer [data-value='over']");
    await driver.waitForSync();

    const over = await order();
    expect(over.graph).toBeLessThan(over.flow);
    expect(over.flow).toBeLessThan(over.arrows);

    // And back, because a setting that only works once is a setting that has
    // to be found out about the hard way.
    await driver.click("#dsm-vector-tools-overlay-layer [data-value='under']");
    await driver.waitForSync();
    expect(await order()).toEqual(under);

    await openTab(driver, "flow");
    await driver.click(VISUALIZE);
    await driver.waitForFunction(() => !DSM.delaySetPluginSettings);
    await driver.disablePlugin("vector-tools");
    await driver.setBlank();
    await driver.waitForSync();
  },
  90000
);

testWithPage(
  "saturation and contrast reach the generated arrows too",
  async (driver) => {
    // The sliders would be a half-measure if they only moved the live
    // picture: switching the arrows to Desmos expressions would then change
    // the colours back, which reads as the expressions being wrong.
    await driver.enablePlugin("vector-tools");
    await resetLibrary(driver);
    await driver.assertSelectorEventually(BUTTON);
    await driver.click(BUTTON);
    await driver.assertSelector(PANEL);

    const colorList = async () =>
      await driver.evaluate(() => {
        const found = Calc.getState().expressions.list.find(
          (expression) => expression.id === "vector_tools_vf_default_colors"
        );
        return found !== undefined && "latex" in found
          ? (found.latex ?? "")
          : "";
      });

    await driver.click(GENERATE);
    await driver.waitForSync();
    const plain = await colorList();
    expect(plain).toContain("rgb");

    await driver.evaluate(() => {
      DSM.vectorTools?.setColor("saturation", 0);
    });
    await driver.click(GENERATE);
    await driver.waitForSync();
    const grey = await colorList();
    expect(grey).not.toBe(plain);
    // Saturation zero is grey, and grey is the same number in every channel,
    // so the rgb call's three arguments come out identical. They are split by
    // depth rather than by comma: each one is a sum of clamped segments, and
    // every segment contains commas of its own.
    const channels = rgbArguments(grey);
    expect(channels).toHaveLength(3);
    expect(channels[0]).toBe(channels[1]);
    expect(channels[1]).toBe(channels[2]);
    // And it really is the adjustment doing it, not an empty expression.
    expect(rgbArguments(plain)[0]).not.toBe(rgbArguments(plain)[2]);

    await driver.click(REMOVE);
    await driver.waitForFunction(() => !DSM.delaySetPluginSettings);
    await driver.disablePlugin("vector-tools");
    await driver.setBlank();
    await driver.waitForSync();
  },
  90000
);

/**
 * The three arguments of the `rgb(...)` a colour list is built from.
 *
 * Split on depth rather than on commas: each argument is a sum of clamped
 * segments, and `\min\left(1,\max\left(0,...` puts commas inside every one of
 * them. Depth counts Desmos's `\left(` and `\right)`, which is what the emitted
 * form actually uses.
 */
function rgbArguments(latex: string): string[] {
  const opening = "\\operatorname{rgb}\\left(";
  const from = latex.indexOf(opening);
  if (from < 0) return [];
  const body = latex.slice(from + opening.length);
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    if (body.startsWith("\\left(", i)) depth++;
    else if (body.startsWith("\\right)", i)) {
      if (depth === 0) {
        parts.push(body.slice(start, i));
        break;
      }
      depth--;
    } else if (body[i] === "," && depth === 0) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
  }
  return parts;
}
