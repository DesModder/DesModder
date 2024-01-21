import { Calc as CalcType } from "#globals";
import { Driver, clean, testWithPage } from "#tests";

declare let Calc: CalcType;

async function assertKeypad(driver: Driver, expected: boolean) {
  const keypad = await driver.evaluate(() => Calc.settings.keypad);
  expect(keypad).toBe(expected);
}

describe("Builtin Settings", () => {
  testWithPage("Basic enable keypad", async (driver) => {
    await assertKeypad(driver, true);

    await driver.enablePlugin("builtin-settings");
    await assertKeypad(driver, true);

    await driver.setPluginSetting("builtin-settings", "keypad", false);
    await assertKeypad(driver, false);

    await driver.disablePlugin("builtin-settings");
    await assertKeypad(driver, true);

    // Clean up
    await driver.clean();
    return clean;
  });
});
