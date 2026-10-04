import { testWithPage, type Driver } from "../../../tests/puppeteer-utils";
import type { Calc as CalcType } from "#globals";
import { PANEL_TABS } from "../model";

declare let Calc: CalcType;
declare let DSM: Window["DSM"];

const BUTTON = ".dsm-action-menu .dsm-icon-compass2";

/**
 * A Fluid tab test that leaves Vector Tools' stored settings as other tests
 * expect them, whether it passes or fails. Settings outlive the page: a fluid
 * test that failed before its own cleanup once left the arrows off and the box
 * stirring, and so failed two tests in another file that never touch the
 * fluid.
 */
function fluidTest(
  name: string,
  body: (driver: Driver) => Promise<void>,
  timeout: number
) {
  testWithPage(
    name,
    async (driver) => {
      try {
        await body(driver);
      } finally {
        await driver.evaluate(() => {
          const plugin = DSM.enabledPlugins["vector-tools"] as any;
          if (plugin === undefined) return;
          plugin.setFluid("mode", "off");
          if (plugin.flowOverlay.isRunning) plugin.toggleFlow();
          plugin.resetConfig();
          plugin.setPanelTab("field");
        });
        // Settings are written back to the extension after a delay; a page
        // that closes first loses the write, and the next test inherits it.
        await driver.page.waitForFunction(() => !DSM.delaySetPluginSettings);
        await driver.disablePlugin("vector-tools");
        await driver.setBlank();
      }
    },
    timeout
  );
}

/**
 * Gate 0 end to end, in real Desmos: the Fluid tab reads the graph's
 * inequalities, says which are solids and why the others are not, draws the
 * tank as the fluid will see it, runs its clock, and measures the GPU.
 */
fluidTest(
  "Fluid tab: solids, mask, clock and GPU check in a real graph",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    await driver.assertSelectorEventually(BUTTON);
    await driver.evaluate(() => {
      Calc.setExpressions([
        { id: "disc", latex: String.raw`\left(x+5\right)^{2}+y^{2}\le1` },
        { id: "root", latex: String.raw`y<\sqrt{x}-3` },
        { id: "undefinedName", latex: String.raw`y<a` },
        { id: "hiddenDisc", latex: String.raw`x^{2}+y^{2}<1`, hidden: true },
        { id: "curve", latex: String.raw`y=x^{2}` },
      ]);
    });
    await driver.waitForSync();
    await driver.click(BUTTON);
    const index = PANEL_TABS.findIndex((tab) => tab.id === "fluid");
    await driver.click(
      `.dsm-vector-tools-tabs .dcg-segmented-control-btn:nth-child(${index + 1})`
    );
    await driver.waitForSelector(".dsm-vector-tools-fluid-mask");

    // Every comparing row is listed with its verdict; the equation is not a
    // candidate at all, since a curve has no inside.
    const rows = await driver.evaluate(() =>
      [...document.querySelectorAll(".dsm-vector-tools-fluid-row-status")].map(
        (el) => (el as HTMLElement).innerText
      )
    );
    expect(rows).toEqual([
      "Solid.",
      "Solid.",
      expect.stringContaining('"a" is not defined'),
      "Hidden, so the fluid passes through it.",
    ]);

    // The mask, from the plugin itself: 300 × 120 cells of 1/15 graph unit.
    const mask = await driver.evaluate(() => {
      const plugin = DSM.enabledPlugins["vector-tools"] as any;
      const { mask, nx, ny } = plugin.fluid.mask;
      const cell = (x: number, y: number) =>
        mask.cells[Math.floor((y + 4) * 15) * nx + Math.floor((x + 10) * 15)];
      return {
        nx,
        ny,
        solid: mask.solidCount,
        undefinedCount: mask.undefinedCount,
        discCentre: cell(-5, 0),
        hiddenCentre: cell(0.01, 0.01),
        belowRoot: cell(9, -3.5),
        aboveRoot: cell(9, 1),
        leftOfRoot: cell(-2, -3.9),
      };
    });
    expect([mask.nx, mask.ny]).toEqual([300, 120]);
    expect(mask.discCentre).toBe(1);
    expect(mask.hiddenCentre).toBe(0);
    expect(mask.belowRoot).toBe(1);
    expect(mask.aboveRoot).toBe(0);
    // √x is undefined for x < 0: never solid, reported as undefined.
    expect(mask.leftOfRoot).toBe(2);
    // The left half, less the disc it contains (π / (1/15)² ≈ 707 cells).
    expect(mask.undefinedCount).toBeGreaterThan(150 * 120 - 760);
    expect(mask.undefinedCount).toBeLessThan(150 * 120 - 660);
    // The disc plus ∫₀¹⁰ (√x − 3 + 4) dx = 10 + 2/3·10^1.5 ≈ 31.1 units².
    const expectedSolid = Math.PI * 225 + (10 + (2 / 3) * 10 ** 1.5) * 225;
    expect(Math.abs(mask.solid - expectedSolid) / expectedSolid).toBeLessThan(
      0.02
    );

    // Switching a fluid on starts the clock and measures the GPU.
    await driver.click(
      '#dsm-vector-tools-fluid-mode [data-value="windTunnel"]'
    );
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const clock = await driver.evaluate(() => {
      const plugin = DSM.enabledPlugins["vector-tools"] as any;
      return {
        steps: plugin.fluid.readout.totalSteps,
        seconds: plugin.fluid.readout.simulatedSeconds,
        text: document.querySelector<HTMLElement>(
          ".dsm-vector-tools-fluid-clock"
        )!.innerText,
        gpu: document.querySelector<HTMLElement>(".dsm-vector-tools-fluid-gpu")!
          .innerText,
        ready: plugin.fluid.capabilities.ready,
        problems: plugin.fluid.capabilities.problems,
        stored: JSON.parse(
          DSM.pluginSettings["vector-tools"]!.serializedFieldConfig as string
        ).fields[0].fluid.mode,
      };
    });
    expect(clock.steps).toBeGreaterThan(0);
    expect(clock.seconds).toBeGreaterThan(0);
    expect(clock.text).toMatch(/^t = /);
    expect(clock.problems).toEqual([]);
    expect(clock.ready).toBe(true);
    expect(clock.gpu).toMatch(/^Ready\./);
    expect(clock.stored).toBe("windTunnel");

    await driver.evaluate(() =>
      document
        .querySelector(".dsm-vector-tools-fluid-mask")
        ?.scrollIntoView({ block: "center" })
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    await driver.page.screenshot({ path: "docs/assets/fluid-gate0-tab.png" });

    await driver.click('#dsm-vector-tools-fluid-mode [data-value="off"]');
  },
  90000
);

