import { testWithPageAndOpts, type Driver } from "../../tests/puppeteer-utils";
import {
  cameraFromRedrawResult,
  mathToClip,
  projectToScreen,
} from "../../field-rendering/camera3d";
import type { Calc as CalcType } from "#globals";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { PANEL_TABS } from "./model";

declare let Calc: CalcType;
declare let DSM: Window["DSM"];

/**
 * Live 3D arrows in the real Desmos 3D: where the canvas goes, that a field
 * draws, and that an arrow lands where `camera3d` says Desmos would draw it.
 * Pictures go to `docs/assets/vector-3d/`, because most of what can go wrong
 * here is visible and silent.
 */

const ASSETS = join(__dirname, "..", "..", "..", "docs", "assets", "vector-3d");

interface VectorTools3D {
  updateConfig: (update: (config: any) => void) => void;
  arrow3dFrame?: {
    instances: number;
    count: number;
    shape: string;
    speedScale: number;
    scaleSource: string;
  };
  arrowStatus: string;
}

async function waitForRedraw(driver: Driver) {
  const since = await driver.page.evaluate(
    () => (Calc.controller.grapher3d as any).lastCompletedRedrawId as number
  );
  await driver.page.evaluate(() =>
    (Calc.controller.grapher3d as any).redrawAllLayers?.()
  );
  await driver.page
    .waitForFunction(
      (since: number) => {
        const g = Calc.controller.grapher3d as any;
        return (
          g.lastCompletedRedrawId > since &&
          g.lastCompletedRedrawId === g.redrawRequestId
        );
      },
      { timeout: 5000, polling: 50 },
      since
    )
    .catch(() => {});
  await driver.page.evaluate(
    async () =>
      await new Promise((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        )
      )
  );
}

async function configure(driver: Driver, script: string) {
  await driver.page.evaluate((script: string) => {
    const vt = DSM.enabledPlugins["vector-tools"] as unknown as VectorTools3D;
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    vt.updateConfig(new Function("config", script) as (config: any) => void);
  }, script);
  await waitForRedraw(driver);
}

async function frame(driver: Driver) {
  return await driver.page.evaluate(() => {
    const vt = DSM.enabledPlugins["vector-tools"] as unknown as VectorTools3D;
    return { frame: vt.arrow3dFrame, status: vt.arrowStatus };
  });
}

/** A screenshot of the 3D graph, with the camera of the frame it shows. */
async function capture(driver: Driver) {
  const { result, rect } = await driver.page.evaluate(() => {
    const g = Calc.controller.grapher3d as any;
    const { camera } = g.redrawResult;
    const r = g.webglCanvas.getBoundingClientRect();
    return {
      result: {
        camera: {
          worldMatrixWorld: Array.from(camera.worldMatrixWorld as number[]),
          cameraMatrixWorldInverse: Array.from(
            camera.cameraMatrixWorldInverse as number[]
          ),
          cameraProjectionMatrix: Array.from(
            camera.cameraProjectionMatrix as number[]
          ),
          cameraType: camera.cameraType,
        },
        screen: { ...g.redrawResult.screen },
      },
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
    };
  });
  const png = await driver.page.screenshot({
    encoding: "base64",
    clip: rect,
  });
  return { camera: cameraFromRedrawResult(result)!, png };
}

/** Every pure-green pixel, in CSS pixels from the graph's corner. */
async function greenPixels(driver: Driver, png: string) {
  return await driver.page.evaluate(async (b64: string) => {
    const img = await createImageBitmap(
      await (await fetch("data:image/png;base64," + b64)).blob()
    );
    const canvas = new OffscreenCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const { data, width, height } = ctx.getImageData(
      0,
      0,
      img.width,
      img.height
    );
    const dpr = window.devicePixelRatio;
    const out: [number, number][] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (data[i + 1] > 150 && data[i] < 90 && data[i + 2] < 90)
          out.push([(x + 0.5) / dpr, (y + 0.5) / dpr]);
      }
    }
    return out;
  }, png);
}

