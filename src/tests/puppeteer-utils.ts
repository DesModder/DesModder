import { DWindow } from "../globals/window";
import { join } from "path";
import puppeteer, { Browser, Page } from "puppeteer";

/** Calc is only available inside evaluate() callbacks and friends, since those
 * stringify the function and evaluate it inside the browser */
declare let Calc: DWindow["Calc"];
declare let Desmos: DWindow["Desmos"];

let browser!: Browser;

/** A clean page is one that is equivalent (for all purposes) to a just-opened
 * calculator tab. We introduce this state to avoid a bunch of reloads.
 * But that requires running all tests sequentially. */
let cleanPage: Page | undefined;

beforeAll(async () => {
  browser = await getBrowser();
  cleanPage = await getPage();
});

afterAll(async () => {
  await browser.close();
});

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
      const cleanliness = await cb(driver);
      if (cleanliness === clean) {
        await driver.assertClean();
        cleanPage = page;
      } else {
        await page.close();
      }
    },
    timeout ?? 5000
  );
}

async function getPage() {
  if (!browser) cleanPage = undefined;
  if (cleanPage) {
    const page = cleanPage;
    // The test can dirty the page immediately.
    cleanPage = undefined;
    return page;
  }
  browser ??= await getBrowser();
  const page = await browser.newPage();
  await page.goto("https://desmos.com/calculator");
  await page.waitForSelector(".dsm-pillbox-and-popover");
  return page;
}

async function getBrowser() {
  const pathToExtension = join(process.cwd(), "dist");
  return await puppeteer.launch({
    headless: "new",
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
    ],
  });
}

export class Driver {
  constructor(public readonly page: Page) {}

  /** Passthrough */
  click = this.page.click.bind(this.page);
  waitForFunction = this.page.waitForFunction.bind(this.page);
  evaluate = this.page.evaluate.bind(this.page);
  setBlank = async () => await this.evaluate(() => Calc.setBlank());
  keyboard = this.page.keyboard;

  /** Helpers */
  async getState() {
    return await this.evaluate(() => Calc.getState());
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

  async setLatex(latex: string) {
    await this.evaluate((latex) => {
      Calc.controller.dispatch({
        type: "set-item-latex",
        id: Calc.controller.getSelectedItem()!.id,
        latex,
      });
    }, latex);
  }

  async waitForFocusedMathquill() {
    return await this.waitForFunction(() => {
      return Desmos.Private.Fragile.MathquillView.getFocusedMathquill();
    });
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
    // State is same
    const stateOld = await this.getState();
    await this.setBlank();
    const stateNew = await this.getState();
    stateOld.randomSeed = stateNew.randomSeed;
    expect(stateOld).toEqual(stateNew);
    // Sidebar isn't open
    await this.assertSelectorNot(".dcg-resources-cover");
    await this.assertSelector(
      // Open-keypad button is visible
      ".dcg-show-keypad-container",
      // Keypad isn't open
      ".dcg-keys-container[aria-hidden]"
    );
    // There's no visible mathquill, except those that are children of keypad
    // (which don't get removed rom the DOM tree)
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
