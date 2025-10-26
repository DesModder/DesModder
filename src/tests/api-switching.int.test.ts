import { testWithPage } from "./puppeteer-utils";

describe("Switching from calc to 3d", () => {
  testWithPage("No crash when switching from calc to 3d", async (driver) => {
    // Always starts on /calculator.
    await driver.click(".dcg-action-current-tool");
    await driver.click('[href="/3d"]');
    const url = await driver.evaluate(() => window.location.href);
    expect(url).toEqual("https://www.desmos.com/3d");
    await driver.click(".dsm-action-menu");
    await driver.assertSelector(".dsm-menu-container");
  });
});