/**
 * The wind tunnel, live: a cylinder typed into the graph sheds a vortex
 * street on the GPU in real time, and the tab reports its drag, lift and
 * Strouhal number. The cylinder blocks a quarter of a slip-walled tank, which
 * raises both above the unconfined values (St 0.164, C_D 1.33); the mock-up
 * measured St 0.197 at a sixth.
 */
fluidTest(
  "Fluid tab: a cylinder in the wind tunnel sheds, and is measured",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    await driver.assertSelectorEventually(BUTTON);
    await driver.evaluate(() => {
      Calc.setMathBounds({ left: -11, right: 11, bottom: -6, top: 6 });
      Calc.setExpressions([
        {
          id: "cylinder",
          latex: String.raw`\left(x+6\right)^{2}+y^{2}\le1`,
          color: "#2d70b3",
        },
      ]);
      const plugin = DSM.enabledPlugins["vector-tools"] as any;
      // The field's own arrows would cover the fluid in the picture.
      plugin.setArrowMode("off");
      plugin.setFluid("referenceLength", 2);
      // Four times the default inflow, so the flow develops in seconds.
      plugin.setFluid("inflowSpeed", 8);
      plugin.setFluid("mode", "windTunnel");
    });
    await driver.click(BUTTON);
    const index = PANEL_TABS.findIndex((tab) => tab.id === "fluid");
    await driver.click(
      `.dsm-vector-tools-tabs .dcg-segmented-control-btn:nth-child(${index + 1})`
    );
    await driver.waitForFunction(
      () => {
        const { fluid } = DSM.enabledPlugins["vector-tools"] as any;
        return fluid.measurements[0]?.strouhal !== undefined;
      },
      { timeout: 60000, polling: 500 }
    );
    // The panel redraws its readouts four times a second, so its text can be
    // a quarter of a second behind the measurement just read.
    await driver.waitForFunction(
      () =>
        (
          document.querySelector<HTMLElement>(
            ".dsm-vector-tools-fluid-row-status"
          )?.innerText ?? ""
        ).includes("Shedding at St"),
      { timeout: 5000, polling: 100 }
    );
    const state = await driver.evaluate(() => {
      const { fluid } = DSM.enabledPlugins["vector-tools"] as any;
      return {
        simulating: fluid.isSimulating,
        realTime: fluid.readout.realTimeFactor,
        mach: fluid.mach,
        measured: fluid.measurements[0],
        status: document.querySelector<HTMLElement>(
          ".dsm-vector-tools-fluid-row-status"
        )!.innerText,
      };
    });
    expect(state.simulating).toBe(true);
    // The tab measured its own Mach number and kept it in the envelope.
    expect(state.mach).toBeLessThan(0.3);
    expect(state.measured.settled).toBe(true);
    expect(state.measured.strouhal).toBeGreaterThan(0.18);
    expect(state.measured.strouhal).toBeLessThan(0.3);
    expect(state.measured.drag).toBeGreaterThan(1.5);
    expect(state.measured.drag).toBeLessThan(3);
    expect(state.status).toMatch(
      /drag C_D [\d.]+, lift C_L -?[\d.]+\. Shedding at St [\d.]+/
    );

    // Writing the measurements into the graph. A name the user already
    // defines is refused with a reason, never overwritten.
    await driver.evaluate(() => {
      Calc.setExpression({ id: "users", latex: "C_{D1}=5" });
      (DSM.enabledPlugins["vector-tools"] as any).setFluid("writeback", true);
    });
    await driver.waitForFunction(
      () =>
        (DSM.enabledPlugins["vector-tools"] as any).fluid.writebackProblem !==
        "",
      { timeout: 5000 }
    );
    expect(
      await driver.evaluate(
        () => (DSM.enabledPlugins["vector-tools"] as any).fluid.writebackProblem
      )
    ).toContain("C_{D1}");
    expect(
      await driver.evaluate(() =>
        Calc.getState().expressions.list.some((item) =>
          item.id.startsWith("vector_tools_fluid_")
        )
      )
    ).toBe(false);

    await driver.evaluate(() => Calc.removeExpression({ id: "users" }));
    await driver.waitForFunction(
      () =>
        Calc.getState().expressions.list.some(
          (item) => item.id === "vector_tools_fluid_st_1"
        ),
      { timeout: 5000 }
    );
    // Desmos evaluates what was written, and it is what the tab measured.
    const written = await driver.evaluate(async () => {
      const { fluid } = DSM.enabledPlugins["vector-tools"] as any;
      const read = async (latex: string) =>
        await new Promise<number>((resolve) => {
          const helper = Calc.HelperExpression({ latex }) as unknown as {
            numericValue: number;
            observe: (event: string, callback: () => void) => void;
          };
          helper.observe("numericValue", () => resolve(helper.numericValue));
          setTimeout(() => resolve(helper.numericValue), 2000);
        });
      return {
        drag: await read("C_{D1}"),
        strouhal: await read("S_{t1}"),
        measured: fluid.measurements[0],
      };
    });
    expect(written.drag).toBeCloseTo(written.measured.drag, 1);
    expect(written.strouhal).toBeCloseTo(written.measured.strouhal, 2);

    // Unticking takes out exactly what was written.
    await driver.evaluate(() =>
      (DSM.enabledPlugins["vector-tools"] as any).setFluid("writeback", false)
    );
    await driver.waitForFunction(
      () =>
        !Calc.getState().expressions.list.some((item) =>
          item.id.startsWith("vector_tools_fluid_")
        ),
      { timeout: 5000 }
    );
    expect(
      await driver.evaluate(() =>
        Calc.getState().expressions.list.map((item) => item.id)
      )
    ).toEqual(["cylinder"]);

    // Evidence: the panel at the measured solid, then the graph without it.
    await driver.evaluate(() =>
      document
        .querySelector(".dsm-vector-tools-fluid-row")
        ?.scrollIntoView({ block: "start" })
    );
    const panel = await driver.page.$(".dsm-vector-tools-menu");
    await panel!.screenshot({
      path: "docs/assets/fluid-wind-tunnel-panel.png",
    });
    await driver.click(BUTTON);
    await new Promise((resolve) => setTimeout(resolve, 500));
    await driver.page.screenshot({ path: "docs/assets/fluid-wind-tunnel.png" });
  },
  120000
);

