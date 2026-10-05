import { testWithPage } from "../../tests/puppeteer-utils";

declare let DSM: Window["DSM"];

/**
 * Rafael's console showed "Cannot read properties of undefined (reading
 * 'tooltip')" from the pillbox buttons. A button added twice, as a plugin
 * whose `afterEnable` threw after adding it would be on its next enable,
 * was listed twice; removing it deleted its spec and left one copy listed,
 * which every redraw read as undefined. And removing an id that was not
 * listed took away whichever button was last.
 */
testWithPage(
  "a pillbox button added twice is listed once and removed cleanly",
  async (driver) => {
    const errors: string[] = [];
    driver.page.on("pageerror", (error) => errors.push(String(error)));
    await driver.enablePlugin("vector-tools");
    await driver.assertSelectorEventually(
      ".dsm-action-menu .dsm-icon-compass2"
    );
    const listed = await driver.evaluate(() => {
      const pm = DSM.pillboxMenus!;
      const spec = pm.pillboxButtons["dsm-vector-tools-menu"];
      pm.addPillboxButton(spec);
      return pm.pillboxButtonsOrder.filter(
        (id) => id === "dsm-vector-tools-menu"
      ).length;
    });
    expect(listed).toBe(1);

    // An id nobody added leaves every other button where it is.
    const before = await driver.evaluate(() => [
      ...DSM.pillboxMenus!.pillboxButtonsOrder,
    ]);
    await driver.evaluate(() =>
      DSM.pillboxMenus!.removePillboxButton("dsm-not-a-button")
    );
    expect(
      await driver.evaluate(() => [...DSM.pillboxMenus!.pillboxButtonsOrder])
    ).toEqual(before);

    await driver.disablePlugin("vector-tools");
    await driver.waitForSync();
    await driver.assertSelectorNot(".dsm-action-menu .dsm-icon-compass2");
    expect(
      await driver.evaluate(() =>
        DSM.pillboxMenus!.pillboxButtonsOrder.includes("dsm-vector-tools-menu")
      )
    ).toBe(false);
    expect(errors).toEqual([]);
  },
  60000
);
