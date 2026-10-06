// The page's scenes in real units with a chosen physics set; reports what the page would.
const { Liquid } = require("./liquid.cjs");
const nx = +(process.env.NX || 160),
  ny = Math.round(nx * 0.6),
  r = nx / 160,
  dx = 1 / nx;
const dt = Math.sqrt((3e-5 * dx) / 9.81),
  tau = 0.5 + (3e-6 * dt) / dx / dx,
  K = (101325 * 3 * dt * dt) / (1000 * dx * dx);
const NEW = !process.env.OLD;
const opts = NEW
  ? {
      atmosphere: K,
      bubbles: true,
      fillRate: 0,
      closePockets: false,
      instantFill: true,
      wallSlip: 1,
      minBubble: +(process.env.MINB ?? 4),
      maxGauge: +(process.env.GAUGE || Infinity),
    }
  : {
      bubbles: false,
      fillRate: 0.05,
      closePockets: true,
      instantFill: false,
      wallSlip: +(process.env.SLIP || 0),
    };
const wall = (x, y) => x === 0 || x === nx - 1 || y === 0;
const scene = process.env.SCENE || "dam";
const MM = [
  [0.41, 1.11],
  [0.84, 1.22],
  [1.19, 1.44],
  [1.43, 1.67],
  [1.63, 1.89],
  [1.83, 2.11],
  [1.98, 2.33],
  [2.2, 2.56],
  [2.32, 2.78],
  [2.51, 3],
  [2.65, 3.22],
  [2.83, 3.44],
  [2.97, 3.67],
  [3.11, 3.89],
  [3.33, 4.11],
];
const a = Math.round(30 * r);
const make = {
  dam: () =>
    new Liquid({
      nx,
      ny,
      tau,
      gravity: 3e-5,
      ...opts,
      solid: wall,
      fill: (x, y) => (x >= 1 && x <= a && y >= 1 && y <= 2 * a ? 1 : 0),
    }),
  pour: () =>
    new Liquid({
      nx,
      ny,
      tau,
      gravity: 3e-5,
      ...opts,
      solid: (x, y) =>
        wall(x, y) || (y === Math.round(40 * r) && x > 30 * r && x < 90 * r),
      fill: () => 0,
    }),
}[scene];
const s = make(),
  m0 = s.totalMass();
let out = [];
const t0 = Date.now();
try {
  if (scene === "dam") {
    let i = 0,
      err = 0;
    const xs = [];
    for (let n = 1; i < MM.length; n++) {
      s.oneStep();
      const T = n * Math.sqrt((2 * 3e-5) / a);
      if (T >= MM[i][0]) {
        let f = 0;
        const rows = Math.max(1, Math.round(a / 10));
        for (let x = 1; x < nx - 1; x++)
          for (let y = 1; y <= rows; y++)
            if (s.phi[y * nx + x] >= 0.5) f = Math.max(f, x);
        xs.push(f / a);
        err += (f / a - MM[i][1]) / MM[i][1];
        i++;
      }
    }
    out.push(
      `front mean ${((100 * err) / MM.length).toFixed(1)}% (+ ahead), late speed ${((xs[14] - xs[6]) / (3.33 - 1.98)).toFixed(2)} vs MM 1.32, last X ${xs
        .slice(-3)
        .map((x) => x.toFixed(2))
        .join(" ")}`
    );
    s.step(Math.round(2 / dt) - s.steps); // on to 2 s: the slosh
  } else {
    const per = (0.025 * 1.0 * dt) / (dx * dx);
    for (let n = 0; n * dt < 3; n++) {
      if (n % 4 === 0 && s.poured < 0.4 * nx * ny)
        s.pour(60 * r, 85 * r, 0.0125 / dx, 4 * per, (1.0 * dt) / dx);
      s.oneStep();
    }
  }
  // kinetic energy and holes at the end
  let ke = 0,
    holes = 0;
  for (let k = 0; k < s.N; k++)
    if (s.type[k] === 1 || s.type[k] === 2)
      ke += 0.5 * s.mass[k] * (s.ux[k] ** 2 + s.uy[k] ** 2);
  const regions = s.bubblePV ? s.bubblePV.length : 0;
  out.push(
    `at ${(s.steps * dt).toFixed(1)} s: kinetic energy ${(ke * (dx / dt) ** 2 * dx * dx * 1000).toFixed(2)} J/m, gas regions ${regions}, peak Mach ${(s.peakSpeed * Math.sqrt(3)).toFixed(2)}, mass drift ${((s.totalMass() - m0 - s.poured) / (m0 + s.poured)).toExponential(1)}`
  );
} catch (e) {
  out.push(e.message);
}
console.log(
  `${scene} ${nx} ${NEW ? "new" : "old"} (${((Date.now() - t0) / 1000).toFixed(0)} s): ` +
    out.join(" | ")
);