/**
 * The stirred box: the field's own P and Q push a closed box of fluid. A
 * rotational field stirs it; a gradient field of the same strength barely
 * moves it, because pressure answers the part of a push that spreads. That
 * is Helmholtz and Hodge's decomposition, measured.
 */
fluidTest(
  "Fluid tab: the stirred box keeps a field's curl and answers its gradient with pressure",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    await driver.assertSelectorEventually(BUTTON);
    const meanSpeed = async () =>
      await driver.evaluate(() => {
        const { fluid } = DSM.enabledPlugins["vector-tools"] as any;
        const lattice = fluid.overlay.current;
        const { ux, uy } = lattice.readMacro();
        let sum = 0;
        for (let k = 0; k < ux.length; k++) sum += Math.hypot(ux[k], uy[k]);
        return sum / ux.length;
      });
    const runWith = async (p: string, q: string) => {
      await driver.evaluate(
        (p: string, q: string) => {
          const plugin = DSM.enabledPlugins["vector-tools"] as any;
          plugin.setSlot("p", p);
          plugin.setSlot("q", q);
          plugin.fluid.restart();
        },
        p,
        q
      );
      // Six seconds of flow, not of wall clock: on a loaded machine the
      // lattice runs slower than real time, and a fixed wait would measure a
      // younger, less settled flow (6.5% where 2% is typical).
      await driver.waitForFunction(
        () =>
          (DSM.enabledPlugins["vector-tools"] as any).fluid.readout
            .simulatedSeconds >= 6,
        { timeout: 60000, polling: 50 }
      );
      return await meanSpeed();
    };
    await driver.evaluate(() => {
      Calc.setMathBounds({ left: -11, right: 11, bottom: -6, top: 6 });
      const plugin = DSM.enabledPlugins["vector-tools"] as any;
      plugin.setArrowMode("off");
      plugin.setFluid("inflowSpeed", 4);
      plugin.setFluid("show", "speed");
      plugin.setFluid("mode", "stirredBox");
    });
    const curl = await runWith("-y", "x");
    await driver.page.screenshot({ path: "docs/assets/fluid-stirred-box.png" });
    const gradient = await runWith("x", "y");
    expect(curl).toBeGreaterThan(0.005);
    expect(gradient).toBeLessThan(0.05 * curl);
  },
  120000
);

