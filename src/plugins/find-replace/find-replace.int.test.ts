import { clean, testWithPage } from "#tests";

describe("Find-replace", () => {
  testWithPage("Basic find-replace", async (driver) => {
    // Init an expression
    await driver.focusIndex(0);
    await driver.setLatexAndSync("a+b+a");
    const latex = ((await driver.getState()).expressions.list[0] as any).latex;
    expect(latex).toBe("a+b+a");

    // Press Ctrl+F to open the menu
    await driver.keyboard.down("Control");
    await driver.keyboard.press("f");
    await driver.keyboard.up("Control");

    // Specify replacement
    await driver.click(".dcg-expression-search-bar .dcg-math-field");
    await driver.keyboard.press("a");
    await driver.click(
      ".dsm-find-replace-expression-replace-bar .dcg-math-field"
    );
    await driver.keyboard.press("c");

    // Do the replacement
    await driver.click(".dsm-find-replace-replace-all");
    const latex2 = ((await driver.getState()).expressions.list[0] as any).latex;
    expect(latex2).toBe("c+b+c");

    // Close the find-replace menu
    await driver.click(".dcg-expression-search-bar .dcg-icon-remove");

    // Clean up
    await driver.setBlank();
    return clean;
  });
});
