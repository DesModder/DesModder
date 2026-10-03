import { testWithPageAndOpts, type Driver } from "#tests";
import {
  cameraFromRedrawResult,
  mathToClip,
  projectToScreen,
} from "./camera3d";
import type { Calc as CalcType } from "#globals";

// `camera3d.ts` has no runtime imports, so it runs in this Node process as it
// does in the page; only the matrices cross over.
declare let Calc: CalcType;

async function lastRedrawId(driver: Driver) {
  return await driver.page.evaluate(
    () => (Calc.controller.grapher3d as any)?.lastCompletedRedrawId ?? -1
  );
}

/**
 * Resolves once a redraw newer than `since` has finished and none is pending.
 *
 * "Newer than" matters. Straight after a `setExpression` the counters still
 * say everything is drawn, because the evaluator has not yet asked for the
 * redraw that will show the change, so waiting for them to agree returns at
 * once and the screenshot shows the frame from before.
 */
async function waitForRedraw(driver: Driver, since = -1) {
  await driver.page.waitForFunction(
    (since: number) => {
      const g = Calc.controller.grapher3d as any;
      return (
        g?.redrawResult?.camera &&
        g.lastCompletedRedrawId > since &&
        g.lastCompletedRedrawId === g.redrawRequestId &&
        !g.__redrawRequested
      );
    },
    { timeout: 15000, polling: 50 },
    since
  );
  await driver.page.evaluate(
    async () =>
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      )
  );
}

/**
 * The centroid, in CSS pixels from the canvas corner, of the pure-green pixels
 * in a screenshot. Desmos's own 3D scene has no green (axes, grid and box are
 * grey), so a landmark drawn in #00ff00 is found by colour alone, with no
 * baseline screenshot that a repaint elsewhere could invalidate.
 */
async function greenCentroid(driver: Driver, png: string, dpr: number) {
  return await driver.page.evaluate(
    async (b64: string, dpr: number) => {
      const blob = await (await fetch("data:image/png;base64," + b64)).blob();
      const img = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(img.width, img.height);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const { data, width, height } = ctx.getImageData(
        0,
        0,
        img.width,
        img.height
      );
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
          if (g > 90 && g > r + 60 && g > b + 60) {
            sx += x + 0.5;
            sy += y + 0.5;
            n++;
          }
        }
      }
      return n > 20 ? { x: sx / n / dpr, y: sy / n / dpr } : undefined;
    },
    png,
    dpr
  );
}