/**
 * The particles and arrows draw the flow while a fluid runs (brief §8.0), and
 * the field's formula again when it stops. The arrows keep redrawing as the
 * flow moves: inserting the fluid's canvas moves theirs in the DOM, and an
 * overlay that read the first of the visibility observer's entries thought
 * itself hidden and stopped drawing for good.
 */
fluidTest(
  "Fluid tab: the particles and arrows follow the flow, and give it back",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    await driver.assertSelectorEventually(BUTTON);
    await driver.evaluate(() => {
      Calc.setMathBounds({ left: -11, right: 11, bottom: -6, top: 6 });
      Calc.setExpressions([
        {
          id: "cylinder",
          latex: String.raw`\left(x+6\right)^{2}+y^{2}\le1`,
          color: "#2d70b3",
        },
      ]);
      const plugin = DSM.enabledPlugins["vector-tools"] as any;
      plugin.setFluid("referenceLength", 2);
      plugin.setFluid("inflowSpeed", 8);
      plugin.setFluid("mode", "windTunnel");
      plugin.toggleFlow();
    });
    await new Promise((resolve) => setTimeout(resolve, 8000));
    const running = await driver.evaluate(async () => {
      const plugin = DSM.enabledPlugins["vector-tools"] as any;
      const { renderer } = plugin.arrowOverlay;
      let frames = 0;
      const frame = renderer.frame.bind(renderer);
      renderer.frame = () => {
        frames++;
        frame();
      };
      await new Promise((resolve) => setTimeout(resolve, 1000));
      renderer.frame = frame;
      return {
        drawn: plugin.flowAvailability.field?.kind,
        arrowsDrawn: plugin.arrowOverlay.renderer.linkedField?.kind,
        flowDrawn: plugin.flowOverlay.lastField?.kind,
        arrowFrames: frames,
      };
    });
    expect(running).toMatchObject({
      drawn: "sampled",
      arrowsDrawn: "sampled",
      flowDrawn: "sampled",
    });
    expect(running.arrowFrames).toBeGreaterThan(10);
    await driver.page.screenshot({
      path: "docs/assets/fluid-particles-and-arrows.png",
    });

    await driver.evaluate(() =>
      (DSM.enabledPlugins["vector-tools"] as any).setFluid("mode", "off")
    );
    await new Promise((resolve) => setTimeout(resolve, 600));
    const stopped = await driver.evaluate(() => {
      const plugin = DSM.enabledPlugins["vector-tools"] as any;
      return {
        drawn: plugin.flowAvailability.field?.kind,
        arrowsDrawn: plugin.arrowOverlay.renderer.linkedField?.kind,
      };
    });
    expect(stopped).toEqual({ drawn: "components", arrowsDrawn: "components" });
  },
  120000
);

