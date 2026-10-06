// Quasi-2D free-decay target from Bäuerlein & Avila (JFM 2021):
// tank width L=0.5 m, water depth h=0.4 m, span b=0.05 m,
// measured first-mode delta = 0.065 +/- 0.015 s^-1, omega = 7.86 +/- 0.10 s^-1.
const { Liquid, physicalSliceDrag } = require("./liquid.cjs");
const dx = +(process.env.DX || 0.00625),
  L = 0.5,
  H = 0.4;
const nx = Math.round(L / dx) + 2,
  ny = Math.round(0.48 / dx) + 2;
const dt = Math.sqrt((3e-5 * dx) / 9.81),
  tau = 0.5 + (3e-6 * dt) / (dx * dx);
const sigma = +(process.env.SIGMA || 0);
const slice = physicalSliceDrag({
  nu: 1e-6,
  depth: +(process.env.B || Infinity),
  dx,
  dt,
  quadratic: +(process.env.CQ || 0),
});
const amp = +(process.env.AMP || 0.02),
  A = amp / dx,
  h = H / dx,
  k = Math.PI / L;
const eta = (x) => A * Math.cos((Math.PI * (x - 1 + 0.5)) / (nx - 2));
const s = new Liquid({
  nx,
  ny,
  tau,
  smagorinsky: +(process.env.SMAG ?? 0.1),
  gravity: 3e-5,
  bubbles: false,
  fillRate: 0,
  closePockets: false,
  instantFill: true,
  wallSlip: +(process.env.SLIP || 1),
  interfaceFlux: process.env.FLUX || "average",
  capillaryCoeff: (3 * sigma * dt * dt) / (1000 * dx ** 3),
  spanwiseLinear: slice.linear,
  spanwiseQuadratic: slice.quadratic,
  solid: (x, y) => x === 0 || x === nx - 1 || y === 0,
  fill: (x, y) => Math.max(0, Math.min(1, h + eta(x) - (y - 0.5))),
});
function mode() {
  let a = 0;
  for (let x = 1; x < nx - 1; x++) {
    let c = 0;
    for (let y = 1; y < ny; y++) c += s.phi[y * nx + x];
    a += (c - h) * Math.cos((Math.PI * (x - 1 + 0.5)) / (nx - 2));
  }
  return (2 * a) / (nx - 2);
}
const omega = Math.sqrt(9.81 * k * Math.tanh(k * H)),
  T = (2 * Math.PI) / omega;
const sampleEvery = Math.max(1, +(process.env.SAMPLE || 20));
let prev = mode(),
  peak = Math.abs(prev),
  t = 0;
const crossings = [],
  amps = [];
while (t < +(process.env.TEND || 1.3)) {
  s.oneStep();
  t += dt;
  if (s.steps % sampleEvery) continue;
  const v = mode();
  peak = Math.max(peak, Math.abs(v));
  if (prev > 0 != v > 0) {
    crossings.push(t);
    amps.push(peak * dx);
    peak = 0;
  }
  prev = v;
}
const halfs = crossings.slice(1).map((c, i) => c - crossings[i]);
const period = halfs.length
  ? (2 * halfs.reduce((a, b) => a + b, 0)) / halfs.length
  : NaN;
const ratio = amps.length >= 3 ? amps[2] / amps[0] : NaN;
const delta = Number.isFinite(ratio) ? -Math.log(ratio) / period : NaN;
console.log(
  `sloshing dx ${(dx * 1000).toFixed(2)} mm cells ${nx}x${ny} B ${process.env.B || "inf"} CQ ${process.env.CQ || 0} SMAG ${process.env.SMAG ?? 0.1} FLUX ${process.env.FLUX || "average"} | theory T ${T.toFixed(3)} s measured ${period.toFixed(3)} s | delta ${delta.toFixed(3)} 1/s vs exp 0.065+/-0.015 | loss/period ${(100 * (1 - ratio)).toFixed(1)}% | amps cm ${amps.map((x) => (100 * x).toFixed(2)).join(" ")}`
);
