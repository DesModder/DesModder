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
        text: document.querySelector(".dsm-vector-tools-fluid-clock")!
          .innerText,
        gpu: document.querySelector(".dsm-vector-tools-fluid-gpu")!.innerText,
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
    await driver.disablePlugin("vector-tools");
    await driver.setBlank();
    await driver.waitForSync();
  },
  90000
);