/**
 * The Fluid tab reads a slider's value while Desmos redraws it, and reading
 * one the first time means making a helper, which dispatches. Desmos throws on
 * a dispatch inside a dispatch, so typing a solid that read a new slider broke
 * every later redraw, and Vector Tools would not open again.
 */
fluidTest(
  "Fluid tab: a solid reading a new slider leaves the panel working",
  async (driver) => {
    const errors: string[] = [];
    driver.page.on("pageerror", (error) => errors.push(String(error)));
    await driver.enablePlugin("vector-tools");
    await driver.assertSelectorEventually(BUTTON);
    await driver.click(BUTTON);
    const index = PANEL_TABS.findIndex((tab) => tab.id === "fluid");
    await driver.click(
      `.dsm-vector-tools-tabs .dcg-segmented-control-btn:nth-child(${index + 1})`
    );
    await driver.waitForSelector(".dsm-vector-tools-fluid-mask");
    await driver.evaluate(() => {
      Calc.setExpressions([
        {
          id: "disc",
          latex: String.raw`\left(x-a\right)^{2}+\left(y-b\right)^{2}\le R^{2}`,
        },
        { id: "point", latex: String.raw`f=\left(a,b\right)` },
        { id: "a", latex: "a=-6.54" },
        { id: "b", latex: "b=3.8" },
        { id: "R", latex: "R=0.2" },
      ]);
    });
    await driver.waitForSync();
    // A redraw after the helpers exist, then closed and opened again.
    await driver.evaluate(() => Calc.setExpression({ id: "a", latex: "a=-6" }));
    await driver.waitForSync();
    await driver.click(BUTTON);
    await driver.assertSelectorNot(".dsm-vector-tools-menu");
    await driver.click(BUTTON);
    await driver.waitForSelector(".dsm-vector-tools-fluid-mask");
    const status = await driver.evaluate(
      () =>
        document.querySelector<HTMLElement>(
          ".dsm-vector-tools-fluid-row-status"
        )?.innerText
    );
    expect(errors).toEqual([]);
    expect(status).toContain("moves with its sliders");
  },
  60000
);

/**
 * A moving solid that covers part of the inlet. The inlet used to blow into it
 * as into fluid; the solid's collision took the momentum away but kept the
 * mass, so the solid filled until the fluid burst out of its sides and Auto
 * restarted the lattice, and then gave up. Particles also drifted inside it.
 */
