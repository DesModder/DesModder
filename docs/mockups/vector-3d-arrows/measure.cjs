// Drives the built mock-up in headless Chrome and records what the panel
// measures, plus contact sheets of the views a reader has to judge by eye.
//
//   node docs/mockups/vector-3d-arrows/build.mjs
//   node docs/mockups/vector-3d-arrows/measure.cjs
//
// Headless Chrome draws with a software GPU, so its frame times say nothing
// about a real one and are recorded only to show the page measures at all.
// Vertex counts, field statistics and mesh gaps do not depend on the GPU.
const puppeteer = require("puppeteer");
const { readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");

const here = __dirname;
const assets = join(here, "..", "..", "assets", "vector-3d");
mkdirSync(assets, { recursive: true });
const html = readFileSync(join(here, "..", "vector-3d-arrows.html"), "utf8");
const page_ = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${html}</body></html>`;

const frames = (page) =>
  page.evaluate(
    () =>
      new Promise((r) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => requestAnimationFrame(r))
        )
      )
  );

async function shot(page) {
  await frames(page);
  const stage = await page.$("#stage");
  return (await stage.screenshot({ encoding: "base64" })).toString();
}

async function sheet(browser, title, cells, columns, file) {
  const page = await browser.newPage();
  await page.setViewport({
    width: columns * 430 + 40,
    height: 400,
    deviceScaleFactor: 1,
  });
  const body = `<style>body{margin:0;padding:16px;font:13px Arial;background:#fff;color:#1f2226}
    h1{font-size:15px;margin:0 0 10px}.g{display:grid;grid-template-columns:repeat(${columns},420px);gap:10px}
    figure{margin:0}img{width:420px;border:1px solid #d8dbe0;display:block}figcaption{padding:3px 0;color:#5f6670}</style>
    <h1>${title}</h1><div class="g">${cells
      .map(
        (c) =>
          `<figure><img src="data:image/png;base64,${c.png}"><figcaption>${c.caption}</figcaption></figure>`
      )
      .join("")}</div>`;
  await page.setContent(body);
  await page.screenshot({ path: join(assets, file), fullPage: true });
  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.emulateMediaFeatures([
    { name: "prefers-color-scheme", value: "light" },
  ]);
  await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 });
  await page.setContent(page_);
  await frames(page);
  const set = (patch) => page.evaluate((p) => window.mockup.set(p), patch);
  const preset = (id) => page.evaluate((p) => window.mockup.preset(p), id);
  const numbers = async () => {
    await frames(page);
    return page.evaluate(() =>
      JSON.parse(JSON.stringify(window.mockup.numbers()))
    );
  };
  const out = { errors };

  await page.screenshot({ path: join(assets, "page.png"), fullPage: true });
  out.default = await numbers();

  // Closer than the page's opening view, so a contact-sheet cell shows arrows
  // rather than margin.
  await set({ view: { turn: -0.65, tilt: 0.42, zoom: 1.45, perspective: 1 } });

  // ---- Shapes against depth cues, on the dipole, no surface.
  await preset("dipole");
  await set({ surface: "", surfacePreset: "none" });
  const cues = [
    ["none", { shading: false, fog: false, outline: false, selfDepth: false }],
    ["shading", { shading: true, fog: false, outline: false, selfDepth: true }],
    ["fade", { shading: false, fog: true, outline: false, selfDepth: true }],
    ["outline", { shading: false, fog: false, outline: true, selfDepth: true }],
    ["all", { shading: true, fog: true, outline: true, selfDepth: true }],
  ];
  const cells = [];
  for (const shape of ["lines", "flat", "solid"]) {
    for (const [name, patch] of cues) {
      await set({ ...patch, shape: { auto: false, value: shape } });
      cells.push({
        png: await shot(page),
        caption: `${shape === "solid" ? "shaded 3D" : shape} · ${name}`,
      });
    }
  }
  await sheet(
    browser,
    "Dipole, 8³ arrows: arrow shape (rows) against depth cues (columns)",
    cells,
    5,
    "shapes-cues.png"
  );

  // ---- Sampling.
  await set({
    shading: true,
    fog: false,
    outline: false,
    selfDepth: true,
    shape: { auto: true, value: "solid" },
  });
  const sampling = [];
  for (const [mode, extra, caption] of [
    ["grid", {}, "whole box (Auto count)"],
    ["jitter", {}, "jittered"],
    ["slice", { sliceAxis: 1, slicePosition: 0.5 }, "slice y = 0"],
    ["slice", { sliceAxis: 2, slicePosition: 0.5 }, "slice z = 0"],
  ]) {
    await set({ sampling: mode, ...extra });
    sampling.push({ png: await shot(page), caption: `dipole · ${caption}` });
  }
  await preset("wire");
  await set({
    surface: String.raw`3e^{-\frac{x^{2}+y^{2}}{6}}-1`,
    sampling: "surface",
  });
  sampling.push({
    png: await shot(page),
    caption: "line current · on the surface",
  });
  await preset("abc");
  await set({ sampling: "grid", surface: "" });
  sampling.push({ png: await shot(page), caption: "ABC flow · whole box" });
  await sheet(browser, "Where arrows go", sampling, 3, "sampling.png");

  // ---- Poles: colour and length on the point charge and the dipole.
  out.poles = {};
  const poleCells = [];
  for (const id of ["charge", "dipole"]) {
    await preset(id);
    out.poles[id] = {};
    for (const lengthMode of [
      "normalized",
      "saturating",
      "clamped",
      "actual",
    ]) {
      for (const scaleRule of ["box", "field"]) {
        await set({
          sampling: "grid",
          lengthMode,
          scaleRule,
          scale: { auto: true, value: 1 },
          count: { auto: false, value: 10 },
        });
        const n = await numbers();
        const label = `${scaleRule === "box" ? "box rule" : "field rule"}, scale ${n.settings.autoNotes.scale}`;
        out.poles[id][`${lengthMode}, ${label}`] = n.stats;
        if (lengthMode === "normalized" || lengthMode === "saturating") {
          poleCells.push({
            png: await shot(page),
            caption: `${id} · ${lengthMode} · ${label}`,
          });
        }
      }
    }
  }
  await sheet(
    browser,
    "Poles, 10³ arrows: Auto colour scale from the box (2D's rule) against from the field (median)",
    poleCells,
    4,
    "poles.png"
  );
  await set({ scaleRule: "field" });

  // ---- Occlusion.
  await preset("rotation");
  await set({
    surface: String.raw`3e^{-\frac{x^{2}+y^{2}}{6}}-1`,
    sampling: "grid",
    count: { auto: true, value: 8 },
    scale: { auto: true, value: 1 },
    lengthMode: "normalized",
  });
  const occ = [];
  for (const occlusion of ["over", "hide", "fade"]) {
    for (const surfaceOpacity of [0.85, 0.45]) {
      await set({ occlusion, surfaceOpacity });
      occ.push({
        png: await shot(page),
        caption: `${occlusion} · surface opacity ${surfaceOpacity}`,
      });
    }
  }
  await set({
    occlusion: "hide",
    surfaceOpacity: 0.85,
    mesh: { auto: false, value: 16 },
  });
  occ.push({
    png: await shot(page),
    caption: "hide · our mesh 16 (too coarse)",
  });
  await set({ mesh: { auto: true, value: 64 } });
  occ.push({ png: await shot(page), caption: "hide · our mesh Auto" });
  await sheet(
    browser,
    "Rotation field through a bump: arrows behind the surface",
    occ,
    4,
    "occlusion.png"
  );
  out.meshGap = {};
  for (const [name, latex] of [
    ["bump", String.raw`3e^{-\frac{x^{2}+y^{2}}{6}}-1`],
    ["saddle", String.raw`\frac{x^{2}-y^{2}}{8}`],
    ["ripple", String.raw`\cos\left(\sqrt{x^{2}+y^{2}}\right)`],
  ]) {
    await set({ surface: latex });
    const n = await numbers();
    out.meshGap[name] = {
      auto: n.settings.meshResolution,
      gaps: n.gaps,
      boxPx: n.boxPx,
    };
  }

  // ---- Cost.
  out.cost = {};
  await set({ occlusion: "over", surface: "", sampling: "grid" });
  for (const count of [10, 15, 20, 30]) {
    for (const shape of ["lines", "flat", "solid"]) {
      await set({
        count: { auto: false, value: count },
        shape: { auto: false, value: shape },
      });
      await page.evaluate(() => window.mockup.benchmark());
      await page.waitForFunction(
        () =>
          !document.getElementById("benchmark").textContent.includes("Timing"),
        { timeout: 120000 }
      );
      const vertices = await page.$eval("#mVertices", (e) => e.textContent);
      if (vertices === "0")
        throw new Error(
          `Nothing drawn at ${count}³ ${shape}: ${await page.$eval("#fieldError", (e) => e.textContent)}`
        );
      out.cost[`${count}³ ${shape}`] = {
        vertices,
        result: await page.$eval("#benchmarkResult", (e) => e.textContent),
      };
    }
  }

  // ---- Perspective and box shape.
  await preset("charge");
  await set({
    count: { auto: true, value: 8 },
    shape: { auto: true, value: "solid" },
  });
  const views = [];
  for (const [patch, caption] of [
    [
      { view: { turn: -0.65, tilt: 0.42, zoom: 1.45, perspective: 0 } },
      "orthographic",
    ],
    [
      { view: { turn: -0.65, tilt: 0.42, zoom: 1.45, perspective: 3 } },
      "perspective 3",
    ],
    [
      { view: { turn: 2.5, tilt: -0.4, zoom: 1.45, perspective: 1 } },
      "from below",
    ],
    [
      {
        view: { turn: -0.65, tilt: 0.42, zoom: 1.45, perspective: 1 },
        box: { min: [-10, -2, -1], max: [10, 4, 3] },
      },
      "box [−10,10]×[−2,4]×[−1,3]",
    ],
  ]) {
    await set(patch);
    views.push({ png: await shot(page), caption: `point charge · ${caption}` });
  }
  await sheet(
    browser,
    "Camera: the overlay follows every view the stand-in draws",
    views,
    4,
    "views.png"
  );

  await browser.close();
  writeFileSync(join(here, "measurements.json"), JSON.stringify(out, null, 2));
  console.log(
    JSON.stringify(
      { errors, poles: out.poles, meshGap: out.meshGap, cost: out.cost },
      null,
      1
    )
  );
})();
