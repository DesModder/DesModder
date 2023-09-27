import { clean, testWithPage } from "#tests";

testWithPage("Pin", async (driver) => {
  await driver.focusIndex(0);
  await driver.setLatexAndSync("abc");
  await driver.assertSelectorNot(".dsm-pinned-expressions [expr-id]");

  // Pin expression
  await driver.enterEditListMode();
  await driver.click(".dsm-pin-button");
  await driver.assertSelector(".dsm-pinned-expressions [expr-id='1']");

  // Unpin expression
  await driver.click(".dsm-unpin-button");
  await driver.assertSelectorNot(".dsm-pinned-expressions [expr-id]");

  // Clean up
  await driver.clean();
  return clean;
});
