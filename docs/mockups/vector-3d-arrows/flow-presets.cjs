// Pictures of the 3D flow on gallery presets, in the real Desmos 3D, through
// the built extension. Run after `npm run build`:
//
//   node docs/mockups/vector-3d-arrows/flow-presets.cjs
//
// Writes docs/assets/vector-3d/flow-presets.png, a contact sheet.
const puppeteer = require("puppeteer");
const { join } = require("node:path");

const root = join(__dirname, "..", "..", "..");
const PRESETS = [
  "black-hole",
  "spiral-galaxy",
  "cellular",
  "aurora",
  "binary",
  "dipole",
];

(async () => {
  const extension = join(root, "dist");
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 760 });
  await page.goto("https://www.desmos.com/3d");
  await page.waitForSelector(".dsm-pillbox-and-popover", { timeout: 60000 });
  await page.evaluate(() => DSM.enablePlugin("vector-tools"));
  await page.waitForFunction(
    () => DSM.enabledPlugins["vector-tools"] !== undefined
  );
  const shots = [];
  for (const id of PRESETS) {
    await page.evaluate((id) => {
      const vt = DSM.enabledPlugins["vector-tools"];
      if (vt.isFlowRunning) vt.toggleFlow();
      vt.applyGalleryPreset(id, true);
      if (!vt.isFlowRunning) vt.toggleFlow();
    }, id);
    // Long enough for the trails to grow and the flow to settle.
    await new Promise((r) => setTimeout(r, 2500));
    const rect = await page.evaluate(() =>
      Calc.controller.grapher3d.webglCanvas.getBoundingClientRect().toJSON()
    );
    const png = await page.screenshot({ encoding: "base64", clip: rect });
    const name = await page.evaluate(
      () => DSM.enabledPlugins["vector-tools"].getConfig().name
    );
    shots.push({ png, caption: name });
  }
  const sheet = await browser.newPage();
  await sheet.setViewport({ width: 3 * 410 + 40, height: 400 });
  await sheet.setContent(`<style>body{margin:0;padding:14px;font:13px Arial;background:#fff}
    .g{display:grid;grid-template-columns:repeat(3,400px);gap:10px}figure{margin:0}
    img{width:400px;display:block}figcaption{color:#5f6670;padding:3px 0}</style>
    <div class="g">${shots
      .map(
        (s) =>
          `<figure><img src="data:image/png;base64,${s.png}"><figcaption>${s.caption}</figcaption></figure>`
      )
      .join("")}</div>`);
  await sheet.screenshot({
    path: join(root, "docs", "assets", "vector-3d", "flow-presets.png"),
    fullPage: true,
  });
  await browser.close();
  console.log("ok");
})();
