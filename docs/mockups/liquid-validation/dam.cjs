const { Liquid } = require("./liquid.cjs");
const a = +process.argv[2],
  g = +(process.env.GA || 9e-4) / a,
  nx = Math.ceil(4.4 * a) + 2,
  ny = 2 * a + 8;
const mm = [
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
const s = new Liquid({
  nx,
  ny,
  gravity: g,
  tau: +(process.env.TAU || 0.53),
  smagorinsky: +(process.env.SMAG || 0.1),
  solid: (x, y) => x === 0 || x === nx - 1 || y === 0,
  fill: (x, y) => (x >= 1 && x <= a && y >= 1 && y <= 2 * a ? 1 : 0),
});
const start = s.totalMass();
let i = 0,
  err = 0,
  xs = [];
const rows = Math.max(1, Math.round(a / 10));
for (let n = 1; i < mm.length; n++) {
  s.step(1);
  const T = n * Math.sqrt((2 * g) / a);
  if (T >= mm[i][0]) {
    let f = 0;
    for (let x = 1; x < nx - 1; x++)
      for (let y = 1; y <= rows; y++)
        if (s.phi[y * nx + x] >= 0.5) f = Math.max(f, x);
    err += Math.abs(f / a - mm[i][1]) / mm[i][1];
    xs.push((f / a).toFixed(2));
    i++;
  }
}
const slope = (xs[14] - xs[6]) / (3.33 - 1.98);
console.log(
  `speed ${slope.toFixed(2)} √(gH) a ${a} mean err ${((100 * err) / mm.length).toFixed(1)}% Mach ${(s.peakSpeed * Math.sqrt(3)).toFixed(2)} drift ${((s.totalMass() - start) / start).toExponential(1)} last X ${xs.slice(-3).join(" ")}`
);
