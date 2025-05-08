import { DWindow } from "../globals/window";
import { PluginID } from "../plugins";
import { GraphState } from "../../graph-state";
import Intellisense from "#plugins/intellisense/index.tsx";
import { Browser, Page } from "puppeteer";
import { Calc as CalcType, DispatchedEvent } from "../globals/Calc";

/** Calc is only available inside evaluate() callbacks and friends, since those
 * stringify the function and evaluate it inside the browser */
declare let Calc: CalcType;
declare let Desmos: DWindow["Desmos"];
declare let DSM: DWindow["DSM"];

/** A clean page is one that is equivalent (for all purposes) to a just-opened
 * calculator tab. We introduce this state to avoid a bunch of reloads.
 * But it's slightly risky, if a page isn't quite cleaned up. */

beforeEach(async () => {
  // Ensure at least one page is clean, so the reload time is not counted
  // as part of the test time (being unclean is the fault of an earlier test)
  await getPage();
}, 10000);

/** Use if the page is expected to be clean */
export const clean = Symbol("clean");

type Cleanliness = typeof clean;

export function testWithPage(
  name: string,
  cb: (driver: Driver) => Promise<void> | Promise<Cleanliness>,
  timeout?: number
) {
  test(
    name,
    async () => {
      const page = await getPage();
      const driver = new Driver(page);
      await driver.init();
      const cleanliness = await cb(driver);
      if (cleanliness === clean) {
        await driver.assertClean();
      } else {
        // If the page is not clean, close it.
        await page.close();
      }
    },
    timeout ?? 5000
  );
}

const browser = (globalThis as any).__BROWSER_GLOBAL__ as Browser;

async function getPage() {
  const pages = await browser.pages();
  // Assume that all Desmos pages are clean
  const isClean = await Promise.all(
    pages.map(async (x) => (await x.title()).includes("Desmos"))
  );
  const cleanPages = pages.filter((_, i) => isClean[i]);
  const page = cleanPages.pop();
  return page ?? (await makeNewPage());
}

async function makeNewPage() {
  const page = await browser.newPage();
  const url = process.env.DSM_TESTING_URL ?? "https://desmos.com/calculator";
  await page.goto(url);
  await page.waitForSelector(".dsm-pillbox-and-popover");
  return page;
}

const ENTER_ELM = ".dcg-action-toggle-edit.dcg-icon-btn";
const EXIT_ELM = ".dcg-action-toggle-edit.dcg-btn-blue";

export class Driver {
  enabledPluginsStart!: string[];
  pluginSettingsStart!: any;

  constructor(public readonly page: Page) {}

  async init() {
    this.enabledPluginsStart = await this.getEnabledPlugins();
    this.pluginSettingsStart = await this.getPluginSettings();
  }

  /** Passthrough */
  click = this.page.click.bind(this.page);
  waitForFunction = this.page.waitForFunction.bind(this.page);
  evaluate = this.page.evaluate.bind(this.page);
  setBlank = async () => await this.evaluate(() => Calc.setBlank());
  keyboard = this.page.keyboard;
  $ = this.page.$.bind(this.page);
  $$ = this.page.$$.bind(this.page);
  $eval = this.page.$eval.bind(this.page);
  $$eval = this.page.$$eval.bind(this.page);

  /** Helpers */
  async getState() {
    return await this.evaluate(() => Calc.getState());
  }

  async setState(state: GraphState) {
    await this.evaluate((state) => Calc.setState(state), state);
  }

  async waitForIntellisenseTimeoutsToFinish() {
    await this.evaluate(
      async () =>
        await (
          DSM.enabledPlugins.intellisense as Intellisense | undefined
        )?.waitForCurrentIntellisenseTimeoutsToFinish()
    );
  }

  async assertSelectedItemLatex(latex: string | undefined, msg?: string) {
    const actualLatex = await this.evaluate(
      () =>
        (Calc.controller.getSelectedItem() as any)?.latex as string | undefined
    );
    expect(actualLatex, msg).toEqual(latex);
  }

  async assertExprsList(state: GraphState) {
    const expected = state.expressions.list;
    const actual = (await this.getState()).expressions.list;
    expect(actual).toEqual(expected);
  }

  async getEnabledPlugins() {
    return await this.evaluate(() => Object.keys(DSM.enabledPlugins));
  }

  async getPluginSettings() {
    return await this.evaluate(() => DSM.pluginSettings);
  }

  async focusIndex(index: number) {
    await this.evaluate((index) => {
      const expression = Calc.getState().expressions.list[index];
      Calc.controller.dispatch({
        type: "move-focus-to-item",
        id: expression.id,
      });
    }, index);
  }

  async setLatexAndSync(latex: string) {
    await this.evaluate((latex) => {
      Calc.controller.dispatch({
        type: "set-item-latex",
        id: Calc.controller.getSelectedItem()!.id,
        latex,
      });
    }, latex);
    await this.waitForSync();
  }

  async waitForFocusedMathquill() {
    return await this.waitForFunction(() =>
      Desmos.Private.Fragile.MathquillView.getFocusedMathquill()
    );
  }

  async enablePlugin(id: PluginID) {
    await this.evaluate((id) => DSM.enablePlugin(id), id);
  }

  async disablePlugin(id: PluginID) {
    await this.evaluate((id) => DSM.disablePlugin(id), id);
  }

