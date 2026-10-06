// Standing wave, mode 2, in a 1 m tank of water 30 cm deep, 2 cm amplitude.
// Linear theory: ω² = g k tanh(k h), T = 0.819 s; viscous damping is negligible (2νk² ≈ 1e-4 /s).
const { Liquid } = require("./liquid.cjs");
const nx = +(process.env.NX || 160),
  ny = Math.round(nx * 0.6),
  dx = 1 / nx;
const dt = Math.sqrt((3e-5 * dx) / 9.81),
  tau = 0.5 + (3e-6 * dt) / dx / dx,
  K = (101325 * 3 * dt * dt) / (1000 * dx * dx);
const h = 0.3 / dx,
  A = 0.02 / dx,
  k = 2 * Math.PI; // per metre
const eta = (x) => A * Math.cos((2 * Math.PI * (x - 0.5)) / (nx - 2));
const s = new Liquid({
  nx,
  ny,
  tau: +(process.env.TAU || tau),
  smagorinsky: +(process.env.SMAG ?? 0.1),
  gravity: 3e-5,
  atmosphere: K,
  bubbles: !process.env.NOBUB,
  fillRate: +(process.env.FILL || 0),
  closePockets: false,
  instantFill: !process.env.NOINSTANT,
  solid: (x, y) => x === 0 || x === nx - 1 || y === 0,
  fill: (x, y) => Math.max(0, Math.min(1, h + eta(x) - (y - 0.5))),
});
const mode = () => {
  // the surface's mode-2 amplitude, in cells
  let a = 0;
  for (let x = 1; x < nx - 1; x++) {
    let c = 0;
    for (let y = 1; y < ny; y++) c += s.phi[y * nx + x];
    a += (c - h) * Math.cos((2 * Math.PI * (x - 0.5)) / (nx - 2));
  }
  return (2 * a) / (nx - 2);
};
const T = (2 * Math.PI) / Math.sqrt(9.81 * k * Math.tanh(k * 0.3));
const crossings = [],
  amps = [];
let prev = mode(),
  t = 0,
  peak = 0;
try {
  while (t < 4.2) {
    s.oneStep();
    t += dt;
    const v = mode();
    peak = Math.max(peak, Math.abs(v));
    if (prev > 0 !== v > 0) {
      crossings.push(t);
      amps.push(peak);
      peak = 0;
    }
    prev = v;
  }
} catch (e) {
  console.log(e.message);
}
const halfs = crossings.slice(1).map((c, i) => c - crossings[i]);
const period = (2 * halfs.reduce((a, b) => a + b, 0)) / halfs.length;
console.log(
  `SMAG ${process.env.SMAG ?? 0.1} NX ${nx}: theory T ${T.toFixed(3)} s, measured ${period.toFixed(3)} s | amplitude per half-period (cm): ${amps.map((a) => (a * dx * 100).toFixed(2)).join(" ")}`
);
