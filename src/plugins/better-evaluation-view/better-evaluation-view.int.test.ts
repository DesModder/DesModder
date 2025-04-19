import { clean, testWithPage } from "#tests";

const COLOR_SWATCH = ".dcg-color-swatch";

testWithPage("List", async (driver) => {
  await driver.focusIndex(0);
  await driver.setLatexAndSync("[1,2,3]+0");
  await driver.expectEval("\\left[1,2,3\\right]");

  // It updates when you edit the latex
  await driver.setLatexAndSync("[1,2,3,4]+0");
  await driver.expectEval("\\left[1,2,3,4\\right]");

  // It gets reset on disabling lists, and shows the native list view instead.
  await driver.setPluginSetting("better-evaluation-view", "lists", false);
  await driver.expectEvalPlain("equals\n=\n1\n1\n2\n2\n3\n3\n4\n4");

  // Clean up
  await driver.clean();
  return clean;
});

testWithPage("Color", async (driver) => {
  await driver.focusIndex(0);
  await driver.setLatexAndSync("C=\\operatorname{rgb}\\left(1,2,3\\right)");
  const exp = "\\operatorname{rgb}\\left(1,2,3\\right)";
  await driver.expectEval(exp);

  // It doesn't get reset on disabling color lists
  await driver.setPluginSetting("better-evaluation-view", "colorLists", false);
  await driver.assertSelector(COLOR_SWATCH);
  await driver.expectEval(exp);

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
  await driver.expectEval(exp);
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
