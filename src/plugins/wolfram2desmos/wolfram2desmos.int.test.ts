import { testWithPage, clean, Driver } from "#tests";

describe("Wolfram2Desmos", () => {
  testWithPage("Enable Radical Expressions", async (driver: Driver) => {
    // Clean up
    await driver.clean();
    return clean;
  });
});