fluidTest(
  "Fluid tab: a moving solid across the inlet takes no fluid in",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    await driver.assertSelectorEventually(BUTTON);
    await driver.evaluate(() => {
      Calc.setMathBounds({ left: -11, right: 11, bottom: -6, top: 6 });
      Calc.setExpressions([
        { id: "slider", latex: "a=0" },
        // x ≤ −y²: the left edge is inside it for |y| < √10, most of the inlet.
        { id: "cup", latex: String.raw`x+a\le-y^{2}` },
      ]);
      const plugin = DSM.enabledPlugins["vector-tools"] as any;
      plugin.setArrowMode("off");
      plugin.setFluid("mode", "windTunnel");
    });
    await driver.waitForFunction(
      () => (DSM.enabledPlugins["vector-tools"] as any).fluid.isSimulating,
      { timeout: 20000 }
    );
    // Kept moving, a little, so it stays partially saturated cells rather
    // than being parked as a fixed solid.
    await driver.evaluate(() => {
      // Every frame, as a drag reports.
      const start = performance.now();
      const frame = () => {
        // From rest, so the first frames do not jump.
        const a = 0.2 * (1 - Math.cos((performance.now() - start) / 400));
        Calc.setExpression({ id: "slider", latex: `a=${a.toFixed(4)}` });
        (window as any).cupFrame = requestAnimationFrame(frame);
      };
      frame();
    });
    await driver.waitForFunction(
      () =>
        (DSM.enabledPlugins["vector-tools"] as any).fluid.readout
          .simulatedSeconds >= 8,
      { timeout: 90000, polling: 250 }
    );
    const result = await driver.evaluate(() => {
      cancelAnimationFrame((window as any).cupFrame);
      const { fluid } = DSM.enabledPlugins["vector-tools"] as any;
      const { coverage } = fluid.moving.solids;
      const { deltaRho, ux } = fluid.overlay.current.readMacro();
      let inside = 0;
      let insideRho = 0;
      let outsidePeak = 0;
      for (let k = 0; k < coverage.length; k++) {
        if (coverage[k] >= 1) {
          inside++;
          insideRho = Math.max(insideRho, Math.abs(deltaRho[k]));
        } else if (coverage[k] === 0) {
          outsidePeak = Math.max(outsidePeak, Math.abs(deltaRho[k]));
        }
      }
      return {
        inside,
        insideRho,
        outsidePeak,
        fluidSpeed: Math.max(...ux.map(Math.abs)),
        notice: fluid.notice,
        simulating: fluid.isSimulating,
      };
    });
    // Before the fix the lattice had blown up and stopped by now.
    expect(result.simulating).toBe(true);
    expect(result.notice).toBe("");
    expect(result.inside).toBeGreaterThan(5000);
    // The gap past the cup is a fifth of the inlet, so the fluid is pushed
    // hard there; the inside holds no more pressure than the fluid around it.
    expect(result.insideRho).toBeLessThan(1.1 * result.outsidePeak);
    expect(result.fluidSpeed).toBeLessThan(0.3 / Math.sqrt(3));
  },
  150000
);

/**
 * Gate 6 in the tab: a solid whose inequality reads a slider moves through the
 * fluid as partially saturated cells. Sliding it, the fluid inside goes with
 * it at the speed the slider sets, the row says it moves, and its forces are
 * marked provisional while it does.
 */
