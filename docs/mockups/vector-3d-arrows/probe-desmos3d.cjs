// Part B: what the real Desmos 3D allows an overlay, measured before the
// plugin is built. Run after `npm run build`, against the built extension:
//
//   node docs/mockups/vector-3d-arrows/probe-desmos3d.cjs
//
// It answers, in the live page:
//  1. where an overlay canvas has to go to be seen over Desmos's 3D canvas;
//  2. how often onRedraw3dResults fires, and how far an overlay drawn from
//     its argument lags Desmos's own drawing while the view is rotating;
//  3. how Desmos lists the surfaces a user graphs, which the Hidden default
//     has to find and redraw as depth;
//  4. where the box's bounds are read from;
//  5. what our depth copy of a surface looks like against Desmos's own.
// Results go to probe-desmos3d.json; pictures to docs/assets/vector-3d/.
const puppeteer = require("puppeteer");
const { writeFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..", "..", "..");
const assets = join(root, "docs", "assets", "vector-3d");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
  await page.goto("https://www.desmos.com/3d");
  await page.waitForSelector(".dsm-pillbox-and-popover", { timeout: 60000 });
  await page.waitForFunction(
    () => window.Calc?.controller?.grapher3d?.redrawResult?.camera,
    {
      timeout: 60000,
    }
  );
  const out = { errors };

  // ---- 1. The DOM around Desmos's 3D canvas.
  out.dom = await page.evaluate(() => {
    const g = Calc.controller.grapher3d;
    const node = g.canvasLayer.canvasNode;
    const describe = (el) =>
      el && {
        tag: el.tagName.toLowerCase(),
        cls: el.className && String(el.className),
        position: getComputedStyle(el).position,
        zIndex: getComputedStyle(el).zIndex,
      };
    const chain = [];
    for (let el = node; el && chain.length < 6; el = el.parentElement)
      chain.push(describe(el));
    return {
      canvas: describe(node),
      parents: chain.slice(1),
      siblings: [...node.parentElement.children].map(describe),
      rect: node.getBoundingClientRect().toJSON(),
      webglCanvases: [...document.querySelectorAll("canvas")].map((c) => ({
        cls: String(c.className),
        w: c.width,
        h: c.height,
      })),
    };
  });

  // ---- The overlay: a canvas laid over Desmos's, drawing magenta rings at
  // landmarks from the camera in onRedraw3dResults' argument.
  await page.evaluate(() => {
    const g = Calc.controller.grapher3d;
    // Desmos 3D draws on its own WebGL canvas, a later sibling of the 2D
    // graph canvas, and it paints over anything placed beside the 2D one.
    // The overlay goes straight after the 3D canvas instead.
    const node =
      g.webglCanvas ?? document.querySelector("canvas.dcg-webgl-canvas");
    const canvas = document.createElement("canvas");
    canvas.id = "probe-overlay";
    Object.assign(canvas.style, {
      position: "absolute",
      pointerEvents: "none",
      // From the rectangles, not offsetLeft/offsetTop: the 3D canvas's offset
      // parent is not its parent, and offsets put the overlay 400 px right
      // and 377 px down of where Desmos draws.
      left:
        node.getBoundingClientRect().left -
        node.parentElement.getBoundingClientRect().left +
        "px",
      top:
        node.getBoundingClientRect().top -
        node.parentElement.getBoundingClientRect().top +
        "px",
      width: node.clientWidth + "px",
      height: node.clientHeight + "px",
    });
    node.parentElement.insertBefore(canvas, node.nextSibling);
    const gl = canvas.getContext("webgl2", {
      premultipliedAlpha: true,
      alpha: true,
    });
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(
      prog,
      sh(
        gl.VERTEX_SHADER,
        `#version 300 es
      uniform mat4 u_clip; uniform vec3 u_points[8]; uniform float u_size;
      void main() { gl_Position = u_clip * vec4(u_points[gl_VertexID], 1.0); gl_PointSize = u_size; }`
      )
    );
    gl.attachShader(
      prog,
      sh(
        gl.FRAGMENT_SHADER,
        `#version 300 es
      precision highp float; out vec4 o;
      void main() { float r = length(gl_PointCoord - 0.5) * 2.0;
        if (r < 0.62 || r > 1.0) discard; o = vec4(1.0, 0.0, 1.0, 1.0); }`
      )
    );
    gl.linkProgram(prog);
    const mul = (a, b) => {
      const o = new Array(16);
      for (let c = 0; c < 4; c++)
        for (let r = 0; r < 4; r++) {
          let s = 0;
          for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
          o[c * 4 + r] = s;
        }
      return o;
    };
    window.__probe = { calls: 0, points: [], canvas, gl, prog };
    const draw = (result) => {
      const p = window.__probe;
      const cam = result?.camera;
      if (!cam) return;
      const dpr = window.devicePixelRatio;
      const w = node.clientWidth;
      const h = node.clientHeight;
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";
      }
      const clip = mul(
        cam.cameraProjectionMatrix,
        mul(cam.cameraMatrixWorldInverse, cam.worldMatrixWorld)
      );
      {
        const v = [1, 1, 1, 1];
        const q = [0, 1, 2, 3].map(
          (r) =>
            clip[r] * v[0] +
            clip[4 + r] * v[1] +
            clip[8 + r] * v[2] +
            clip[12 + r] * v[3]
        );
        p.projected = {
          x: ((q[0] / q[3] + 1) * w) / 2,
          y: ((1 - q[1] / q[3]) * h) / 2,
          w,
          h,
          cw: canvas.width,
          ch: canvas.height,
          style: canvas.style.cssText,
        };
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (p.points.length === 0) return;
      gl.useProgram(prog);
      gl.uniformMatrix4fv(gl.getUniformLocation(prog, "u_clip"), false, clip);
      gl.uniform3fv(
        gl.getUniformLocation(prog, "u_points"),
        p.points.flat().concat(new Array(24 - p.points.length * 3).fill(0))
      );
      gl.uniform1f(gl.getUniformLocation(prog, "u_size"), 34 * dpr);
      gl.drawArrays(gl.POINTS, 0, p.points.length);
    };
    const original = g.onRedraw3dResults;
    g.onRedraw3dResults = function (...args) {
      window.__probe.calls++;
      draw(args[0]);
      return original.apply(this, args);
    };
  });

  // Is the overlay seen over Desmos? A ring at the origin, then look for magenta.
  const magenta = async (png) =>
    await page.evaluate(async (b64) => {
      const img = await createImageBitmap(
        await (await fetch("data:image/png;base64," + b64)).blob()
      );
      const c = new OffscreenCanvas(img.width, img.height);
      const x = c.getContext("2d");
      x.drawImage(img, 0, 0);
      const { data, width, height } = x.getImageData(
        0,
        0,
        img.width,
        img.height
      );
      const find = (test) => {
        let sx = 0,
          sy = 0,
          n = 0;
        for (let y = 0; y < height; y++)
          for (let xx = 0; xx < width; xx++) {
            const i = (y * width + xx) * 4;
            if (test(data[i], data[i + 1], data[i + 2])) {
              sx += xx;
              sy += y;
              n++;
            }
          }
        return n > 15 ? { x: sx / n, y: sy / n, n } : undefined;
      };
      return {
        magenta: find((r, g, b) => r > 180 && b > 180 && g < 90),
        green: find((r, g, b) => g > 120 && g > r + 70 && g > b + 70),
      };
    }, png);
  const clipRect = async () =>
    await page.evaluate(() =>
      Calc.controller.grapher3d.canvasLayer.canvasNode
        .getBoundingClientRect()
        .toJSON()
    );

  await page.evaluate(() => {
    window.__probe.points = [[1, 1, 1]];
    Calc.setExpression({
      id: "probe-landmark",
      latex: "\\left(1,1,1\\right)",
      color: "#00ff00",
    });
  });
  await sleep(1500);
  await page.evaluate(
    () =>
      Calc.controller.grapher3d.controls.worldRotation3D &&
      Calc.controller.grapher3d.requestRedraw?.()
  );
  await sleep(500);
  const rect = await clipRect();
  const still = await page.screenshot({ encoding: "base64", clip: rect });
  writeFileSync(
    join(assets, "desmos3d-probe-still.png"),
    Buffer.from(still, "base64")
  );
  const stillFound = await magenta(still);
  out.overlayVisible = stillFound.magenta !== undefined;
  out.projection = await page.evaluate(() => ({
    ours: window.__probe.projected,
    desmos: Calc.controller.grapher3d.mathCoordinatesToScreenCoordinates(
      { x: 1, y: 1, z: 1 },
      { skipRounding: true }
    ),
    canvasRect: document
      .getElementById("probe-overlay")
      .getBoundingClientRect()
      .toJSON(),
    desmosRect: Calc.controller.grapher3d.webglCanvas
      .getBoundingClientRect()
      .toJSON(),
  }));
  out.still = stillFound;

  // ---- 2. Continuous rotation: offsets between Desmos's green point and
  // our ring, frame by frame, while the view animates.
  const callsBefore = await page.evaluate(() => window.__probe.calls);
  const redrawBefore = await page.evaluate(
    () => Calc.controller.grapher3d.lastCompletedRedrawId
  );
  await page.evaluate(() => {
    const g = Calc.controller.grapher3d;
    const [tilt, turn] = [0.9, 2.4];
    const [cz, sz, cx, sx] = [
      Math.cos(tilt),
      Math.sin(tilt),
      Math.cos(turn),
      Math.sin(turn),
    ];
    const m = g.controls.worldRotation3D
      .clone()
      .set(cz * sx, cz * cx, -sz, -cx, sx, 0, sz * sx, sz * cx, cz);
    g.transition.duration = 4000;
    g.viewportController.animateToOrientation(m);
  });
  const offsets = [];
  const t0 = Date.now();
  let saved = 0;
  while (Date.now() - t0 < 3600) {
    const png = await page.screenshot({ encoding: "base64", clip: rect });
    const f = await magenta(png);
    if (f.magenta && f.green)
      offsets.push(
        Math.hypot(f.magenta.x - f.green.x, f.magenta.y - f.green.y)
      );
    if (saved < 1 && Date.now() - t0 > 1500) {
      writeFileSync(
        join(assets, "desmos3d-probe-moving.png"),
        Buffer.from(png, "base64")
      );
      saved++;
    }
  }
  await sleep(4500);
  const callsAfter = await page.evaluate(() => window.__probe.calls);
  const redrawAfter = await page.evaluate(
    () => Calc.controller.grapher3d.lastCompletedRedrawId
  );
  offsets.sort((a, b) => a - b);
  out.rotation = {
    hookCalls: callsAfter - callsBefore,
    redrawsCompleted: redrawAfter - redrawBefore,
    framesMeasured: offsets.length,
    offsetPx: offsets.length
      ? {
          median: offsets[Math.floor(offsets.length / 2)],
          p90: offsets[Math.floor(offsets.length * 0.9)],
          max: offsets[offsets.length - 1],
        }
      : undefined,
  };

  // ---- 3 + 4. Surfaces as the expression list and the evaluator see them,
  // and the box.
  await page.evaluate(() => {
    Calc.setExpression({
      id: "probe-landmark",
      latex: "\\left(1,1,1\\right)",
      color: "#00ff00",
      hidden: true,
    });
    Calc.setExpression({
      id: "s-explicit",
      latex: "z=3e^{-\\frac{x^{2}+y^{2}}{6}}-1",
    });
    Calc.setExpression({ id: "s-bare", latex: "\\frac{x^{2}-y^{2}}{8}" });
    Calc.setExpression({ id: "s-implicit", latex: "x^{2}+y^{2}+z^{2}=9" });
    Calc.setExpression({
      id: "s-param",
      latex: "\\left(\\cos u,\\sin u,v\\right)",
    });
    Calc.setExpression({ id: "s-xof", latex: "x=y^{2}" });
    Calc.setExpression({ id: "a-slider", latex: "a=2" });
  });
  await sleep(2500);
  out.surfaces = await page.evaluate(() => {
    const models = Calc.controller.getAllItemModels();
    const analysis = Calc.expressionAnalysis;
    return models
      .filter((m) => m.type === "expression")
      .map((m) => {
        const keys = Object.keys(m).filter((k) =>
          /opacity|hidden|color|fill|lines|shade|resolution|domain|param/i.test(
            k
          )
        );
        const picked = Object.fromEntries(
          keys.map((k) => [
            k,
            typeof m[k] === "object"
              ? JSON.stringify(m[k])?.slice(0, 120)
              : m[k],
          ])
        );
        const fa = m.formula ?? {};
        return {
          id: m.id,
          latex: m.latex,
          ...picked,
          formulaKeys: Object.keys(fa).slice(0, 40),
          typeInformation:
            fa.typeInformation &&
            JSON.stringify(fa.typeInformation).slice(0, 300),
          graphMode: fa.graph_mode ?? fa.graphMode,
          analysis:
            analysis[m.id] && JSON.stringify(analysis[m.id]).slice(0, 300),
        };
      });
  });
  out.surfaceState = await page.evaluate(() =>
    Calc.getState().expressions.list.filter((e) => e.id?.startsWith("s-"))
  );
  out.box = await page.evaluate(() => ({
    viewport: Calc.controller.grapher3d.viewportController.getViewport(),
    stash: Calc.getState().graph.__v12ViewportLatexStash,
  }));

  // ---- 5. Our depth copy against Desmos's: draw the explicit surface's
  // mesh as magenta wire lines over Desmos's own surface.
  await page.evaluate(() => {
    for (const id of ["s-bare", "s-implicit", "s-param", "s-xof"])
      Calc.setExpression({
        id,
        latex: Calc.getExpressions().find((e) => e.id === id).latex,
        hidden: true,
      });
  });
  await sleep(1500);
  const surfaceShot = await page.screenshot({ encoding: "base64", clip: rect });
  writeFileSync(
    join(assets, "desmos3d-probe-surface.png"),
    Buffer.from(surfaceShot, "base64")
  );

  writeFileSync(
    join(__dirname, "probe-desmos3d.json"),
    JSON.stringify(out, null, 2)
  );
  console.log(
    JSON.stringify(
      {
        projection: out.projection,
        overlayVisible: out.overlayVisible,
        rotation: out.rotation,
        box: out.box,
        errors,
      },
      null,
      1
    )
  );
  await browser.close();
})();