testWithPageAndOpts(
  "Vector Tools offers its 3D settings on Desmos 3D, and keeps them",
  { path: "/3d", timeout: 120000 },
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    await driver.assertSelectorEventually(
      ".dsm-action-menu .dsm-icon-compass2"
    );
    await driver.click(".dsm-action-menu .dsm-icon-compass2");
    const index = PANEL_TABS.findIndex((tab) => tab.id === "arrows");
    await driver.click(
      `.dsm-vector-tools-tabs .dcg-segmented-control-btn:nth-child(${index + 1})`
    );
    // The 3D sections replace the 2D length and arrowhead ones, which mean
    // nothing in a rotatable box.
    await driver.assertSelectorEventually("#dsm-vector-tools-3d-look");
    await driver.assertSelectorNot("#dsm-vector-tools-arrowhead-size");
    await driver.click('#dsm-vector-tools-3d-look [data-value="cloud"]');
    await driver.page.waitForFunction(
      () =>
        (DSM.enabledPlugins["vector-tools"] as any).volume3dFrame?.look ===
        "cloud",
      { timeout: 5000 }
    );
    // Stored with the field, so a reload draws the same picture.
    const stored = await driver.page.evaluate(() => {
      const library = JSON.parse(
        DSM.pluginSettings["vector-tools"]!.serializedFieldConfig as string
      );
      return library.fields.find(
        (field: { id: string }) => field.id === library.activeId
      ).space3d.look;
    });
    expect(stored).toBe("cloud");
    // R is offered on 3D, beside P and Q.
    const fieldIndex = PANEL_TABS.findIndex((tab) => tab.id === "field");
    await driver.click(
      `.dsm-vector-tools-tabs .dcg-segmented-control-btn:nth-child(${fieldIndex + 1})`
    );
    await driver.page.waitForFunction(
      () =>
        [...document.querySelectorAll(".dsm-vector-tools-label")].some(
          (label) => label.textContent === "R(x, y, z)"
        ),
      { timeout: 5000 }
    );
    await driver.click(
      `.dsm-vector-tools-tabs .dcg-segmented-control-btn:nth-child(${index + 1})`
    );
    await waitForRedraw(driver);
    mkdirSync(ASSETS, { recursive: true });
    await driver.page.screenshot({ path: join(ASSETS, "plugin-panel-3d.png") });
    await driver.click('#dsm-vector-tools-3d-look [data-value="arrows"]');
    await driver.disablePlugin("vector-tools");
    await driver.setBlank();
  }
);