testWithPageAndOpts(
  "3D camera: the projection lands on the points Desmos draws",
  { path: "/3d", timeout: 90000 },
  async (driver) => {
    // A tilted, turned view of an off-centre, non-cubic box, the case most
    // likely to expose a wrong axis order or a missing translation. The
    // orientation is set the way DesModder's video creator sets it.
    //
    // The bounds go in `__v12ViewportLatexStash` as well as `viewport`: 3D
    // bounds are LaTeX, and `setState` reads the stash and ignores the numbers,
    // silently leaving the default ±5 cube. Both are then confirmed, so that a
    // view which did not take fails here, and not later as clipped landmarks
    // that look like a wrong projection.
    let applied = false;
    for (let attempt = 0; attempt < 10 && !applied; attempt++) {
      await driver.page.evaluate(() => {
        const state = Calc.getState() as any;
        const box = {
          xmin: -10,
          xmax: 10,
          ymin: -2,
          ymax: 4,
          zmin: -1,
          zmax: 3,
        };
        state.expressions = { list: [] };
        state.graph.viewport = box;
        state.graph.__v12ViewportLatexStash = Object.fromEntries(
          Object.entries(box).map(([key, value]) => [key, String(value)])
        );
        Calc.setState(state, { allowUndo: false });
        const g = Calc.controller.grapher3d as any;
        const [tilt, turn] = [0.5, 0.8];
        const [cz, sz, cx, sx] = [
          Math.cos(tilt),
          Math.sin(tilt),
          Math.cos(turn),
          Math.sin(turn),
        ];
        const m = g.controls.worldRotation3D
          .clone()
          .set(cz * sx, cz * cx, -sz, -cx, sx, 0, sz * sx, sz * cx, cz);
        g.controls.worldRotation3D = m;
        g.viewportController.animateToOrientation(m);
        g.transition.duration = 0;
      });
      await waitForRedraw(driver);
      await new Promise((resolve) => setTimeout(resolve, 300));
      applied = await driver.page.evaluate(() => {
        const g = Calc.controller.grapher3d as any;
        const vp = g.viewportController.getViewport();
        // Built with the same `set` call, because Matrix3.set takes rows and
        // stores columns, and hand-indexing the elements is how to get it wrong.
        const [cz, sz, cx, sx] = [
          Math.cos(0.5),
          Math.sin(0.5),
          Math.cos(0.8),
          Math.sin(0.8),
        ];
        const want = g.controls.worldRotation3D
          .clone()
          .set(cz * sx, cz * cx, -sz, -cx, sx, 0, sz * sx, sz * cx, cz)
          .elements as number[];
        const have = g.controls.worldRotation3D.elements as number[];
        return (
          vp.xmin === -10 &&
          vp.zmax === 3 &&
          want.every((w, i) => Math.abs(w - have[i]) < 1e-9)
        );
      });
    }
    expect(applied, "the viewport and orientation did not stick").toBe(true);
    const dpr = await driver.page.evaluate(() => window.devicePixelRatio);

    // Inside the box: Desmos clips everything to it, so a point on its
    // boundary shows only part of its sphere and its centroid moves inward.
    const landmarks: [number, number, number][] = [
      [1, 1, 1],
      [-8, -1.5, 0.2],
      [8, -1.5, 0.2],
      [-8, 3.4, 0.2],
      [8, 3.4, 0.2],
      [-8, -1.5, 2.6],
      [8, 3.4, 2.6],
      [0, 1, 2.6],
    ];
    const errors: number[] = [];
    for (const at of landmarks) {
      const since = await lastRedrawId(driver);
      await driver.page.evaluate((at: number[]) => {
        Calc.setExpression({
          id: "camera3d-landmark",
          latex: `\\left(${at.join(",")}\\right)`,
          color: "#00ff00",
        });
      }, at);
      // The first redraw after the change can still come before the evaluator
      // has the point, so look a few times before calling it hidden.
      let drawn: { x: number; y: number } | undefined;
      let frame: Awaited<ReturnType<typeof captureFrame>> | undefined;
      for (let attempt = 0; attempt < 8 && !drawn; attempt++) {
        await waitForRedraw(driver, attempt === 0 ? since : -1);
        frame = await captureFrame(driver);
        drawn = await greenCentroid(driver, frame.png, dpr);
        if (!drawn) await new Promise((resolve) => setTimeout(resolve, 150));
      }
      const camera = cameraFromRedrawResult(frame!.result);
      expect(
        camera,
        "redrawResult.camera is no longer three 4×4 matrices"
      ).toBeDefined();
      const projected = projectToScreen(camera!, ...at, mathToClip(camera!));
      expect(projected).toBeDefined();
      // A landmark behind the translucent z = 0 plane can fade below the
      // detector; one or two misses are expected, the agreement is not.
      if (drawn)
        errors.push(Math.hypot(projected!.x - drawn.x, projected!.y - drawn.y));
    }
    await driver.page.evaluate(() =>
      Calc.removeExpression({ id: "camera3d-landmark" })
    );

    expect(
      errors.length,
      "too few landmarks were visible to check"
    ).toBeGreaterThanOrEqual(5);
    const rms = Math.sqrt(
      errors.reduce((s, e) => s + e * e, 0) / errors.length
    );
    expect(
      rms,
      `RMS ${rms.toFixed(2)} px; errors ${errors.map((e) => e.toFixed(2)).join(", ")}`
    ).toBeLessThan(1);
    expect(Math.max(...errors)).toBeLessThan(2.5);
  }
);

/** The camera Desmos drew the current frame with, and a screenshot of it. */
async function captureFrame(driver: Driver) {
  const { result, rect } = await driver.page.evaluate(() => {
    const g = Calc.controller.grapher3d as any;
    const { camera } = g.redrawResult;
    const r = g.canvasLayer.canvasNode.getBoundingClientRect();
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
  // Matrices and screenshot from the same frame.
  const png = await driver.page.screenshot({ encoding: "base64", clip: rect });
  return { result, png };
}
