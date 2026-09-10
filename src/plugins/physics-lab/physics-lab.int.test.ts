/**
 * Physics Lab against a real Desmos.
 *
 * Two things here cannot be checked anywhere else. The exact-constant
 * arithmetic is unit-tested, but nothing offline can prove that what it emits
 * is LaTeX Desmos parses — `\pi` written beside `e` is `\pie`, an undefined
 * command that renders as nothing, and every unit assertion was happy with it.
 * And a slope field is a picture: the marks can be the right length, the right
 * count and the right colour while pointing the wrong way, and no assertion
 * about the config would notice.
 */
import { clean, Driver, testWithPage } from "../../tests/puppeteer-utils";
import type { Calc as CalcType } from "#globals";
import { PANEL_TABS, type PanelTab, type PhysicsLabConfig } from "./model";

declare let Calc: CalcType;
declare let DSM: Window["DSM"];

const BUTTON = ".dsm-action-menu .dcg-icon-scientific";
const PANEL = ".dsm-physics-lab-menu";
const DRAW = ".dsm-physics-lab-draw";
const CANVAS = "#dsm-physics-lab-slope-canvas";
const EXACT_OUTPUT = '[data-physics-lab="exact-output"]';
const SOLUTION = '[data-physics-lab="solution"]';
const ADD_SOLUTION = ".dsm-physics-lab-add-solution";

async function openPanel(driver: Driver) {
  await driver.enablePlugin("physics-lab");
  await driver.assertSelectorEventually(BUTTON);
  await driver.click(BUTTON);
  await driver.assertSelector(PANEL);
}

/**
 * Read from the session rather than from the persisted setting: the setting is
 * empty until the first change is made, so parsing it is a test that only
 * passes after something unrelated has already happened.
 */
async function liveConfig(driver: Driver): Promise<PhysicsLabConfig> {
  return await driver.evaluate(() =>
    JSON.parse(
      JSON.stringify(
        (
          DSM.physicsLab as unknown as {
            session: { getConfig: () => PhysicsLabConfig };
          }
        ).session.getConfig()
      )
    )
  );
}

/** Switches tab through the segmented control, the way a person would. */
async function openTab(driver: Driver, id: PanelTab) {
  const index = PANEL_TABS.findIndex((tab) => tab.id === id);
  if (index < 0) throw new Error(`No such panel tab: ${id}`);
  await driver.click(
    `.dsm-physics-lab-tabs .dcg-segmented-control-btn:nth-child(${index + 1})`
  );
  await driver.waitForSync();
}

testWithPage(
  "Physics Lab draws a slope field, and stops when told to",
  async (driver) => {
    expect(await driver.getEnabledPlugins()).not.toContain("physics-lab");
    await openPanel(driver);

    // The default is dy/dx = x - y, whose solutions bend toward y = x - 1.
    expect((await liveConfig(driver)).slope.fLatex).toBe("x-y");

    await driver.click(DRAW);
    await driver.waitForSync();
    await new Promise((resolve) => setTimeout(resolve, 1200));

    // The overlay owns its own canvas and writes nothing to the graph, so the
    // expression list must be exactly as empty as it started.
    await driver.assertSelectorEventually(CANVAS);
    const { list } = (await driver.getState()).expressions;
    expect(
      list.filter((item) => item.type === "expression" && item.latex)
    ).toEqual([]);

    // Evidence, and a reference rather than a plausibility check: a solution
    // curve has to run tangent to every mark it crosses, and a slope field
    // pointing the wrong way looks perfectly reasonable on its own.
    //
    // The curve is not written by this test. The panel solved the equation
    // itself, and the button puts *its* answer into the graph — so the picture
    // checks the solver and the renderer against each other, and neither of
    // them against something hand-written here.
    // The readout renders as maths now, so the string the button will insert is
    // carried in a data attribute rather than being the element text.
    const solved = await driver.$eval(
      SOLUTION,
      (el) => el.getAttribute("data-latex") ?? ""
    );
    expect(solved).toBe("y=x-1+Ce^{-x}");
    await driver.click(ADD_SOLUTION);
    await driver.waitForSync();

    const afterInsert = (await driver.getState()).expressions.list;
    const curve = afterInsert.find(
      (item) => item.type === "expression" && item.latex === "y=x-1+Ce^{-x}"
    );
    expect(curve).toBeDefined();

    // C arrives undefined, so Desmos offers a slider for it — which is what
    // turns one curve into the family. Pinning it draws a representative member.
    await driver.evaluate(() =>
      Calc.setExpression({ id: "c-slider", latex: "C=3" })
    );
    await driver.waitForSync();
    // With the popover closed, so the field it is drawing is what is on screen.
    await driver.click(BUTTON);
    await new Promise((resolve) => setTimeout(resolve, 700));
    await driver.page.screenshot({
      path: "docs/assets/physics-lab-slope-field.png",
    });
    await driver.click(BUTTON);
    await driver.setBlank();

    await driver.click(DRAW);
    await driver.waitForSync();
    await driver.assertSelectorNot(CANVAS);

    await driver.disablePlugin("physics-lab");
    await driver.assertSelectorNot(BUTTON);
    return clean;
  },
  40000
);

