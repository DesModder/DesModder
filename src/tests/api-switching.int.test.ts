import { Browser, Page } from "puppeteer";
import { testWithPage } from "./puppeteer-utils";

testWithPage("No crash when switching from calc to 3d", async (driver) => {
  // Always starts on /calculator.
  await driver.click(".dcg-action-current-tool");
  await driver.click('[href="/3d"]');
  await driver.assertPath("/3d");
  await driver.click(".dsm-action-menu");
  await driver.assertSelector(".dsm-menu-container");
});

testWithPage(
  "Plugin settings preserved when switching calc to 3d",
  async (driver) => {
    // Tweak setting
    await driver.assertSelector(".dcg-action-zoomin");
    await driver.setPluginSetting("builtin-settings", "zoomButtons", false);
    await driver.assertSelectorNot(".dcg-action-zoomin");

    // Tweak plugin enabled
    await driver.assertSelector('[data-buttonid="dsm-vc-menu"]');
    await driver.disablePlugin("video-creator");
    await driver.assertSelectorNot('[data-buttonid="dsm-vc-menu"]');

    // Switch to 3d. Same settings should be kept
    await driver.click(".dcg-action-current-tool");
    await driver.click('[href="/3d"]');
    await driver.assertPath("/3d");
    await driver.assertSelectorNot(".dcg-action-zoomin");
    await driver.assertSelectorNot('[data-buttonid="dsm-vc-menu"]');

    // Revert settings, just to make sure they can be
    await driver.setPluginSetting("builtin-settings", "zoomButtons", true);
    await driver.assertSelector(".dcg-action-zoomin");
    await driver.enablePlugin("video-creator");
    await driver.assertSelector('[data-buttonid="dsm-vc-menu"]');
  }
);

async function normalizedHtml(page: Page) {
  let html = await page.$eval("html", (elem) => elem.outerHTML);
  // Sometimes the script gets removed, sometimes it's not.
  html = html.replace(
    /<script src="chrome-extension:\/\/[^/]+\/script.js"><\/script>/,
    ""
  );
  // This div has tabindex depending on activeElement, ref `getShiftTabElementTabIndex`.
  html = html.replace(
    /<div tabindex="(0|-1)"><\/div>(<canvas class="dcg-graph-inner")/,
    "$2"
  );
  return html;
}

test("DSM destroy reverts page HTML", async () => {
  const browser = (globalThis as any).__BROWSER_GLOBAL__ as Browser;
  const page = await browser.newPage();
  const url =
    "https://desmos.com/calculator?dsmTestingDelayLoad&dsmTestingSuppressAutoRestart";
  await page.goto(url);
  await page.waitForSelector(".dcg-grapher");

  const dcgSubstring = "dcg-container";
  const vcSel = '.dsm-action-menu[data-buttonid="dsm-vc-menu"]';
  const vcSubstring = 'data-buttonid="dsm-vc-menu"';

  const beforeHtml = await normalizedHtml(page);
  expect(beforeHtml.includes(dcgSubstring)).toBe(true);
  expect(beforeHtml.includes(vcSubstring)).toBe(false);

  await page.waitForFunction(() => !!(window as any).DesModder.init);
  await page.evaluate(() => (window as any).DesModder.init());

  await page.waitForSelector(vcSel);

  const dsmHtml = await normalizedHtml(page);
  expect(dsmHtml.includes(dcgSubstring)).toBe(true);
  expect(dsmHtml.includes(vcSubstring)).toBe(true);

  await page.evaluate(() => {
    (window as any).dsmTestingSuppressAutoRestart = true;
    (window as any).DSM.destroy();
  });
  await page.waitForFunction(() => !document.querySelector(".dsm-usage-tip"));

  const afterHtml = await normalizedHtml(page);
  expect(afterHtml.includes(dcgSubstring)).toBe(true);
  expect(afterHtml.includes(vcSubstring)).toBe(false);

  // The big test: HTML is the same before and after.
  expect(afterHtml).toEqual(beforeHtml);

  // If that fails, the following code helps debug:
  // ```js
  // const fs = require("fs");
  // fs.writeFileSync("before.html", beforeHtml);
  // fs.writeFileSync("after.html", afterHtml);
  // ```js
  // And shell commands:
  // `npx prettier --write before.html after.html`
  // `git diff --no-index before.html after.html > diff.html`

  await page.close();
});
