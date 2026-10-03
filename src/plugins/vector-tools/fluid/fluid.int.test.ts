import { testWithPage } from "../../../tests/puppeteer-utils";
import type { Calc as CalcType } from "#globals";
import { PANEL_TABS } from "../model";

declare let Calc: CalcType;
declare let DSM: Window["DSM"];

const BUTTON = ".dsm-action-menu .dsm-icon-compass2";

/**
 * Gate 0 end to end, in real Desmos: the Fluid tab reads the graph's
 * inequalities, says which are solids and why the others are not, draws the
 * tank as the fluid will see it, runs its clock, and measures the GPU.
 */
testWithPage(
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
    // Leave the stored settings as other tests expect them: the panel opens
    // on its first tab, and the field holds its defaults.
    await driver.evaluate(() => {
      const plugin = DSM.enabledPlugins["vector-tools"] as any;
      plugin.resetConfig();
      plugin.setPanelTab("field");
    });
    // Settings are written back to the extension after a delay; a page that
    // closes first loses the write, and the next test inherits this one's.
    await driver.page.waitForFunction(() => !DSM.delaySetPluginSettings);
    await driver.disablePlugin("vector-tools");
    await driver.setBlank();
    await driver.waitForSync();
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
testWithPage(
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
    await driver.evaluate(() => {
      const plugin = DSM.enabledPlugins["vector-tools"] as any;
      plugin.setFluid("mode", "off");
      plugin.setArrowMode("live");
    });
    // Leave the stored settings as other tests expect them: the panel opens
    // on its first tab, and the field holds its defaults.
    await driver.evaluate(() => {
      const plugin = DSM.enabledPlugins["vector-tools"] as any;
      plugin.resetConfig();
      plugin.setPanelTab("field");
    });
    // Settings are written back to the extension after a delay; a page that
    // closes first loses the write, and the next test inherits this one's.
    await driver.page.waitForFunction(() => !DSM.delaySetPluginSettings);
    await driver.disablePlugin("vector-tools");
    await driver.setBlank();
  },
  120000
);

/**
 * The stirred box: the field's own P and Q push a closed box of fluid. A
 * rotational field stirs it; a gradient field of the same strength barely
 * moves it, because pressure answers the part of a push that spreads. That
 * is Helmholtz and Hodge's decomposition, measured.
 */
testWithPage(
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
      await new Promise((resolve) => setTimeout(resolve, 6000));
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

    await driver.evaluate(() => {
      const plugin = DSM.enabledPlugins["vector-tools"] as any;
      plugin.setFluid("mode", "off");
      plugin.resetConfig();
      plugin.setPanelTab("field");
    });
    await driver.page.waitForFunction(() => !DSM.delaySetPluginSettings);
    await driver.disablePlugin("vector-tools");
    await driver.setBlank();
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
testWithPage(
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

    await driver.evaluate(() => {
      const plugin = DSM.enabledPlugins["vector-tools"] as any;
      if (plugin.flowOverlay.isRunning) plugin.toggleFlow();
      plugin.resetConfig();
      plugin.setPanelTab("field");
    });
    await driver.page.waitForFunction(() => !DSM.delaySetPluginSettings);
    await driver.disablePlugin("vector-tools");
    await driver.setBlank();
  },
  120000
);

/**
 * Gate 6 in the tab: a solid whose inequality reads a slider moves through the
 * fluid as partially saturated cells. Sliding it, the fluid inside goes with
 * it at the speed the slider sets, the row says it moves, and its forces are
 * marked provisional while it does.
 */
testWithPage(
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
    // Slide a from −6 to −2 over two seconds, 2 graph units a second, and
    // sample halfway: the fluid in the disc's fully covered cells against the
    // wall velocity the tab gave them.
    const sliding = await driver.evaluate(async () => {
      const { fluid } = DSM.enabledPlugins["vector-tools"] as any;
      const start = performance.now();
      let sample: any;
      await new Promise<void>((resolve) => {
        const frame = () => {
          const elapsed = (performance.now() - start) / 1000;
          const a = -6 + 2 * Math.min(elapsed, 2);
          Calc.setExpression({ id: "slider", latex: `a=${a.toFixed(4)}` });
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
      return sample;
    });
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

    // Stopped, it holds the fluid inside it still, where the slider left it.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const stopped = await driver.evaluate(() => {
      const { fluid } = DSM.enabledPlugins["vector-tools"] as any;
      const { solids } = fluid.moving;
      const { ux } = fluid.overlay.current.readMacro();
      const { nx } = fluid.spec;
      const { tank } = (DSM.enabledPlugins["vector-tools"] as any).getConfig()
        .fluid;
      const box = solids.boxes.get(1);
      let fluidX = 0;
      let n = 0;
      for (let k = 0; k < solids.coverage.length; k++) {
        if (solids.coverage[k] < 1) continue;
        fluidX += Math.abs(ux[k]);
        n++;
      }
      const dx = (tank.xMax - tank.xMin) / nx;
      return {
        centreX: tank.xMin + ((box[0] + box[2] + 1) / 2) * dx,
        fluidX: fluidX / n,
        wallSpeed: Math.max(...solids.velocity.map(Math.abs)),
        status: document.querySelector<HTMLElement>(
          ".dsm-vector-tools-fluid-row-status"
        )?.innerText,
      };
    });
    expect(stopped.centreX).toBeCloseTo(-2, 0);
    // The least-squares fit leaves a rounding residue, not a velocity.
    expect(stopped.wallSpeed).toBeLessThan(1e-8);
    expect(stopped.fluidX).toBeLessThan(0.002);
    await driver.page.screenshot({
      path: "docs/assets/fluid-moving-solid.png",
    });

    await driver.evaluate(() => {
      const plugin = DSM.enabledPlugins["vector-tools"] as any;
      plugin.setFluid("mode", "off");
      plugin.resetConfig();
      plugin.setPanelTab("field");
    });
    await driver.page.waitForFunction(() => !DSM.delaySetPluginSettings);
    await driver.disablePlugin("vector-tools");
    await driver.setBlank();
  },
  120000
);
