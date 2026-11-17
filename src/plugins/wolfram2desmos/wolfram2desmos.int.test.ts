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
    const data = new DataTransfer();
    data.setData("text/plain", text);
    const event = new ClipboardEvent("paste", {
      clipboardData: data,
    });
    document.activeElement?.dispatchEvent(event);
  }, text);
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

  await driver.clean();
  return clean;
});
