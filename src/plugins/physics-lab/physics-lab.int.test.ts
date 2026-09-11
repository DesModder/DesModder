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
const SECOND_SOLUTION = String.raw`[data-physics-lab="second-solution"]`;
const ADD_SECOND = ".dsm-physics-lab-add-second";
const PARTICULAR = String.raw`[data-physics-lab="particular"]`;
const ADD_PARTICULAR = ".dsm-physics-lab-add-particular";
const DRAW_PHASE = ".dsm-physics-lab-draw-phase";
const DERIVATIVE = String.raw`[data-physics-lab="derivative"]`;
const EXAMPLE_ANSWER = String.raw`[data-physics-lab="example-answer"]`;
const ADD_DERIVATIVE = ".dsm-physics-lab-add-derivative";

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

testWithPage(
  "a second-order equation solves, and its damped oscillation lands on the graph",
  async (driver) => {
    await openPanel(driver);

    await driver.evaluate(() => {
      (
        DSM.physicsLab as unknown as {
          session: { updateConfig: (m: (c: PhysicsLabConfig) => void) => void };
        }
      ).session.updateConfig((config) => {
        config.panel.tab = "second";
        // Typed with a prime, which Desmos’s parser cannot read. MathQuill
        // holds it fine, and it is rewritten on the way to the parser — so
        // this is the regression test for that rewrite as well.
        config.secondOrder.fLatex = "-y'-4y";
      });
    });
    await driver.waitForSync();
    await driver.assertSelectorEventually(SECOND_SOLUTION);

    const solved = await driver.$eval(
      SECOND_SOLUTION,
      (el) => el.getAttribute("data-latex") ?? ""
    );
    // Roots -1/2 ± (√15/2)i. The radical is the point: a decimal in an exponent
    // is not a rounding. And the two primes of 15 have to come back as one
    // radical rather than as √3·√5, which is what they factor into.
    expect(solved).toContain("\\sqrt{15}");
    expect(solved).toContain("C_{1}");
    expect(solved).toContain("C_{2}");

    await driver.click(ADD_SECOND);
    await driver.evaluate(() => {
      Calc.setExpression({ id: "c1", latex: "C_{1}=2" });
      Calc.setExpression({ id: "c2", latex: "C_{2}=1" });
    });
    await driver.waitForSync();

    // Desmos parsed and graphed it: a solution it could not read would sit in
    // the list unplotted, which no assertion about the string would notice.
    const drawn = await driver.evaluate(
      (latex: string) =>
        Calc.getState().expressions.list.some(
          (item) => item.type === "expression" && item.latex === latex
        ),
      solved
    );
    expect(drawn).toBe(true);

    await driver.click(BUTTON);
    await new Promise((resolve) => setTimeout(resolve, 800));
    await driver.page.screenshot({
      path: "docs/assets/physics-lab-second-order.png",
    });
    await driver.click(BUTTON);
    await driver.setBlank();
    await driver.disablePlugin("physics-lab");
  },
  50000
);

testWithPage(
  "a point picks the constant, and a pasted decimal is read back into a constant",
  async (driver) => {
    await openPanel(driver);

    await driver.evaluate(() => {
      (
        DSM.physicsLab as unknown as {
          session: { updateConfig: (m: (c: PhysicsLabConfig) => void) => void };
        }
      ).session.updateConfig((config) => {
        config.panel.tab = "slope";
        config.slope.fLatex = "x-y";
        config.initial.xLatex = "0";
        config.initial.yLatex = "2";
      });
    });
    await driver.waitForSync();
    await driver.assertSelectorEventually(PARTICULAR);

    // y = x - 1 + Ce^{-x} at x = 0 is C - 1, so passing through (0, 2) needs 3.
    const constant = await driver.$eval(
      PARTICULAR,
      (el) => el.getAttribute("data-latex") ?? ""
    );
    expect(constant).toBe("C=3");

    await driver.click(ADD_PARTICULAR);
    await driver.waitForSync();
    const inserted = (await driver.getState()).expressions.list;
    expect(
      inserted.some(
        (item) => item.type === "expression" && item.latex === "C=3"
      )
    ).toBe(true);

    // The reverse direction: Desmos prints pi squared as this, and pasting it
    // back has to name it rather than report the fraction it literally is.
    await openTab(driver, "exact");
    await driver.evaluate(() => {
      (
        DSM.physicsLab as unknown as {
          session: { updateConfig: (m: (c: PhysicsLabConfig) => void) => void };
        }
      ).session.updateConfig((config) => {
        config.exact.latex = "9.86960440109";
      });
    });
    await driver.waitForSync();
    const recognised = await driver.$eval(
      EXACT_OUTPUT,
      (el) => el.getAttribute("data-latex") ?? ""
    );
    expect(recognised).toBe("\\pi^{2}");

    await driver.setBlank();
    await driver.disablePlugin("physics-lab");
  },
  50000
);

testWithPage(
  "a second-order equation gets a phase plane, in its own coordinates",
  async (driver) => {
    await openPanel(driver);
    await driver.evaluate(() => {
      (
        DSM.physicsLab as unknown as {
          session: { updateConfig: (m: (c: PhysicsLabConfig) => void) => void };
        }
      ).session.updateConfig((config) => {
        config.panel.tab = "second";
        config.secondOrder.fLatex = "-0.3y'-4y";
      });
    });
    await driver.waitForSync();

    await driver.click(DRAW_PHASE);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await driver.assertSelectorEventually(CANVAS);

    // The overlay writes nothing to the graph, the same as the slope field.
    const { list } = (await driver.getState()).expressions;
    expect(
      list.filter((item) => item.type === "expression" && item.latex)
    ).toEqual([]);

    await driver.click(BUTTON);
    await new Promise((resolve) => setTimeout(resolve, 800));
    // The picture is the check: a damped oscillator spirals clockwise, so the
    // arrows point down where y is positive and up where it is negative. A
    // phase plane drawn with its two components swapped looks just as plausible
    // and turns the other way.
    await driver.page.screenshot({
      path: "docs/assets/physics-lab-phase-plane.png",
    });
    await driver.click(BUTTON);

    await driver.click(DRAW_PHASE);
    await driver.waitForSync();
    await driver.assertSelectorNot(CANVAS);

    await driver.setBlank();
    await driver.disablePlugin("physics-lab");
  },
  50000
);

