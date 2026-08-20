import { clean, Driver, testWithPage } from "#tests";
import type { KeyInput } from "puppeteer";

async function pressKeys(driver: Driver, keys: KeyInput[]) {
  for (const key of keys) await driver.keyboard.press(key);
}

testWithPage("Backslash Commands", async (driver) => {
  await driver.enablePlugin("custom-mathquill-config");
  await driver.setPluginSetting(
    "custom-mathquill-config",
    "backslashCommands",
    true
  );
  await driver.focusIndex(0);

  await pressKeys(driver, ["Backslash", "s", "q", "r", "t"]);
  await driver.assertSelector(".dsm-latex-command-input");
  expect(
    await driver.$eval(".dsm-latex-command-input", (el) =>
      el.textContent?.replace(/\u200b/g, "")
    )
  ).toBe("\\sqrt");

  await pressKeys(driver, ["ArrowLeft"]);
  expect(
    await driver.$eval(".dsm-latex-command-input", (el) =>
      el.getAttribute("data-cursor-index")
    )
  ).toBe("3");
  await driver.click('[data-dsm-command-index="1"]');
  expect(
    await driver.$eval(".dsm-latex-command-input", (el) =>
      el.getAttribute("data-cursor-index")
    )
  ).toBe("1");
  await pressKeys(driver, [
    "ArrowRight",
    "ArrowRight",
    "ArrowRight",
    "ArrowRight",
  ]);
  expect(
    await driver.$eval(".dsm-latex-command-input", (el) =>
      el.getAttribute("data-cursor-index")
    )
  ).toBe("4");

  await pressKeys(driver, ["Space", "x"]);
  await driver.assertSelectorNot(".dsm-latex-command-input");
  await driver.assertSelectedItemLatex("\\sqrt{x}");

  await pressKeys(driver, [
    "Backslash",
    ...Array<KeyInput>(32).fill("a"),
    ...Array<KeyInput>(32).fill("Backspace"),
    "Backspace",
  ]);
  await driver.assertSelectorNot(".dsm-latex-command-input");
  await driver.assertSelectedItemLatex("\\sqrt{x}");

  await pressKeys(driver, ["Backslash", "Shift"]);
  await driver.assertSelector(".dsm-latex-command-input");
  await pressKeys(driver, ["Backspace"]);
  await driver.assertSelectorNot(".dsm-latex-command-input");
  await driver.assertSelectedItemLatex("\\sqrt{x}");

  await pressKeys(driver, [
    "ArrowRight",
    "+",
    "Backslash",
    "a",
    "l",
    "p",
    "h",
    "a",
  ]);
  await driver.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await driver.assertSelectedItemLatex("\\sqrt{x}+\\alpha");

  await pressKeys(driver, [
    "+",
    "Backslash",
    "f",
    "r",
    "a",
    "c",
    "{",
    "a",
    "+",
    "1",
    "}",
    "{",
    "b",
    "_",
    "2",
    "}",
    "Space",
  ]);
  await driver.assertSelectedItemLatex("\\sqrt{x}+\\alpha+\\frac{a+1}{b_{2}}");

  await driver.clean();
  return clean;
});
