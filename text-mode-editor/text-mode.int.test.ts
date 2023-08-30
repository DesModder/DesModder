import { clean, testWithPage } from "#tests";

const TOGGLE = ".dsm-text-mode-toggle";
const EDITOR = ".cm-editor";

testWithPage("Text Mode Panel", async (driver) => {
  // Toggle button does not appear at start
  await driver.assertSelectorNot(TOGGLE);
  await driver.enablePlugin("text-mode");

  // Panel gets toggled
  await driver.assertSelectorNot(EDITOR);
  await driver.click(TOGGLE);
  await driver.assertSelector(EDITOR);
  await driver.click(TOGGLE);
  await driver.assertSelectorNot(EDITOR);

  // Clean up
  await driver.clean();
  return clean;
});
