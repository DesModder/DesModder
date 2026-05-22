import {
  browser,
  clean,
  testWithPage,
  testWithPageAndOpts,
  urlForPath,
} from "./puppeteer-utils";

describe("Initial load: calculator", () => {
  // These two tests could really be combined.
  //  I'm just trying two simple tests to make sure the browser remains.
  testWithPage("Shows DesModder Button", async (driver) => {
    await driver.assertSelector(".dsm-pillbox-and-popover");
    const panics = await driver.evaluate(
      () => (window as any).DSM_panics ?? []
    );
    expect(panics).toEqual([]);
    await driver.assertSelectorNot("#dsm-panic-popover");
    return clean;
  });
  testWithPage("Shows Video Creator Button", async (driver) => {
    await driver.assertSelectorEventually(".dsm-action-menu .dcg-icon-film");
    return clean;
  });
});

testWithPageAndOpts(
  "Initial load: geometry calculator",
  { path: "/geometry" },
  async (driver) => {
    await driver.assertSelector(".dsm-pillbox-and-popover");
    const panics = await driver.evaluate(
      () => (window as any).DSM_panics ?? []
    );
    expect(panics).toEqual([]);
    await driver.assertSelectorNot("#dsm-panic-popover");
  }
);

testWithPageAndOpts(
  "Initial load: 3d calculator",
  { path: "/3d" },
  async (driver) => {
    await driver.assertSelector(".dsm-pillbox-and-popover");
    const panics = await driver.evaluate(
      () => (window as any).DSM_panics ?? []
    );
    expect(panics).toEqual([]);
    await driver.assertSelectorNot("#dsm-panic-popover");
  }
);

test("Initial load: notebook", async () => {
  const page = await browser.newPage();
  await page.goto(urlForPath("/notebook"));
  // DesModder doesn't load, so there are no panics to check.
  // Just check the notebook loads.
  const el = await page.waitForSelector(".dcg-notebook-main");
  expect(el).toBeTruthy();
});
