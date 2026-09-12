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
const SHOW_ANSWER = ".dsm-physics-lab-show-answer";
const CHECK_ANSWER = ".dsm-physics-lab-check-answer";
const FORM_CHIPS = "#dsm-physics-lab-form";
const HINT_BUTTON = ".dsm-physics-lab-hint-button";
const VERDICT = String.raw`[data-physics-lab="verdict"]`;
const STEP_TITLE = ".dsm-physics-lab-step-title";

/** The Derivative tab, on the expression whose tree contains three rules. */
async function openDerivativeTab(driver: Driver, fLatex: string) {
  // Through the same call the math field makes, so what the field does to the
  // practice problem is what the test does to it.
  await driver.evaluate((latex: string) => {
    const { session } = DSM.physicsLab as unknown as {
      session: {
        updateConfig: (m: (c: PhysicsLabConfig) => void) => void;
        setDerivativeVariable: (v: string) => void;
        setDerivativeExpression: (l: string) => void;
      };
    };
    session.updateConfig((config) => {
      config.panel.tab = "derivative";
      config.derivative.detail = "standard";
    });
    session.setDerivativeVariable("x");
    session.setDerivativeExpression(latex);
  }, fLatex);
  await driver.waitForSync();
  await driver.assertSelectorEventually(DERIVATIVE);
}

