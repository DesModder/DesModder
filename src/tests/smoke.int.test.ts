import { clean, testWithPage } from "./puppeteer-utils";

describe("Initial load", () => {
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
