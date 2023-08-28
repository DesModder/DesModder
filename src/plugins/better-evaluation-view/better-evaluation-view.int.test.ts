import { Driver, clean, testWithPage } from "#tests";

async function expectEval(driver: Driver, latexExpected: string) {
  const latexFound = await driver.$eval(
    ".dcg-evaluation-html .dcg-mq-root-block",
    (el) => (el as any).mqBlockNode.latex()
  );
  expect(latexFound).toBe(latexExpected);
}

async function expectEvalPlain(driver: Driver, textExpected: string) {
  const textFound = await driver.$eval(
    ".dcg-evaluation-html",
    (el) => (el as HTMLElement).innerText
  );
  expect(textFound).toBe(textExpected);
}

const COLOR_SWATCH = ".dcg-color-swatch";

testWithPage("List", async (driver) => {
  await driver.focusIndex(0);
  await driver.setLatexAndSync("[1,2,3]");
  await expectEval(driver, "\\left[1,2,3\\right]");

  // It updates when you edit the latex
  await driver.setLatexAndSync("[1,2,3,4]");
  await expectEval(driver, "\\left[1,2,3,4\\right]");

  // It gets reset on disabling lists
  await driver.setPluginSetting("better-evaluation-view", "lists", false);
  await expectEvalPlain(driver, "4 element list");

  // Clean up
  await driver.clean();
  return clean;
});

testWithPage("Color", async (driver) => {
  await driver.focusIndex(0);
  await driver.setLatexAndSync("C=\\operatorname{rgb}\\left(1,2,3\\right)");
  const exp = "\\operatorname{rgb}\\left(1,2,3\\right)";
  await expectEval(driver, exp);

  // It doesn't get reset on disabling color lists
  await driver.setPluginSetting("better-evaluation-view", "colorLists", false);
  await driver.assertSelector(COLOR_SWATCH);
  await expectEval(driver, exp);

  // It gets reset on disabling colors
  await driver.setPluginSetting("better-evaluation-view", "colors", false);
  await driver.assertSelector(COLOR_SWATCH);

  // Clean up
  await driver.clean();
  return clean;
});

testWithPage("Color List", async (driver) => {
  await driver.focusIndex(0);
  await driver.setLatexAndSync("C=\\operatorname{rgb}\\left(1,2,[3,4]\\right)");
  const exp =
    "\\operatorname{rgb}\\left(\\left[\\left(1,2,3\\right),\\left(1,2,4\\right)\\right]\\right)";
  await expectEval(driver, exp);
  await driver.assertSelector(COLOR_SWATCH);

  // It gets reset on disabling color lists
  await driver.setPluginSetting("better-evaluation-view", "colorLists", false);
  await driver.assertSelector(COLOR_SWATCH);

  // It gets reset on disabling colors
  await driver.setPluginSetting("better-evaluation-view", "colorLists", true);
  await driver.setPluginSetting("better-evaluation-view", "colors", false);
  await driver.assertSelector(COLOR_SWATCH);

  // Clean up
  await driver.clean();
  return clean;
});