testWithPageAndOpts(
  "Vector Tools draws live arrows over Desmos 3D",
  { path: "/3d", timeout: 120000 },
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    await driver.page.waitForFunction(
      () => DSM.enabledPlugins["vector-tools"] !== undefined
    );

    // A point charge, the field the colour scale was settled against.
    await configure(
      driver,
      `config.arrowMode = "live";
       config.space3d.look = "arrows";
       config.source = "components";
       config.components.xLatex = "\\\\frac{x}{\\\\left(x^{2}+y^{2}+z^{2}\\\\right)^{1.5}}";
       config.components.yLatex = "\\\\frac{y}{\\\\left(x^{2}+y^{2}+z^{2}\\\\right)^{1.5}}";
       config.components.zLatex = "\\\\frac{z}{\\\\left(x^{2}+y^{2}+z^{2}\\\\right)^{1.5}}";`
    );

    // The canvas goes straight after Desmos's own 3D canvas and covers it;
    // beside the 2D canvas, Desmos paints over it.
    const placement = await driver.page.evaluate(() => {
      const g = Calc.controller.grapher3d as any;
      const ours = document.getElementById("dsm-vector-tools-3d-canvas");
      const a = ours?.getBoundingClientRect();
      const b = (g.webglCanvas as HTMLCanvasElement).getBoundingClientRect();
      return {
        exists: ours !== null,
        afterDesmos: ours?.previousElementSibling === g.webglCanvas,
        offset: a && [
          a.x - b.x,
          a.y - b.y,
          a.width - b.width,
          a.height - b.height,
        ],
        arrows2d:
          document.getElementById("dsm-vector-tools-arrow-canvas") !== null,
      };
    });
    expect(placement.exists).toBe(true);
    expect(placement.afterDesmos).toBe(true);
    expect(placement.offset!.every((d) => Math.abs(d) < 0.5)).toBe(true);
    // Only one of ours on a page: the 2D arrows stay unmounted on 3D.
    expect(placement.arrows2d).toBe(false);

    const charge = await frame(driver);
    expect(charge.frame?.instances).toBeGreaterThan(0);
    expect(charge.frame?.scaleSource).toBe("field");
    expect(charge.status).toContain("live in 3D");
    mkdirSync(ASSETS, { recursive: true });
    const shot = await capture(driver);
    writeFileSync(
      join(ASSETS, "plugin-charge.png"),
      Buffer.from(shot.png, "base64")
    );

    // The cutaway: nothing, the near half, a cake slice. Coloured pixels
    // stand in for arrows, since Desmos's own scene is grey.
    const coloured = async (png: string) =>
      await driver.page.evaluate(async (b64: string) => {
        const img = await createImageBitmap(
          await (await fetch("data:image/png;base64," + b64)).blob()
        );
        const c = new OffscreenCanvas(img.width, img.height);
        const x = c.getContext("2d")!;
        x.drawImage(img, 0, 0);
        const { data } = x.getImageData(0, 0, img.width, img.height);
        let n = 0;
        for (let i = 0; i < data.length; i += 4) {
          const hi = Math.max(data[i], data[i + 1], data[i + 2]);
          const lo = Math.min(data[i], data[i + 1], data[i + 2]);
          if (hi - lo > 60) n++;
        }
        return n;
      }, png);
    const cuts: Record<string, number> = {};
    for (const cutaway of ["off", "half", "wedge"]) {
      await configure(driver, `config.space3d.cutaway = "${cutaway}";`);
      const { png: cutShot } = await capture(driver);
      if (cutaway !== "off")
        writeFileSync(
          join(ASSETS, `plugin-cutaway-${cutaway}.png`),
          Buffer.from(cutShot, "base64")
        );
      cuts[cutaway] = await coloured(cutShot);
    }
    // A quarter of the box gone takes roughly a quarter of the arrows; the
    // near half, roughly half. Loose bounds: arrows overlap on screen.
    expect(cuts.wedge).toBeLessThan(cuts.off * 0.92);
    expect(cuts.wedge).toBeGreaterThan(cuts.off * 0.5);
    expect(cuts.half).toBeLessThan(cuts.off * 0.75);
    // Fixing the slice keeps it where the camera looks now.
    const fixedTurn = await driver.page.evaluate(() => {
      const vt = DSM.enabledPlugins["vector-tools"] as any;
      vt.setSpace3D("cutaway", "wedge");
      vt.setCakeSliceFixed(true);
      return {
        turn: vt.space3d.cutTurn as number,
        facing: vt.arrow3dFrame.cameraAzimuth as number,
      };
    });
    expect(fixedTurn.turn).toBeCloseTo(fixedTurn.facing, 6);
    await configure(
      driver,
      `config.space3d.cutaway = "off"; config.space3d.cutTurn = null;`
    );

    // The looks that show the middle: streamlines and the glow cloud, on a
    // dipole. They swap the renderer, so the overlay remounts under them.
    // +1 at (0, 0, 1) and −1 at (0, 0, −1). Each component's two numerators
    // differ only for z, whose numerator is the distance to its own charge.
    const dipole = (above: string, below: string) =>
      String.raw`\frac{${above}}{\left(x^{2}+y^{2}+\left(z-1\right)^{2}\right)^{1.5}}-\frac{${below}}{\left(x^{2}+y^{2}+\left(z+1\right)^{2}\right)^{1.5}}`;
    // Into a page-side script string, where a lone backslash would escape.
    const quoted = (latex: string) => JSON.stringify(latex);
    await configure(
      driver,
      `config.components.xLatex = ${quoted(dipole("x", "x"))};
       config.components.yLatex = ${quoted(dipole("y", "y"))};
       config.components.zLatex = ${quoted(dipole("z-1", "z+1"))};
       config.space3d.look = "streamlines";
       config.space3d.animate = false;`
    );
    const volume = async () =>
      await driver.page.evaluate(
        () => (DSM.enabledPlugins["vector-tools"] as any).volume3dFrame
      );
    expect((await volume())?.look).toBe("streamlines");
    expect((await volume())?.count).toBeGreaterThan(100);
    const still = await capture(driver);
    writeFileSync(
      join(ASSETS, "plugin-streamlines.png"),
      Buffer.from(still.png, "base64")
    );
    expect(await coloured(still.png)).toBeGreaterThan(2000);
    // Animated, the lit stretches move between frames.
    await configure(driver, `config.space3d.animate = true;`);
    const first = (await capture(driver)).png;
    await new Promise((resolve) => setTimeout(resolve, 400));
    const second = (await capture(driver)).png;
    expect(second).not.toBe(first);
    await configure(
      driver,
      `config.space3d.look = "cloud"; config.space3d.cloudByDirection = true;`
    );
    expect((await volume())?.look).toBe("cloud");
    const cloud = await capture(driver);
    writeFileSync(
      join(ASSETS, "plugin-cloud.png"),
      Buffer.from(cloud.png, "base64")
    );
    expect(await coloured(cloud.png)).toBeGreaterThan(2000);
    await configure(
      driver,
      `config.space3d.look = "arrows"; config.space3d.cloudByDirection = false;`
    );
    expect((await frame(driver)).frame?.instances).toBeGreaterThan(0);

    // One arrow, along +x from the box's centre, in pure green: its tail and
    // tip have to land where camera3d projects them from the camera of the
    // frame Desmos drew.
    await configure(
      driver,
      `config.components.xLatex = "1";
       config.components.yLatex = "0";
       config.components.zLatex = "0";
       config.color.mode = "fixed";
       config.color.fixedColor = "#00ff00";
       Object.assign(config.space3d, {
         placement: "grid", countAuto: false, count: 1, shape: "lines",
         shading: false, fog: false, lengthAuto: false, lengthMultiple: 0.2,
       });`
    );
    const one = await frame(driver);
    expect(one.frame?.instances).toBe(1);
    const { camera, png } = await capture(driver);
    writeFileSync(
      join(ASSETS, "plugin-one-arrow.png"),
      Buffer.from(png, "base64")
    );
    const green = await greenPixels(driver, png);
    expect(green.length).toBeGreaterThan(10);
    const box = await driver.page.evaluate(() =>
      (Calc.controller.grapher3d as any).viewportController.getViewport()
    );
    const centre = [
      (box.xmin + box.xmax) / 2,
      (box.ymin + box.ymax) / 2,
      (box.zmin + box.zmax) / 2,
    ];
    // Length 0.2 × the spacing (two half-widths for one arrow) = 0.4 half-widths.
    const tipX = centre[0] + 0.4 * ((box.xmax - box.xmin) / 2);
    const clip = mathToClip(camera);
    const tail = projectToScreen(
      camera,
      centre[0],
      centre[1],
      centre[2],
      clip
    )!;
    const tip = projectToScreen(camera, tipX, centre[1], centre[2], clip)!;
    const nearest = (p: { x: number; y: number }) =>
      Math.min(...green.map(([x, y]) => Math.hypot(x - p.x, y - p.y)));
    // The drawn line is a pixel or so wide and antialiased, so "on it" is
    // within two pixels of a green one.
    expect(nearest(tail)).toBeLessThan(2);
    expect(nearest(tip)).toBeLessThan(2);
    // And nothing green strays beyond the arrow's own extent.
    const along = green.map(
      ([x, y]) =>
        ((x - tail.x) * (tip.x - tail.x) + (y - tail.y) * (tip.y - tail.y)) /
        Math.hypot(tip.x - tail.x, tip.y - tail.y)
    );
    const length = Math.hypot(tip.x - tail.x, tip.y - tail.y);
    expect(Math.min(...along)).toBeGreaterThan(-2);
    expect(Math.max(...along)).toBeLessThan(length + 2);

    // Hidden, faded, X-ray: a black plane above the arrow, seen from above.
    // Desmos's depth cannot be read, so this works only through our own
    // depth copy of the plane, found in the expression list.
    await driver.page.evaluate(() => {
      Calc.setExpression({ id: "roof", latex: "z=2", color: "#000000" });
    });
    const greenish = async (png: string) =>
      await driver.page.evaluate(async (b64: string) => {
        const img = await createImageBitmap(
          await (await fetch("data:image/png;base64," + b64)).blob()
        );
        const c = new OffscreenCanvas(img.width, img.height);
        const x = c.getContext("2d")!;
        x.drawImage(img, 0, 0);
        const { data } = x.getImageData(0, 0, img.width, img.height);
        let n = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 1] > data[i] + 30 && data[i + 1] > data[i + 2] + 30) n++;
        }
        return n;
      }, png);
    const looks: Record<string, number> = {};
    for (const occlusion of ["hide", "fade", "over"]) {
      await configure(driver, `config.space3d.occlusion = "${occlusion}";`);
      // The rescan that finds the roof is coalesced; give it its turn.
      await driver.page.waitForFunction(
        () =>
          ((DSM.enabledPlugins["vector-tools"] as any).arrow3dFrame
            ?.hidingSurfaces ?? 0) > 0 ||
          (DSM.enabledPlugins["vector-tools"] as any).space3d.occlusion ===
            "over",
        { timeout: 5000 }
      );
      await waitForRedraw(driver);
      const { png: shot } = await capture(driver);
      writeFileSync(
        join(ASSETS, `plugin-occlusion-${occlusion}.png`),
        Buffer.from(shot, "base64")
      );
      looks[occlusion] = await greenish(shot);
    }
    expect(looks.hide).toBe(0);
    expect(looks.over).toBeGreaterThan(10);
    expect(looks.fade).toBeGreaterThan(5);

    // A surface the copy cannot be made of is named, not silently ignored.
    await driver.page.evaluate(() => {
      Calc.setExpression({ id: "ball", latex: "x^{2}+y^{2}+z^{2}=9" });
    });
    await configure(driver, `config.space3d.occlusion = "hide";`);
    await driver.page.waitForFunction(
      () =>
        (DSM.enabledPlugins["vector-tools"] as any).arrowStatus.includes(
          "show through"
        ),
      { timeout: 5000 }
    );
    await driver.page.evaluate(() => {
      Calc.removeExpression({ id: "roof" });
      Calc.removeExpression({ id: "ball" });
    });

    await driver.disablePlugin("vector-tools");
    const gone = await driver.page.evaluate(
      () => document.getElementById("dsm-vector-tools-3d-canvas") === null
    );
    expect(gone).toBe(true);
    await driver.setBlank();
  }
);