fluidTest(
  "Fluid tab: a disc a slider moves carries the fluid with it",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    await driver.assertSelectorEventually(BUTTON);
    await driver.evaluate(() => {
      Calc.setMathBounds({ left: -11, right: 11, bottom: -6, top: 6 });
      Calc.setExpressions([
        { id: "slider", latex: "a=-6" },
        {
          id: "disc",
          latex: String.raw`\left(x-a\right)^{2}+y^{2}\le1`,
          color: "#2d70b3",
        },
      ]);
      const plugin = DSM.enabledPlugins["vector-tools"] as any;
      plugin.setArrowMode("off");
      plugin.setFluid("referenceLength", 2);
      plugin.setFluid("inflowSpeed", 8);
      plugin.setFluid("show", "speed");
      plugin.setFluid("mode", "windTunnel");
    });
    await driver.waitForFunction(
      () => (DSM.enabledPlugins["vector-tools"] as any).fluid.isSimulating,
      { timeout: 20000 }
    );
    await new Promise((resolve) => setTimeout(resolve, 2000));
    // At rest it starts parked, a fixed solid, until the slider moves.
    expect(
      await driver.evaluate(() => {
        const { fluid } = DSM.enabledPlugins["vector-tools"] as any;
        return {
          moving: fluid.moving !== undefined,
          solid: fluid.spec.solid.some((v: number) => v === 1),
        };
      })
    ).toEqual({ moving: false, solid: true });
    // Slide a from −6 to −2 over two seconds, 2 graph units a second, and
    // sample halfway: the fluid in the disc's fully covered cells against the
    // wall velocity the tab gave them. The wall velocity is also read every
    // frame through the middle second, since Desmos reports a dragged slider
    // only every frame or two and the walls must not stutter with it.
    const sliding = await driver.evaluate(async () => {
      const { fluid } = DSM.enabledPlugins["vector-tools"] as any;
      const start = performance.now();
      let sample: any;
      const walls: number[] = [];
      const wallSpeed = () => {
        const { solids } = fluid.moving;
        let sum = 0;
        let n = 0;
        for (let k = 0; k < solids.coverage.length; k++) {
          if (solids.coverage[k] < 1) continue;
          sum += solids.velocity[2 * k];
          n++;
        }
        return sum / n;
      };
      await new Promise<void>((resolve) => {
        const frame = () => {
          const elapsed = (performance.now() - start) / 1000;
          const a = -6 + 2 * Math.min(elapsed, 2);
          Calc.setExpression({ id: "slider", latex: `a=${a.toFixed(4)}` });
          if (elapsed > 0.5 && elapsed < 1.5) walls.push(wallSpeed());
          if (sample === undefined && elapsed > 1) {
            const { solids } = fluid.moving;
            const { ux, uy } = fluid.overlay.current.readMacro();
            let fluidX = 0;
            let wallX = 0;
            let fluidY = 0;
            let n = 0;
            for (let k = 0; k < solids.coverage.length; k++) {
              if (solids.coverage[k] < 1) continue;
              fluidX += ux[k];
              fluidY += uy[k];
              wallX += solids.velocity[2 * k];
              n++;
            }
            const [measured] = fluid.measurements;
            sample = {
              cells: n,
              fluidX: fluidX / n,
              fluidY: fluidY / n,
              wallX: wallX / n,
              teleported: solids.teleported,
              note: measured?.sheddingNote,
              settled: measured?.settled,
              mach: fluid.mach,
            };
          }
          if (elapsed < 2) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
      });
      return { ...sample, walls };
    });
    // Steady through the middle second: no frame at rest, none at double.
    const meanWall =
      sliding.walls.reduce((s: number, v: number) => s + v, 0) /
      sliding.walls.length;
    expect(sliding.walls.length).toBeGreaterThan(20);
    expect(Math.min(...sliding.walls)).toBeGreaterThan(0.7 * meanWall);
    expect(Math.max(...sliding.walls)).toBeLessThan(1.3 * meanWall);
    expect(sliding.cells).toBeGreaterThan(20);
    expect(sliding.teleported).toBe(false);
    // 2 graph units a second, at 8 for the inflow: a quarter of the inflow's
    // lattice speed, whichever speed Auto chose.
    expect(sliding.wallX).toBeGreaterThan(0.005);
    expect(Math.abs(sliding.fluidX / sliding.wallX - 1)).toBeLessThan(0.1);
    expect(Math.abs(sliding.fluidY)).toBeLessThan(0.1 * sliding.wallX);
    expect(sliding.settled).toBe(false);
    expect(sliding.note).toContain("moving");
    expect(sliding.mach).toBeLessThan(0.3);

    // Stopped, it is parked: a fixed solid where the slider left it, with
    // interpolated walls, no partially saturated cells, and no fluid inside.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const stopped = await driver.evaluate(() => {
      const { fluid } = DSM.enabledPlugins["vector-tools"] as any;
      const { nx, solid, psm } = fluid.spec;
      const { tank } = (DSM.enabledPlugins["vector-tools"] as any).getConfig()
        .fluid;
      let sum = 0;
      let n = 0;
      for (let k = 0; k < solid.length; k++) {
        if (solid[k] !== 1) continue;
        sum += k % nx;
        n++;
      }
      const dx = (tank.xMax - tank.xMin) / nx;
      return {
        moving: fluid.moving !== undefined,
        psm: psm !== undefined,
        cells: n,
        cellArea: dx * dx,
        centreX: tank.xMin + (sum / n + 0.5) * dx,
      };
    });
    expect(stopped.moving).toBe(false);
    expect(stopped.psm).toBe(false);
    expect(stopped.centreX).toBeCloseTo(-2, 1);
    // π · 1², in cells.
    expect(stopped.cells * stopped.cellArea).toBeCloseTo(Math.PI, 1);
    await driver.page.screenshot({
      path: "docs/assets/fluid-moving-solid.png",
    });
  },
  120000
);

