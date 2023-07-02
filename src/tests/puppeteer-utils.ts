import { DWindow } from "../globals/window";
import { join } from "path";
import puppeteer, { Browser, Page } from "puppeteer";

/** Calc is only available inside evaluate() callbacks and friends, since those
 * stringify the function and evaluate it inside the browser */
declare let Calc: DWindow["Calc"];

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
  constructor(public page: Page) {}

  async assertSelector(sel: string) {
    const el = await this.page.$(sel);
    expect(el).toBeTruthy();
  }

  async assertSelectorNot(sel: string) {
    const el = await this.page.$(sel);
    expect(el).toBeFalsy();
  }

  async assertSelectorEventually(sel: string) {
    const el = await this.page.waitForSelector(sel);
    expect(el).toBeTruthy();
  }

  async getState() {
    return await this.page.evaluate(() => Calc.getState());
  }

  async assertClean() {
    // State is same
    const stateOld = await this.getState();
    await this.page.evaluate(() => Calc.setBlank());
    const stateNew = await this.getState();
    stateOld.randomSeed = stateNew.randomSeed;
    expect(stateOld).toEqual(stateNew);
    // Sidebar isn't open
    await this.assertSelectorNot(".dcg-resources-cover");
    // Open-keypad button is visible
    await this.assertSelector(".dcg-show-keypad-container");
    // Keypad isn't open
    await this.assertSelector(".dcg-keys-container[aria-hidden]");
    // There's no visible mathquill, except those that are children of keypad
    // (which don't get removed rom the DOM tree)
    const allMathquillAreInKeypad = await this.page.$$eval(
      ".dcg-mq-root-block:not(.dcg-mq-empty)",
      (elems) => elems.every((e) => e.closest(".dcg-keypad"))
    );
    expect(allMathquillAreInKeypad).toBeTruthy();
    // Menus aren't open
    await this.assertSelectorNot(".dsm-menu-container");
    await this.assertSelectorNot(".dsm-vc-capture-menu");
    await this.assertSelectorNot(".dcg-shared-modal-container");
    await this.assertSelectorNot(".dcg-popover-interior");
    await this.assertSelectorNot(".dcg-modal-container div *");
  }
}
