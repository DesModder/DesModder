import { clean, testWithPage } from "#tests";

testWithPage("Alt-Q toggles code golf", async (driver) => {
  await driver.setPluginSetting("code-golf", "showWidth", false);
  await driver.focusIndex(0);
  await driver.setLatexAndSync("ab\\int_{u}^{v}\\frac{\\left|x\\right|}{2}");

  await driver.assertSelectorNot(".dsm-code-golf-char-count");

  // Alt-q with an expression focused.
  await driver.keyboard.down("Alt");
  await driver.keyboard.press("q");
  await driver.keyboard.up("Alt");

  // Code-golf should toggle on
  await driver.assertSelector(".dsm-code-golf-char-count");

  const text = await driver.$eval(
    ".dsm-code-golf-char-count",
    (elem) => (elem as HTMLElement).innerText
  );
  expect(text).toEqual("Symbol Count: 10");

  await driver.click(".dcg-graph-outer");

  // Alt-q with graph focused
  await driver.keyboard.down("Alt");
  await driver.keyboard.press("q");
  await driver.keyboard.up("Alt");

  // Code-golf should toggle off
  await driver.assertSelectorNot(".dsm-code-golf-char-count");

  // Clean up
  await driver.clean();
  return clean;
});
