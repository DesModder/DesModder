import { testWithPageAndOpts, clean, testWithPage } from "#tests";

const CAPTURE = ".dsm-pillbox-popover .dsm-vc-capture-menu";
const PREVIEW = ".dsm-pillbox-popover .dsm-vc-preview-menu";
const EXPORT = ".dsm-pillbox-popover .dsm-vc-export-menu";
const EXPANDED = ".dsm-vc-preview-expanded";
const INLINE_INPUT = ".dcg-inline-math-input-view";
const INLINE_INPUT_TEXTAREA = ".dcg-inline-math-input-view textarea";

describe("Video Creator", () => {
  const url = process.env.DSM_TESTING_URL ?? "https://desmos.com/calculator";
  let testFn = testWithPageAndOpts;
  if (!url.startsWith("https://")) {
    // In non-secure contexts, self.crossOriginIsolated is false, so SharedArrayBuffer
    // cannot work. That breaks the video creator loading, so skip this test on non-https URLs.
    testFn = (name: string, _opts: unknown, cb: (driver: any) => void) =>
      test.skip(name, cb);
  }

  testFn(
    "Regular capture in /calculator",
    { timeout: 15000 },
    async (driver) => {
      // Open menu. It should be FFmpeg loading
      await driver.click("[data-buttonid='dsm-vc-menu']");
      await driver.assertSelector(".dsm-pillbox-popover .dsm-delayed-reveal");

      // Eventually, FFmpeg loads. Capture menu but no preview/export
      await driver.assertSelectorEventually(CAPTURE);
      await driver.assertSelectorNot(PREVIEW, EXPORT);

      // Click "capture" with default settings
      await driver.click(".dsm-vc-capture-frame-button");
      await driver.assertSelectorEventually(PREVIEW);
      await driver.assertSelector(CAPTURE, EXPORT);

      // Click the big preview
      await driver.click(".dsm-vc-preview-current-frame");
      await driver.assertSelector(EXPANDED);

      // Click the x
      await driver.click(".dsm-vc-exit-expanded");
      await driver.assertSelectorNot(EXPANDED);

      // Click "delete all"
      await driver.click(".dsm-vc-delete-all .dsm-btn");
      await driver.assertSelector(CAPTURE);
      await driver.assertSelectorNot(PREVIEW, EXPORT);

      // Click graphpaper to close menu
      await driver.click(".dcg-graph-outer");
    }
  );

  testFn(
    "Regular capture in /3d",
    { path: "/3d", timeout: 15000 },
    async (driver) => {
      // Open menu. It should be FFmpeg loading
      await driver.click("[data-buttonid='dsm-vc-menu']");
      await driver.assertSelector(".dsm-pillbox-popover .dsm-delayed-reveal");

      // Eventually, FFmpeg loads. Capture menu but no preview/export
      await driver.assertSelectorEventually(CAPTURE);
      await driver.assertSelectorNot(PREVIEW, EXPORT);

      // Click "capture" with default settings
      await driver.click(".dsm-vc-capture-frame-button");
      await driver.assertSelectorEventually(PREVIEW);
      await driver.assertSelector(CAPTURE, EXPORT);

      // Click the big preview
      await driver.click(".dsm-vc-preview-current-frame");
      await driver.assertSelector(EXPANDED);

      // Click the x
      await driver.click(".dsm-vc-exit-expanded");
      await driver.assertSelectorNot(EXPANDED);

      // Click "delete all"
      await driver.click(".dsm-vc-delete-all .dsm-btn");
      await driver.assertSelector(CAPTURE);
      await driver.assertSelectorNot(PREVIEW, EXPORT);

      // Click graphpaper to close menu
      await driver.click(".dcg-graph-outer");
    }
  );

  // Evaluated in the page context
  function ariaOfTextareas(nodes: Element[]) {
    return nodes.map((n) => (n.previousSibling as HTMLElement).innerText);
  }

  // Evaluated in the page context
  function ariaOfTextarea(node: Element) {
    return (node.previousSibling as HTMLElement).innerText;
  }

  testFn(
    "Arrow key movement around controls",
    { timeout: 15000 },
    async (driver) => {
      // Open menu. It should be FFmpeg loading
      await driver.click("[data-buttonid='dsm-vc-menu']");
      await driver.assertSelector(".dsm-pillbox-popover .dsm-delayed-reveal");

      // Eventually, FFmpeg loads. Capture menu but no preview/export
      await driver.assertSelectorEventually(CAPTURE);
      await driver.assertSelectorNot(PREVIEW, EXPORT);

      const container = (await driver.$(".dsm-vc-capture-container"))!;

      const firstInput = await container.$(INLINE_INPUT);
      expect(!!firstInput).toEqual(true);
      await firstInput!.click();
      const allArias = await container.$$eval(
        INLINE_INPUT_TEXTAREA,
        ariaOfTextareas
      );

      async function ariaOfActiveTextarea() {
        return await (await driver.getActiveElement()).evaluate(ariaOfTextarea);
      }

      {
        // Going forwards
        const arias = [];
        for (let i = 0; i < 4; i++) {
          arias.push(await ariaOfActiveTextarea());
          await driver.keyboard.press("End");
          await driver.keyboard.press("ArrowRight");
        }

        // all textareas traversed
        expect(arias).toEqual(allArias);
        // last arrow right did nothing
        expect(await ariaOfActiveTextarea()).toEqual(arias.at(-1));
      }

      {
        // Going backwards
        const arias = [];
        for (let i = 0; i < 4; i++) {
          arias.push(await ariaOfActiveTextarea());
          await driver.keyboard.press("Home");
          await driver.keyboard.press("ArrowLeft");
        }

        // all textareas traversed
        expect(arias).toEqual(allArias.toReversed());
        // last arrow left did nothing
        expect(await ariaOfActiveTextarea()).toEqual(arias.at(-1));
      }
    }
  );
});

testWithPage(
  "getCurrentGraphTitle should give undefined for untitled graphs",
  async (driver) => {
    const title = await driver.evaluate(() =>
      (window as any).DSM.videoCreator.util.getCurrentGraphTitle()
    );
    expect(title).toEqual(undefined);

    return clean;
  }
);

testWithPageAndOpts(
  "getCurrentGraphTitle should give undefined for untitled geometry",
  // Separate test here because geometry just says "Untitled" instead of "Untitled Graph"
  { path: "/geometry" },
  async (driver) => {
    const title = await driver.evaluate(() =>
      (window as any).DSM.videoCreator.util.getCurrentGraphTitle()
    );
    expect(title).toEqual(undefined);
  }
);

testWithPage(
  "getCurrentGraphTitle should work for titled graphs",
  async (driver) => {
    await driver.click(".dcg-open-my-graphs-button");
    await driver.click(".dcg-my-graphs-modal-examples-header");
    await driver.click("::-p-text(Lines: Slope Intercept Form)");
    await driver.page.waitForSelector(
      "::-p-text(Opened 'Lines: Slope Intercept Form')"
    );
    const title = await driver.evaluate(() =>
      (window as any).DSM.videoCreator.util.getCurrentGraphTitle()
    );
    expect(title).toEqual("Lines: Slope Intercept Form");
  }
);