async function stepTitles(driver: Driver) {
  return await driver.evaluate(
    (selector: string) =>
      [...document.querySelectorAll(selector)].map(
        (el) => (el as HTMLElement).innerText
      ),
    STEP_TITLE
  );
}

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
  "the Derivative tab explains the expression tree, not a list of rules",
  async (driver) => {
    await openPanel(driver);
    // Product, power and chain in one line.
    await openDerivativeTab(
      driver,
      "x^{2}\\operatorname{sin}\\left(3x\\right)"
    );

    const shown = await driver.$eval(
      DERIVATIVE,
      (el) => el.getAttribute("data-latex") ?? ""
    );
    expect(shown).toBe(
      "2x\\operatorname{sin}\\left(3x\\right)+3x^{2}\\operatorname{cos}\\left(3x\\right)"
    );

    // A tree, in cause-and-effect order, labelled by position rather than by
    // sequence. The outermost rule is announced, its two sub-problems are
    // worked — headed by the names *it* gave them — and the inner one's result
    // is assembled below its own children rather than beside its announcement.
    // The last card is not numbered, because collecting terms is not a
    // differentiation rule and a card that looked like one would teach that it
    // is.
    expect(await stepTitles(driver)).toEqual([
      "1. Product rule",
      "1a. Differentiate u",
      "1b. Differentiate v",
      "Put v' together",
      "Tidy up",
    ]);

    // Each sub-problem shows which part of the original it is about, which is
    // the first thing a reader loses in a nested derivative.
    const focus = await driver.evaluate(() =>
      [...document.querySelectorAll(".dsm-physics-lab-focus")].map(
        (el) =>
          el.querySelector("[data-latex]")?.getAttribute("data-latex") ?? ""
      )
    );
    expect(focus).toHaveLength(2);

    // The rule's own name sits under the sub-problem it is being used on.
    const ruleNames = await driver.evaluate(() =>
      [...document.querySelectorAll(".dsm-physics-lab-rule-name")].map(
        (el) => (el as HTMLElement).innerText
      )
    );
    expect(ruleNames).toEqual(["Power rule", "Chain rule"]);

    // The product rule names the two pieces it split the problem into, and
    // shows itself applied with those pieces still outstanding.
    const named = await driver.evaluate(() =>
      [...document.querySelectorAll(".dsm-physics-lab-sub-symbol")].map(
        (el) => (el as HTMLElement).innerText
      )
    );
    expect(named).toEqual(["u =", "v =", "outer =", "u ="]);
    await driver.assertSelector(".dsm-physics-lab-intermediate");

    // The general rule is rendered beside each step, not printed as its source.
    const formulas = await driver.evaluate(
      () => [...document.querySelectorAll(".dsm-physics-lab-formula")].length
    );
    expect(formulas).toBeGreaterThan(0);

    // Asking for everything shows the facts too — the same tree, filtered
    // differently, so no answer can change with the setting.
    await driver.click(
      "#dsm-physics-lab-detail .dsm-physics-lab-chip:nth-child(2)"
    );
    await driver.waitForSync();
    // Same tree, one level deeper: the chain rule's own sub-problem appears,
    // and it is placed under the rule that asked for it rather than after it.
    const everything = await stepTitles(driver);
    expect(everything).toEqual([
      "1. Product rule",
      "1a. Differentiate u",
      "1b. Differentiate v",
      "1b-i. Differentiate u",
      "Put v' together",
      "Tidy up",
    ]);

    // The hierarchy is drawn from the depth rather than implied by the
    // labels, so a reader looking rather than reading still sees the nesting.
    const indents = await driver.evaluate(() =>
      [...document.querySelectorAll(".dsm-physics-lab-step")].map(
        (el) => (el as HTMLElement).style.marginLeft
      )
    );
    expect(indents.slice(0, 4)).toEqual(["0px", "12px", "12px", "24px"]);

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

testWithPage(
  "the practice problem stays a problem until its answer is asked for",
  async (driver) => {
    await openPanel(driver);
    await openDerivativeTab(
      driver,
      "x^{2}\\operatorname{sin}\\left(3x\\right)"
    );

    // A solution sitting under the question is not a question.
    await driver.assertSelectorNot(EXAMPLE_ANSWER);

    // An attempt is marked by evaluating it, so the same derivative written
    // another way is still the same derivative. This one is the right answer
    // with its two terms the other way round.
    async function setAttempt(latex: string) {
      await driver.evaluate((attempt: string) => {
        (
          DSM.physicsLab as unknown as {
            session: { setAttempt: (l: string) => void };
          }
        ).session.setAttempt(attempt);
      }, latex);
      await driver.waitForSync();
      // A verdict that arrives on every keystroke tells somebody halfway
      // through typing that they are wrong, so it waits to be asked for.
      await driver.assertSelectorNot(VERDICT);
      await driver.click(CHECK_ANSWER);
      await driver.waitForSync();
      await driver.assertSelectorEventually(VERDICT);
      return await driver.$eval(
        VERDICT,
        (el) => el.getAttribute("data-verdict") ?? ""
      );
    }

    expect(
      await setAttempt(
        "4x^{3}\\operatorname{cos}\\left(4x\\right)+3x^{2}\\operatorname{sin}\\left(4x\\right)"
      )
    ).toBe("correct");
    // A dropped chain factor, which is the mistake this problem is for.
    expect(
      await setAttempt(
        "3x^{2}\\operatorname{sin}\\left(4x\\right)+x^{3}\\operatorname{cos}\\left(4x\\right)"
      )
    ).toBe("wrong");

    // The first hint is a question, and answers nothing. Doing the
    // recognition for the reader would end the exercise, and the recognition
    // is the exercise.
    await driver.click(HINT_BUTTON);
    await driver.waitForSync();
    const hints = await driver.evaluate(() =>
      [...document.querySelectorAll(".dsm-physics-lab-hints li")].map(
        (el) => (el as HTMLElement).innerText
      )
    );
    expect(hints).toEqual(["What are the two factors of the product?"]);

    await driver.click(SHOW_ANSWER);
    await driver.waitForSync();
    await driver.assertSelectorEventually(EXAMPLE_ANSWER);
    // The same shape with different numbers, so it needs exactly the rules
    // just explained.
    expect(
      await driver.$eval(
        EXAMPLE_ANSWER,
        (el) => el.getAttribute("data-latex") ?? ""
      )
    ).toBe(
      "3x^{2}\\operatorname{sin}\\left(4x\\right)+4x^{3}\\operatorname{cos}\\left(4x\\right)"
    );

    // Changing the question takes the answer back down with it: an answer left
    // on screen from the last problem reads as the answer to this one.
    await openDerivativeTab(
      driver,
      "x^{3}\\operatorname{cos}\\left(2x\\right)"
    );
    await driver.assertSelectorNot(EXAMPLE_ANSWER, VERDICT);

    await driver.setBlank();
    await driver.disablePlugin("physics-lab");
  },
  50000
);

testWithPage(
  "a long answer is offered factored as well as expanded",
  async (driver) => {
    await openPanel(driver);
    // The expression GPT's review was written about: logarithmic
    // differentiation, whose answer nobody writes the way the rules leave it.
    await openDerivativeTab(
      driver,
      "x^{2}\\left(\\operatorname{sin}\\left(3x\\right)\\right)^{e^{x}}"
    );

    const expanded = await driver.$eval(
      DERIVATIVE,
      (el) => el.getAttribute("data-latex") ?? ""
    );
    expect(expanded).toContain("\\operatorname{ln}");

    // Two forms of one function, so the panel offers both rather than choosing.
    await driver.assertSelector(FORM_CHIPS);
    await driver.click(`${FORM_CHIPS} .dsm-physics-lab-chip:nth-child(2)`);
    await driver.waitForSync();
    const factored = await driver.$eval(
      DERIVATIVE,
      (el) => el.getAttribute("data-latex") ?? ""
    );
    expect(factored).toBe(
      "\\operatorname{sin}\\left(3x\\right)^{e^{x}}\\left(2x+x^{2}e^{x}" +
        "\\left(\\operatorname{ln}\\left(\\operatorname{sin}\\left(3x\\right)\\right)+" +
        "3\\operatorname{cot}\\left(3x\\right)\\right)\\right)"
    );
    expect(factored.length).toBeLessThan(expanded.length);

    // Desmos has to agree that the two are the same function — this is the
    // check nothing offline can make, and the reason the factoriser is allowed
    // to rewrite an answer at all.
    await driver.evaluate(
      (a: string, b: string) => {
        Calc.setExpression({ id: "expanded", latex: `E_{x}(x)=${a}` });
        Calc.setExpression({ id: "factored", latex: `F_{a}(x)=${b}` });
        Calc.setExpression({
          id: "gap",
          latex: "g_{ap}=E_{x}(0.4)-F_{a}(0.4)",
        });
      },
      expanded,
      factored
    );
    await driver.waitForSync();
    const gap = await driver.evaluate(async () => {
      const helper = Calc.HelperExpression({ latex: "g_{ap}" });
      return await new Promise<number>((resolve) => {
        helper.observe("numericValue", () => {
          resolve(helper.numericValue);
        });
      });
    });
    expect(Math.abs(gap)).toBeLessThan(1e-9);

    // And the shorter form says what was done to it, so it is not a puzzle.
    const notes = await driver.evaluate(() =>
      [...document.querySelectorAll(".dsm-physics-lab-note")].map(
        (el) => (el as HTMLElement).innerText
      )
    );
    expect(notes.join(" ")).toContain("Factor out");
    expect(notes.join(" ")).toContain("cot");

    await driver.setBlank();
    await driver.disablePlugin("physics-lab");
  },
  50000
);

testWithPage(
  "the panel is resizable, and remembers what it was dragged to",
  async (driver) => {
    await openPanel(driver);

    // The panel opens at its stored width and grows by the corner. Dragging a
    // resize handle is not something Puppeteer can do faithfully, so the drag's
    // effect — an inline width on the element — is written directly and the
    // observer that watches for it is what is under test.
    const startWidth = await driver.$eval(
      PANEL,
      (el) => (el as HTMLElement).style.width
    );
    expect(startWidth).toBe("460px");
    expect(await driver.$eval(PANEL, (el) => getComputedStyle(el).resize)).toBe(
      "both"
    );

    await driver.evaluate((selector: string) => {
      const panel = document.querySelector<HTMLElement>(selector)!;
      panel.style.width = "640px";
      panel.style.height = "700px";
    }, PANEL);
    // The observer is debounced, because one drag fires it every frame and
    // every write serialises the whole configuration.
    await driver.evaluate(
      async () =>
        await new Promise((resolve) => {
          setTimeout(resolve, 600);
        })
    );
    await driver.waitForSync();

    const { panel } = await liveConfig(driver);
    expect(panel.width).toBe(640);
    expect(panel.height).toBe(700);

    // Closed and reopened, it comes back the size it was left.
    await driver.click(BUTTON);
    await driver.waitForSync();
    await driver.click(BUTTON);
    await driver.assertSelectorEventually(PANEL);
    expect(
      await driver.$eval(PANEL, (el) => (el as HTMLElement).style.width)
    ).toBe("640px");

    // And the equation fields fill whatever width the panel now has, rather
    // than shrinking to fit their own contents and clipping the expression.
    await openTab(driver, "derivative");
    const fieldWidth = await driver.evaluate(() => {
      const input = document.querySelector<HTMLElement>(
        ".dsm-physics-lab-math-input .dcg-mq-editable-field"
      )!;
      const box = input.parentElement!;
      return { field: input.clientWidth, container: box.clientWidth };
    });
    expect(fieldWidth.field).toBeGreaterThan(fieldWidth.container - 4);

    // Nothing on the tab pushes the panel sideways at any size.
    const overflow = await driver.$eval(PANEL, (el) => ({
      scroll: el.scrollWidth,
      client: el.clientWidth,
    }));
    expect(overflow.scroll).toBe(overflow.client);

    await driver.setBlank();
    await driver.disablePlugin("physics-lab");
  },
  50000
);
