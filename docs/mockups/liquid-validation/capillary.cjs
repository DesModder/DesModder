// Round-5 capillary checks at the production 6.25 mm resolution.
// Static circular 2-D drop: report spurious currents.
// Slightly elliptical 2-D drop: compare n=2 oscillation period with
// omega^2 = n(n^2-1) sigma/(rho R^3), n=2.
const { Liquid } = require("./liquid.cjs");
const dx = +(process.env.DX || 0.00625),
  nx = +(process.env.NX || 80),
  ny = +(process.env.NY || 80);
const dt = Math.sqrt((3e-5 * dx) / 9.81),
  rhoPhys = 1000,
  sigma = +(process.env.SIGMA || 0.072);
const tau = 0.5 + (3e-6 * dt) / (dx * dx);
const capillaryCoeff = (3 * sigma * dt * dt) / (rhoPhys * dx ** 3);
const Rm = +(process.env.R || 0.04),
  R = Rm / dx,
  cx = nx / 2,
  cy = ny / 2;
const eps = +(process.env.EPS || 0.08),
  oscillate = !!process.env.OSC;
const ax = R * (oscillate ? 1 + eps : 1),
  ay = R * (oscillate ? 1 / (1 + eps) : 1);
function fillEllipse(x, y) {
  // 4x4 area sample is enough for the oracle initialization and avoids a
  // binary stair-step masquerading as capillary noise.
  let n = 0;
  for (let j = 0; j < 4; j++)
    for (let i = 0; i < 4; i++) {
      const xx = x + (i + 0.5) / 4,
        yy = y + (j + 0.5) / 4;
      if (((xx - cx) / ax) ** 2 + ((yy - cy) / ay) ** 2 <= 1) n++;
    }
  return n / 16;
}
const s = new Liquid({
  nx,
  ny,
  tau,
  smagorinsky: 0,
  gravity: 0,
  bubbles: false,
  fillRate: 0,
  closePockets: false,
  instantFill: true,
  interfaceFlux: process.env.FLUX || "average",
  capillaryCoeff,
  solid: (x, y) => x === 0 || x === nx - 1 || y === 0 || y === ny - 1,
  fill: fillEllipse,
});
const initialMass = s.totalMass();
function shape() {
  let m = 0,
    mx = 0,
    my = 0;
  for (let k = 0; k < s.N; k++)
    if (s.type[k] === 1 || s.type[k] === 2) {
      const q = s.mass[k];
      m += q;
      mx += q * ((k % nx) + 0.5);
      my += q * (Math.floor(k / nx) + 0.5);
    }
  mx /= m;
  my /= m;
  let xx = 0,
    yy = 0,
    xy = 0,
    maxU = 0;
  for (let k = 0; k < s.N; k++)
    if (s.type[k] === 1 || s.type[k] === 2) {
      const q = s.mass[k],
        x = (k % nx) + 0.5 - mx,
        y = Math.floor(k / nx) + 0.5 - my;
      xx += q * x * x;
      yy += q * y * y;
      xy += q * x * y;
      maxU = Math.max(maxU, Math.hypot(s.ux[k], s.uy[k]));
    }
  const tr = (xx + yy) / m,
    det = (xx * yy - xy * xy) / (m * m),
    d = Math.sqrt(Math.max(0, tr * tr - 4 * det));
  return { mode: d / Math.max(1e-30, tr), maxU };
}
const theory = 2 * Math.PI * Math.sqrt((rhoPhys * Rm ** 3) / (6 * sigma));
let t = 0,
  initialShape = shape(),
  prev = initialShape.mode,
  prevSlope = 0,
  turn = [],
  peakU = initialShape.maxU;
const tend = +(process.env.TEND || (oscillate ? 1.7 * theory : 0.5));
while (t < tend) {
  s.oneStep();
  t += dt;
  if (s.steps % 10 === 0) {
    const z = shape();
    peakU = Math.max(peakU, z.maxU);
    const slope = z.mode - prev;
    if (prevSlope !== 0 && slope * prevSlope < 0) turn.push([t, z.mode]);
    prevSlope = slope;
    prev = z.mode;
  }
}
const z = shape();
let measured = NaN;
if (oscillate && turn.length >= 3) measured = turn[2][0] - turn[0][0]; // same-sign extrema
console.log(
  `capillary ${oscillate ? "oscillation" : "static"} dx ${(dx * 1000).toFixed(2)} mm R ${(Rm * 100).toFixed(1)} cm sigma ${sigma} coeff ${capillaryCoeff.toExponential(3)} FLUX ${process.env.FLUX || "average"} | theory T ${theory.toFixed(3)} s measured ${Number.isFinite(measured) ? measured.toFixed(3) : "n/a"} s | peak speed ${((peakU * dx) / dt).toFixed(4)} m/s final max speed ${((z.maxU * dx) / dt).toFixed(4)} m/s | mode ${z.mode.toFixed(4)} | mass drift ${((s.totalMass() - initialMass) / initialMass).toExponential(2)}`
);