/**
 * A moving solid's samples come from the GPU while the fluid runs
 * (`obstacleSampler.ts`), and the CPU's are the reference: same definedness,
 * the same signed function to float32, the same gradient wherever the CPU
 * takes one, and the same cells built from either.
 */
fluidTest(
  "Fluid tab: moving solids sampled on the GPU match the CPU",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    await driver.assertSelectorEventually(BUTTON);
    await driver.evaluate(() => {
      Calc.setExpressions([
        { id: "a", latex: "a=-3.3" },
        { id: "b", latex: "b=0.4" },
        {
          id: "disc",
          latex: String.raw`\left(x-a\right)^{2}+\left(y-b\right)^{2}\le1.2`,
        },
        // Undefined left of x = a: a wall there is only definedness.
        { id: "root", latex: String.raw`y<\sqrt{x-a}-2` },
        {
          id: "restricted",
          latex: String.raw`x^{2}+y^{2}\le4\left\{x>b\right\}`,
        },
      ]);
      const plugin = DSM.enabledPlugins["vector-tools"] as any;
      plugin.setArrowMode("off");
      plugin.setFluid("mode", "windTunnel");
    });
    // Running, and with all three rows read: the lattice can start before the
    // last row typed is.
    await driver.waitForFunction(
      () => {
        const { fluid } = DSM.enabledPlugins["vector-tools"] as any;
        return fluid.isSimulating && fluid.activeObstacles.length === 3;
      },
      { timeout: 20000 }
    );
    const { partialSolidsFromSamples } = await import(
      "../../../field-rendering/sim/movingSolids"
    );
    for (const rowId of ["disc", "root", "restricted"]) {
      const result = await driver.evaluate(
        async (id: string) =>
          await (
            DSM.enabledPlugins["vector-tools"] as any
          ).fluid.sampleRowBothWays(id, { a: -3.27, b: 0.43 }),
        rowId
      );
      const { grid } = result;
      const back = (list: (number | null)[]) =>
        Float32Array.from(list, (v) => v ?? NaN);
      const gpu = {
        signed: back(result.gpu.signed),
        gradient: back(result.gpu.gradient),
      };
      const cpu = {
        signed: back(result.cpu.signed),
        gradient: back(result.cpu.gradient),
      };
      let definedness = 0;
      let worstSigned = 0;
      let worstSlope = 0;
      for (let k = 0; k < cpu.signed.length; k++) {
        const c = cpu.signed[k];
        const g = gpu.signed[k];
        // A centre within float32 rounding of the edge of definedness may
        // land either side.
        if (Number.isNaN(c) !== Number.isNaN(g)) {
          definedness++;
          continue;
        }
        if (Number.isNaN(c)) continue;
        worstSigned = Math.max(
          worstSigned,
          Math.abs(c - g) / Math.max(1, Math.abs(c))
        );
        for (const n of [2 * k, 2 * k + 1]) {
          const cs = cpu.gradient[n];
          if (Number.isNaN(cs) || Number.isNaN(gpu.gradient[n])) continue;
          worstSlope = Math.max(
            worstSlope,
            Math.abs(cs - gpu.gradient[n]) / Math.max(1, Math.abs(cs))
          );
        }
      }
      const build = (samples: typeof cpu) =>
        partialSolidsFromSamples([{ body: 1, samples }], grid);
      const fromCpu = build(cpu);
      const fromGpu = build(gpu);
      let worstCoverage = 0;
      for (let k = 0; k < fromCpu.coverage.length; k++)
        worstCoverage = Math.max(
          worstCoverage,
          Math.abs(fromCpu.coverage[k] - fromGpu.coverage[k])
        );
      const areaCpu = fromCpu.area.get(1) ?? 0;
      const areaGpu = fromGpu.area.get(1) ?? 0;
      expect({ rowId, definednessOff: definedness <= 2 }).toEqual({
        rowId,
        definednessOff: true,
      });
      expect(worstSigned).toBeLessThan(1e-5);
      expect(worstSlope).toBeLessThan(1e-3);
      expect(worstCoverage).toBeLessThan(1e-3);
      expect(areaCpu).toBeGreaterThan(50);
      expect(Math.abs(areaGpu - areaCpu) / areaCpu).toBeLessThan(1e-4);
    }
  },
  60000
);
