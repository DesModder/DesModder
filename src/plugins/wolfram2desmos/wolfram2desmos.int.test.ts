import { clean, Driver, testWithPage } from "#tests";

async function getText(
  driver: Driver,
  index: number
): Promise<string | undefined> {
  const item = (await driver.getState()).expressions.list[index];
  switch (item.type) {
    case "expression":
      return item.latex;
    case "text":
      return item.text;
    case "folder":
      return item.title;
    default:
      throw new Error("Not expression, sad.");
  }
}

async function paste(driver: Driver, text: string) {
  await driver.evaluate(async (text) => {
    await navigator.clipboard.writeText(text);
  }, text);

  const modifierKey = process.platform === "darwin" ? "Meta" : "Control";
  await driver.keyboard.down(modifierKey);
  await driver.keyboard.press("KeyV");
  await driver.keyboard.up(modifierKey);
}

testWithPage("wolfram2desmos", async (driver) => {
  let index = 0;

  // Test when disabled
  await driver.disablePlugin("wolfram2desmos");
  await driver.focusIndex(index);
  await paste(driver, "#f012ab");
  expect(await getText(driver, index)).toEqual("#f012ab");

  index++;
  await driver.keyboard.press("Enter");

  // Test when enabled
  await driver.enablePlugin("wolfram2desmos");
  await paste(driver, "#f012ab");
  expect(await getText(driver, index)).toEqual(
    "\\operatorname{rgb}\\left(240,18,171\\right)"
  );

  index++;
  await driver.keyboard.press("Enter");

  // Test when disabled (again)
  await driver.disablePlugin("wolfram2desmos");
  await paste(driver, "#f012ab");
  expect(await getText(driver, index)).toEqual("#f012ab");

  index++;
  await driver.keyboard.press("Enter");

  // Test text
  await driver.enablePlugin("wolfram2desmos");
  await driver.keyboard.press('"');
  await paste(driver, "#f012ab");
  expect(await getText(driver, index)).toEqual("#f012ab");

  index++;
  await driver.keyboard.press("Enter");

  // Test folder
  await driver.enablePlugin("wolfram2desmos");
  await driver.keyboard.down("Control");
  const modifierKey = process.platform === "darwin" ? "Meta" : "Alt";
  await driver.keyboard.down(modifierKey);
  await driver.keyboard.press("KeyF");
  await driver.keyboard.up(modifierKey);
  await driver.keyboard.up("Control");
  await paste(driver, "#f012ab");
  expect(await getText(driver, index)).toEqual("#f012ab");

  await driver.clean();
  return clean;
});
