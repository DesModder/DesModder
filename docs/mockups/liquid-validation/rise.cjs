// A 6.3 cm air bubble rising through still water, against Collins (1965): V = 0.58 √(g d).
const { Liquid, physicalSliceDrag } = require("./liquid.cjs");
const nx = +(process.env.NX || 160),
  ny = Math.round(nx * 0.6),
  r = nx / 160;
const dx = 1 / nx,
  dt = Math.sqrt((3e-5 * dx) / 9.81),
  tau = 0.5 + (3e-6 * dt) / dx / dx,
  K = (101325 * 3 * dt * dt) / (1000 * dx * dx);
const sigma = +(process.env.SIGMA || 0),
  capillaryCoeff = (3 * sigma * dt * dt) / (1000 * dx * dx * dx),
  slice = physicalSliceDrag({
    nu: 1e-6,
    depth: +(process.env.B || Infinity),
    dx,
    dt,
    quadratic: +(process.env.CQ || 0),
  });
const R = 5 * r,
  cy0 = 30 * r;
const s = new Liquid({
  nx,
  ny,
  tau: +(process.env.TAU || tau),
  smagorinsky: +(process.env.SMAG ?? 0.1),
  gravity: 3e-5,
  atmosphere: K,
  fillRate: process.env.NOFILL ? 0 : 0.05,
  closePockets: !process.env.NOCLOSE,
  instantFill: !!process.env.INSTANT,
  gasModel: process.env.GAS || "regions",
  minBubble: +(process.env.MINB ?? 4),
  maxGauge: +(process.env.GAUGE || Infinity),
  wallSlip: +(process.env.SLIP || 0),
  interfaceFlux: process.env.FLUX || "average",
  capillaryCoeff,
  spanwiseLinear: slice.linear,
  spanwiseQuadratic: slice.quadratic,
  solid: (x, y) => x === 0 || x === nx - 1 || y === 0,
  fill: (x, y) =>
    y >= 1 && y <= 70 * r && (x - 80 * r) ** 2 + (y - cy0) ** 2 > R * R ? 1 : 0,
});
let area0 = 0;
const measure = () => {
  let v = 0,
    cy = 0;
  for (let y = 1; y < 64 * r; y++)
    for (let x = 1; x < nx - 1; x++) {
      const k = y * nx + x;
      const g = s.type[k] === 0 ? 1 : s.type[k] === 1 ? 1 - s.phi[k] : 0;
      v += g;
      cy += g * y;
    }
  return [v, v ? cy / v : 0];
};
[area0] = measure();
const d = Math.sqrt((4 * area0) / Math.PI) * dx,
  collins = 0.58 * Math.sqrt(9.81 * d);
const rows = [],
  samples = [];
try {
  for (let n = 1; n * dt <= +(process.env.TEND || 0.6); n++) {
    s.oneStep();
    if (n % Math.round(0.05 / dt) === 0) {
      const [v, y] = measure();
      const tt = n * dt;
      samples.push([tt, y * dx]);
      rows.push(
        `t ${tt.toFixed(2)} gas ${((v / area0) * 100).toFixed(0)}% height ${(y * dx * 100).toFixed(1)} cm`
      );
    }
  }
} catch (e) {
  rows.push(e.message);
}
const fit = samples.filter(([t]) => t >= 0.15 && t <= 0.45);
let speed = NaN;
if (fit.length >= 2) {
  const mt = fit.reduce((a, q) => a + q[0], 0) / fit.length,
    my = fit.reduce((a, q) => a + q[1], 0) / fit.length;
  const num = fit.reduce((a, q) => a + (q[0] - mt) * (q[1] - my), 0);
  const den = fit.reduce((a, q) => a + (q[0] - mt) ** 2, 0);
  speed = num / den;
}
console.log(
  `${nx} cells, d ${(d * 100).toFixed(1)} cm, Collins ${collins.toFixed(2)} m/s, measured ${speed.toFixed(2)} m/s, FLUX ${process.env.FLUX || "average"}, SIGMA ${sigma}, B ${process.env.B || "inf"}, CQ ${process.env.CQ || 0}, K ${K.toFixed(3)} ${process.env.NOFILL ? "nofill " : ""}${process.env.NOCLOSE ? "noclose " : ""}${process.env.INSTANT ? "instant " : ""}${process.env.GAS || "regions"}\n  ` +
    rows.join("\n  ")
);
