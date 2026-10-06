import { testWithPageAndOpts, type Driver } from "../../tests/puppeteer-utils";
import {
  cameraFromRedrawResult,
  mathToClip,
  projectToScreen,
} from "../../field-rendering/camera3d";
import type { Calc as CalcType } from "#globals";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

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

    await driver.disablePlugin("vector-tools");
    const gone = await driver.page.evaluate(
      () => document.getElementById("dsm-vector-tools-3d-canvas") === null
    );
    expect(gone).toBe(true);
    await driver.setBlank();
  }
);