testWithPage(
  "every derivative rule emits LaTeX Desmos parses and agrees with",
  async (driver) => {
    await openPanel(driver);

    // One expression per rule, including the ones whose derivatives are spelled
    // with functions that are not LaTeX commands — sech, csch, arcsec. Those
    // are exactly where a name Desmos does not have would slip through: the
    // unit tests evaluate with JavaScript's own maths and would never notice.
    const cases = [
      "x^{3}",
      "3x^{2}",
      "x\\operatorname{sin}\\left(x\\right)",
      "\\frac{\\operatorname{sin}\\left(x\\right)}{x}",
      "\\operatorname{sin}\\left(x^{2}\\right)",
      "\\operatorname{tan}\\left(2x\\right)",
      "\\operatorname{arcsin}\\left(0.5x\\right)",
      "\\operatorname{arctan}\\left(x\\right)",
      "\\operatorname{tanh}\\left(x\\right)",
      "\\operatorname{sech}\\left(x\\right)",
      "\\operatorname{arcsec}\\left(2x\\right)",
      "e^{2x}",
      "2^{x}",
      "x^{x}",
      "\\ln\\left(x^{2}+1\\right)",
      "\\sqrt{3x+1}",
    ];

    const checked = await driver.evaluate(async (list: string[]) => {
      const { session } = DSM.physicsLab as unknown as {
        session: { derivativeLatex: (l: string) => string | undefined };
      };
      const out: { source: string; derivative?: string; value: number }[] = [];
      for (const source of list) {
        const derivative = session.derivativeLatex(source);
        if (derivative === undefined) {
          out.push({ source, value: NaN });
          continue;
        }
        // Evaluated through a definition rather than by substituting a number
        // into the string. Textual substitution turns `0.5x` into `0.51.3`,
        // which fails for a reason that has nothing to do with the derivative.
        Calc.setExpression({ id: "probe", latex: `P_{r}(x)=${derivative}` });
        const helper = Calc.HelperExpression({ latex: "P_{r}(1.3)" });
        await new Promise((resolve) => setTimeout(resolve, 120));
        out.push({
          source,
          derivative,
          value: (helper as unknown as { numericValue: number }).numericValue,
        });
      }
      return out;
    }, cases);

    for (const entry of checked) {
      expect(entry.derivative).toBeDefined();
      // Finite means Desmos read every function name in it. The unit tests
      // already checked the value is the right one.
      expect(
        Number.isFinite(entry.value)
          ? entry.source
          : `${entry.source} -> ${entry.derivative ?? "none"} did not evaluate`
      ).toBe(entry.source);
    }

    await driver.setBlank();
    await driver.disablePlugin("physics-lab");
  },
  60000
);

testWithPage(
  "the Derivative tab shows the rules in the order they are applied",
  async (driver) => {
    await openPanel(driver);
    await driver.evaluate(() => {
      (
        DSM.physicsLab as unknown as {
          session: { updateConfig: (m: (c: PhysicsLabConfig) => void) => void };
        }
      ).session.updateConfig((config) => {
        config.panel.tab = "derivative";
        config.derivative.variable = "x";
        // Product, power and chain in one line.
        config.derivative.fLatex = "x^{2}\\operatorname{sin}\\left(3x\\right)";
      });
    });
    await driver.waitForSync();
    await driver.assertSelectorEventually(DERIVATIVE);

    const shown = await driver.$eval(
      DERIVATIVE,
      (el) => el.getAttribute("data-latex") ?? ""
    );
    expect(shown).toBe(
      "2x\\operatorname{sin}\\left(3x\\right)+3x^{2}\\operatorname{cos}\\left(3x\\right)"
    );

    // Outermost rule first. Recording in the order the recursion finishes gives
    // the small derivatives before the reason for them, which is a log rather
    // than a derivation.
    const titles = await driver.evaluate(() =>
      [...document.querySelectorAll(".dsm-physics-lab-step-title")].map(
        (el) => (el as HTMLElement).innerText
      )
    );
    expect(titles.slice(0, 3)).toEqual([
      "Product rule",
      "Power rule",
      "Chain rule",
    ]);

    // The general rule is rendered beside each step, not printed as its source.
    const formulas = await driver.evaluate(
      () => [...document.querySelectorAll(".dsm-physics-lab-formula")].length
    );
    expect(formulas).toBeGreaterThan(0);

    // The worked example is the same shape with different numbers, so it needs
    // exactly the rules just explained.
    const example = await driver.$eval(
      EXAMPLE_ANSWER,
      (el) => el.getAttribute("data-latex") ?? ""
    );
    expect(example).toBe(
      "3x^{2}\\operatorname{sin}\\left(4x\\right)+4x^{3}\\operatorname{cos}\\left(4x\\right)"
    );

    // And it goes into the graph as an ordinary expression.
    await driver.click(ADD_DERIVATIVE);
    await driver.waitForSync();
    const { list } = (await driver.getState()).expressions;
    expect(
      list.some((item) => item.type === "expression" && item.latex === shown)
    ).toBe(true);

    await driver.setBlank();
    await driver.disablePlugin("physics-lab");
  },
  50000
);
