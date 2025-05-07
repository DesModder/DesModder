import { testWithPage } from "#tests";

const CAPTURE = ".dsm-menu-container .dsm-vc-capture-menu";
const PREVIEW = ".dsm-menu-container .dsm-vc-preview-menu";
const EXPORT = ".dsm-menu-container .dsm-vc-export-menu";
const EXPANDED = ".dsm-vc-preview-expanded";

describe("Video Creator", () => {
  testWithPage("Menuing", async (driver) => {
    // Open menu. It should be FFmpeg loading
    await driver.click("[data-buttonid='dsm-vc-menu']");
    await driver.assertSelector(".dsm-menu-container .dsm-delayed-reveal");

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
  });
});
