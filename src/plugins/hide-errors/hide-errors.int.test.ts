import { Driver, clean, testWithPage } from "#tests";

const ERROR = ".dcg-icon-error";
const ERROR_HIDDEN = ".dsm-he-error-hidden";
const CREATE = ".dcg-create-sliders";

async function errorHidden(driver: Driver) {
  await driver.assertSelector(ERROR);
  await driver.assertSelectorNot(CREATE);
  await driver.assertSelector(ERROR_HIDDEN);
}

async function errorHiddenNot(driver: Driver) {
  await driver.assertSelector(ERROR);
  await driver.assertSelector(CREATE);
  await driver.assertSelectorNot(ERROR_HIDDEN);
}

testWithPage("Hide button hides errors", async (driver) => {
  // Simple error shown
  await driver.focusIndex(0);
  await driver.setLatexAndSync("asdf");
  await errorHiddenNot(driver);

  // Hide error by pressing "hide"
  await driver.click(".dsm-hide-errors [ontap]");
  await errorHidden(driver);

  // Clean up
  await driver.clean();
  return clean;
});

testWithPage("Shift-click hides errors", async (driver) => {
  // Simple error shown
  await driver.focusIndex(0);
  await driver.setLatexAndSync("asdf");
  await errorHiddenNot(driver);

  // Hide error by shift-clicking error triangle
  await driver.keyboard.down("Shift");
  await driver.click(ERROR);
  await driver.keyboard.up("Shift");
  await errorHidden(driver);

  // Re-show error by shift-clicking error triangle
  await driver.keyboard.down("Shift");
  await driver.click(ERROR);
  await driver.keyboard.up("Shift");
  await errorHiddenNot(driver);

  // Clean up
  await driver.clean();
  return clean;
});
