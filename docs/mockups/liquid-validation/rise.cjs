// A 6.3 cm air bubble rising through still water, against Collins (1965): V = 0.58 √(g d).
const { Liquid } = require("./liquid.cjs");
const nx = +(process.env.NX || 160),
  ny = Math.round(nx * 0.6),
  r = nx / 160;
const dx = 1 / nx,
  dt = Math.sqrt((3e-5 * dx) / 9.81),
  tau = 0.5 + (3e-6 * dt) / dx / dx,
  K = (101325 * 3 * dt * dt) / (1000 * dx * dx);
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
const rows = [];
let lastY = cy0,
  lastT = 0;
try {
  for (let n = 1; n * dt <= 0.6; n++) {
    s.oneStep();
    if (n % Math.round(0.05 / dt) === 0) {
      const [v, y] = measure();
      rows.push(
        `t ${(n * dt).toFixed(2)} gas ${((v / area0) * 100).toFixed(0)}% height ${(y * dx * 100).toFixed(1)} cm`
      );
    }
  }
} catch (e) {
  rows.push(e.message);
}
// rise speed between 0.15 and 0.45 s from the rows
console.log(
  `${nx} cells, d ${(d * 100).toFixed(1)} cm, Collins ${collins.toFixed(2)} m/s, K ${K.toFixed(3)} ${process.env.NOFILL ? "nofill " : ""}${process.env.NOCLOSE ? "noclose " : ""}${process.env.INSTANT ? "instant " : ""}${process.env.GAS || "regions"}\n  ` +
    rows.join("\n  ")
);