testWithPage(
  "the exact form Physics Lab emits is LaTeX Desmos itself parses and agrees with",
  async (driver) => {
    await openPanel(driver);
    await openTab(driver, "exact");

    // Driven through the session rather than through MathQuill keystrokes,
    // because what is under test is the emitted LaTeX rather than the editor.
    await driver.evaluate(() => {
      (
        DSM.physicsLab as unknown as {
          session: { updateConfig: (m: (c: PhysicsLabConfig) => void) => void };
        }
      ).session.updateConfig((config) => {
        config.exact.latex = "\\sqrt{2}^{3}";
      });
    });
    await driver.waitForSync();

    const shown = await driver.$eval(
      EXACT_OUTPUT,
      (el) => el.getAttribute("data-latex") ?? ""
    );
    expect(shown).toBe("2\\sqrt{2}");

    // Desmos's own evaluator, on the string this plugin wrote. Malformed LaTeX
    // gives undefined here rather than a number, which is exactly the failure a
    // DOM assertion cannot see.
    const value = await driver.evaluate(async () => {
      const helper = Calc.HelperExpression({ latex: "2\\sqrt{2}" });
      await new Promise((resolve) => setTimeout(resolve, 500));
      return (helper as unknown as { numericValue: number }).numericValue;
    });
    expect(value).toBeCloseTo(Math.SQRT2 ** 3, 10);

    await driver.setBlank();
    await driver.disablePlugin("physics-lab");
  },
  40000
);

testWithPage(
  "the logistic equation solves in the form it is written, and its curve fits the field",
  async (driver) => {
    await openPanel(driver);

    // Typed the way a textbook writes it. Desmos parses the juxtaposition
    // before the bracket as a function call, so this is also the regression
    // test for reading it back as multiplication.
    await driver.evaluate(() => {
      (
        DSM.physicsLab as unknown as {
          session: { updateConfig: (m: (c: PhysicsLabConfig) => void) => void };
        }
      ).session.updateConfig((config) => {
        // Set explicitly: the panel tab is persisted in plugin settings, which
        // outlive the page, so a previous test leaving the Exact value tab
        // selected would open this one somewhere with no solution on it.
        config.panel.tab = "slope";
        config.slope.fLatex = "0.6y\\left(1-\\frac{y}{4}\\right)";
        config.slope.domain = {
          x: { min: -2, max: 8 },
          y: { min: -1, max: 6 },
        };
        config.slope.columns = 25;
        config.slope.rows = 19;
      });
    });
    await driver.waitForSync();
    // Solving parses, integrates and then verifies numerically, and the panel
    // re-renders after all of it; waitForSync only covers the calculator.
    await driver.assertSelectorEventually(SOLUTION);

    const solved = await driver.$eval(
      SOLUTION,
      (el) => el.getAttribute("data-latex") ?? ""
    );
    expect(solved).toBe("y=\\frac{4}{1+Ce^{-0.6x}}");

    await driver.click(DRAW);
    await new Promise((resolve) => setTimeout(resolve, 900));
    await driver.click(ADD_SOLUTION);
    await driver.evaluate(() =>
      Calc.setExpression({ id: "c-slider", latex: "C=8" })
    );
    await driver.waitForSync();
    await driver.click(BUTTON);
    await new Promise((resolve) => setTimeout(resolve, 800));
    // The S-curve has to leave the origin, bend, and flatten at the carrying
    // capacity along the marks — which is only visible in a picture.
    await driver.page.screenshot({
      path: "docs/assets/physics-lab-logistic.png",
    });
    await driver.click(BUTTON);

    await driver.click(DRAW);
    await driver.setBlank();
    await driver.disablePlugin("physics-lab");
  },
  50000
);
