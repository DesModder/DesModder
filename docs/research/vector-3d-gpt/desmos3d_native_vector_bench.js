/*
Paste into DevTools on https://www.desmos.com/3d .
Measures expression-set -> first changed grapher3d.redrawResult latency for one
native vector list expression. It does NOT measure sustained orbit FPS.
Uses private grapher3d.redrawResult only as a completion signal and cleans up.
*/
(async () => {
  if (!globalThis.Calc?.controller?.grapher3d)
    throw new Error("Run this on desmos.com/3d with Calc available.");
  const sizes = [4, 5, 6, 7, 8, 9, 10, 11, 12]; // n^3 = 64..1728 vectors
  const rows = [];
  const sleepFrame = () =>
    new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const waitRedraw = (before, timeout = 8000) =>
    new Promise((resolve, reject) => {
      const t0 = performance.now();
      (function poll() {
        if (Calc.controller.grapher3d.redrawResult !== before)
          return resolve(performance.now() - t0);
        if (performance.now() - t0 > timeout)
          return reject(new Error("redraw timeout"));
        requestAnimationFrame(poll);
      })();
    });
  function list(xs) {
    return "[" + xs.map((x) => Number(x.toFixed(5))).join(",") + "]";
  }
  for (const n of sizes) {
    const X = [],
      Y = [],
      Z = [],
      U = [],
      V = [],
      W = [];
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        for (let k = 0; k < n; k++) {
          const x = -2 + (4 * i) / (n - 1),
            y = -2 + (4 * j) / (n - 1),
            z = -2 + (4 * k) / (n - 1);
          const r2 = x * x + y * y + z * z + 0.08,
            r = Math.sqrt(r2);
          X.push(x);
          Y.push(y);
          Z.push(z);
          U.push(x / (r2 * r));
          V.push(y / (r2 * r));
          W.push(z / (r2 * r));
        }
    // A single expression whose arguments are lists of 3D points.
    const latex = `\\operatorname{vector}((${list(X)},${list(Y)},${list(Z)}),(${list(X)}+0.22${list(U)},${list(Y)}+0.22${list(V)},${list(Z)}+0.22${list(W)}))`;
    const before = Calc.controller.grapher3d.redrawResult;
    const t0 = performance.now();
    Calc.setExpression({ id: "vt3d-native-bench", latex });
    let firstRedrawMs;
    try {
      firstRedrawMs = await waitRedraw(before);
    } catch (e) {
      firstRedrawMs = null;
    }
    await sleepFrame();
    rows.push({
      n,
      vectors: n ** 3,
      latexChars: latex.length,
      setExpressionCallMs: performance.now() - t0 - (firstRedrawMs ?? 0),
      firstRedrawMs,
    });
    console.table(rows);
  }
  Calc.removeExpression({ id: "vt3d-native-bench" });
  console.log(
    "Vector Tools 3D native-vector benchmark complete. Save console.table output with browser/GPU details."
  );
  return rows;
})();