  async setPluginSetting(id: PluginID, key: string, value: any) {
    await this.evaluate(
      (id, key, value) => DSM.setPluginSetting(id, key, value),
      id,
      key,
      value
    );
  }

  async waitForSync() {
    await this.evaluate(
      async () =>
        await new Promise<void>((resolve) => {
          Calc.controller.evaluator.notifyWhenSynced(() => resolve());
        })
    );
  }

  async enterEditListMode() {
    await this.click(ENTER_ELM);
  }

  async exitEditListMode() {
    await this.click(EXIT_ELM);
  }

  async dispatch(e: DispatchedEvent) {
    await this.evaluate((_e) => {
      Calc.controller.dispatch(_e);
    }, e);
    await this.waitForSync();
  }

  async expectEval(latexExpected: string | string[]) {
    const latexFoundList = await this.evaluate(() => {
      const { rootViewNode } = Calc.controller.getSelectedItem()!;
      interface MqRoot extends Element {
        mqBlockNode: {
          latex: () => string;
        };
      }
      const evaluationMqRoots = rootViewNode.querySelectorAll(
        ".dcg-evaluation-container .dcg-mq-root-block"
      );
      // Do a list in case of vanilla list output.
      const latexes = [...evaluationMqRoots].map((x) =>
        (x as MqRoot).mqBlockNode.latex().trim()
      );
      if (latexes[0] === "=") {
        latexes.shift();
      }
      if (latexes.length === 0) {
        throw new Error(
          "Evaluation is not latex. Use `expectEvalPlain` instead to expect plaintext like 'undefined'."
        );
      }
      return latexes;
    });
    let latexFound;
    if (latexFoundList.length === 1 && !Array.isArray(latexExpected)) {
      [latexFound] = latexFoundList;
    } else {
      latexFound = latexFoundList;
    }
    expect(latexFound).toStrictEqual(latexExpected);
  }

  async expectEvalPlain(textExpected: string) {
    const textFound = await this.evaluate(() => {
      const { rootViewNode } = Calc.controller.getSelectedItem()!;
      // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style -- false positive
      const evaluationMqRoot = rootViewNode.querySelector(
        ".dcg-evaluation-container"
      ) as HTMLElement;
      return evaluationMqRoot.innerText;
    });
    expect(textFound).toBe(textExpected);
  }

  async clean() {
    await this.setBlank();
    await this.evaluate(
      (settings) => DSM.setAllPluginSettings(settings),
      this.pluginSettingsStart
    );
    await this.evaluate(
      (enabled) => DSM.togglePluginsTo(enabled),
      this.enabledPluginsStart
    );
    const exitELM = await this.page.$(EXIT_ELM);
    if (exitELM) await exitELM.click();
    // Wait for settings to get sent back to the extension storage
    // TODO-testing: some way to clear extension sync storage
    await this.page.waitForFunction(() => !DSM.delaySetPluginSettings);
  }

  /** Assertions */
  async assertSelector(...selectors: string[]) {
    for (const sel of selectors) {
      const el = await this.page.$(sel);
      expect(el ? sel : "[missing]").toEqual(sel);
    }
  }

  async assertSelectorNot(...selectors: string[]) {
    for (const sel of selectors) {
      const el = await this.page.$(sel);
      expect(el ? sel : "[missing]").toEqual("[missing]");
    }
  }

  async assertSelectorEventually(sel: string) {
    const el = await this.page.waitForSelector(sel);
    expect(el).toBeTruthy();
  }

  async assertClean() {
    const waitingToSendMessage = await this.page.evaluate(
      () => DSM.delaySetPluginSettings
    );
    expect(waitingToSendMessage).toBeFalsy();
    // State is same
    const stateOld = await this.getState();
    await this.setBlank();
    const stateNew = await this.getState();
    stateOld.randomSeed = stateNew.randomSeed;
    expect(stateOld).toEqual(stateNew);
    // Enabled plugins are same
    const enabledPluginsNew = (await this.getEnabledPlugins()).sort();
    expect(enabledPluginsNew).toEqual([...this.enabledPluginsStart].sort());
    // Plugin settings are same
    const pluginSettingsNew = await this.getPluginSettings();
    expect(pluginSettingsNew).toEqual(this.pluginSettingsStart);
    // Sidebar isn't open
    await this.assertSelectorNot(".dcg-resources-cover");
    await this.assertSelector(
      // Open-keypad button is visible
      ".dcg-show-keypad-container",
      // Keypad isn't open
      ".dcg-keys-container[aria-hidden]"
    );
    // There's no visible mathquill, except those that are children of keypad
    // (which don't get removed from the DOM tree)
    const allMathquillAreInKeypad = await this.page.$$eval(
      ".dcg-mq-root-block:not(.dcg-mq-empty)",
      (elems) => elems.every((e) => e.closest(".dcg-keypad"))
    );
    expect(allMathquillAreInKeypad).toBeTruthy();
    // Menus aren't open
    await this.assertSelectorNot(
      ".dsm-menu-container",
      ".dsm-vc-capture-menu",
      ".dcg-shared-modal-container",
      ".dcg-popover-interior",
      ".dcg-modal-container div *",
      // Edit List Mode is off
      ".dcg-action-clearall"
    );
  }
}
