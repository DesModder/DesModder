import { clean, testWithPage } from "#tests";

const POPUP = ".dcg-popover-interior.dsm-performance-info-menu";
const BUTTON = "[data-buttonid='dsm-pi-menu']";
const PIN_BUTTON = ".dsm-pi-pin-menu-button";

describe("Performance info", () => {
  testWithPage("Menu opens and closes", async (driver) => {
    await driver.enablePlugin("performance-info");
    await driver.click(BUTTON);

    await driver.assertSelector(POPUP);

    const text = await driver.$eval(POPUP, (e) => (e as HTMLElement).innerText);
    expect(text.includes("Time In Worker")).toBeTruthy();

    await driver.click(BUTTON);
    await driver.assertSelectorNot(POPUP);

    // Clean up
    await driver.clean();
    return clean;
  });
  testWithPage("Pinning the menu leaves it open", async (driver) => {
    await driver.enablePlugin("performance-info");
    await driver.click(BUTTON);

    await driver.assertSelector(POPUP);
    await driver.click(PIN_BUTTON);

    await driver.click(".dcg-expression-top-bar");
    await driver.assertSelector(POPUP);

    await driver.click(PIN_BUTTON);
    await driver.click(".dcg-expression-top-bar");
    await driver.assertSelectorNot(POPUP);

    // Clean up
    await driver.clean();
    return clean;
  });
});
