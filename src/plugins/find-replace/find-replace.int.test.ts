import { clean, Driver, testWithPage } from "#tests";

async function getLatexStrings(driver: Driver) {
  return (await driver.getState()).expressions.list.map((expr: any) =>
    expr.type === "folder" ? "[FOLDER]" : expr.latex
  );
}

async function openSearchMenu(driver: Driver) {
  // Equivalent to pressing Ctrl+F to open the menu
  await driver.dispatch({
    type: "open-expression-search",
    rename: false,
    latex: "",
  } as any);
}

describe("Find-replace", () => {
  testWithPage("Basic find-replace", async (driver) => {
    // Init an expression
    await driver.focusIndex(0);
    await driver.setLatexAndSync("a+b+a");
    expect(await getLatexStrings(driver)).toStrictEqual(["a+b+a"]);

    await openSearchMenu(driver);

    // Specify replacement
    await driver.click(".dcg-expression-search-bar .dcg-math-field");
    await driver.keyboard.press("a");
    await driver.click(
      ".dsm-find-replace-expression-replace-bar .dcg-math-field"
    );
    await driver.keyboard.press("c");

    // Do the replacement
    await driver.click(".dsm-find-replace-replace-all");
    expect(await getLatexStrings(driver)).toStrictEqual(["c+b+c"]);

    // Close the find-replace menu
    await driver.click(".dcg-expression-search-bar .dcg-icon-remove");

    // Clean up
    await driver.setBlank();
    return clean;
  });

  testWithPage(
    "Find-replace in folder and individual exprs",
    async (driver) => {
      await driver.setState({
        version: 11,
        randomSeed: "01ced5e80e8ddb1069cf159b32250fec",
        graph: {
          viewport: {
            xmin: -10,
            ymin: -11.591355599214147,
            xmax: 10,
            ymax: 11.591355599214147,
          },
        },
        expressions: {
          list: [
            {
              type: "expression",
              id: "1",
              color: "#6042a6",
              latex: "a=0",
            },
            {
              type: "folder",
              id: "2",
              title: "a",
            },
            {
              type: "expression",
              id: "3",
              folderId: "2",
              color: "#2d70b3",
              latex: "a+1",
            },
            {
              type: "expression",
              id: "4",
              folderId: "2",
              color: "#388c46",
              latex: "a+2",
            },
            {
              type: "expression",
              id: "6",
              color: "#c74440",
              latex: "a+3",
            },
          ],
        },
        includeFunctionParametersInRandomSeed: true,
        doNotMigrateMovablePointStyle: true,
      } as any);

      expect(await getLatexStrings(driver)).toStrictEqual([
        "a=0",
        "[FOLDER]",
        "a+1",
        "a+2",
        "a+3",
      ]);

      await openSearchMenu(driver);

      await driver.click(".dcg-expression-search-bar .dcg-math-field");
      await driver.keyboard.press("a");
      await driver.click(
        ".dsm-find-replace-expression-replace-bar .dcg-math-field"
      );
      await driver.keyboard.press("c");

      await driver.waitForSelector('[expr-id="2"] .dcg-icon-replace');
      await driver.click('[expr-id="2"] .dcg-icon-replace');

      expect(await getLatexStrings(driver)).toStrictEqual([
        "a=0",
        "[FOLDER]",
        "c+1",
        "c+2",
        "a+3",
      ]);

      await driver.waitForSelector('[expr-id="1"] .dcg-icon-replace');
      await driver.click('[expr-id="1"] .dcg-icon-replace');

      expect(await getLatexStrings(driver)).toStrictEqual([
        "c=0",
        "[FOLDER]",
        "c+1",
        "c+2",
        "a+3",
      ]);
    }
  );
});
