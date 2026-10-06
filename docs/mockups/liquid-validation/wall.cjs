// A 3 cm × 10 cm slab of water released against the right wall, high in an
// empty tank. Real water falls almost freely: the layer the wall grips is
// √(νt) ≈ 0.5 mm thick after 0.3 s. Thinner slabs show the grip more.
const { Liquid } = require("./liquid.cjs");
const nx = +(process.env.NX || 160),
  ny = Math.round(nx * 0.6),
  dx = 1 / nx;
const dt = Math.sqrt((3e-5 * dx) / 9.81),
  tau = 0.5 + (3e-6 * dt) / dx / dx,
  K = (101325 * 3 * dt * dt) / (1000 * dx * dx);
const w = Math.round(+(process.env.WIDTH || 0.03) / dx),
  top = ny - 4,
  bottom = top - Math.round(0.1 / dx);
const s = new Liquid({
  nx,
  ny,
  tau,
  gravity: 3e-5,
  atmosphere: K,
  wallSlip: +(process.env.SLIP || 0),
  fillRate: 0,
  closePockets: false,
  instantFill: true,
  solid: (x, y) => x === 0 || x === nx - 1 || y === 0,
  fill: (x, y) =>
    x >= (process.env.MID ? nx / 2 : nx - 1 - w) &&
    x < (process.env.MID ? nx / 2 + w : nx - 1) &&
    y >= bottom &&
    y <= top
      ? 1
      : 0,
});
const centre = () => {
  let m = 0,
    my = 0;
  for (let k = 0; k < s.N; k++)
    if (s.type[k] === 1 || s.type[k] === 2) {
      m += s.mass[k];
      my += s.mass[k] * Math.floor(k / nx);
    }
  return my / m;
};
const y0 = centre(),
  rows = [];
for (let n = 1, t = 0; t < 0.3; n++) {
  s.oneStep();
  t = n * dt;
  if (n % Math.round(0.05 / dt) === 0) {
    const fall = (y0 - centre()) * dx,
      free = 0.5 * 9.81 * t * t;
    rows.push(
      `t ${t.toFixed(2)} fell ${(fall * 100).toFixed(1)} cm of ${(free * 100).toFixed(1)} (${((fall / free) * 100).toFixed(0)}%)`
    );
  }
}
console.log(
  `slab ${w} cells wide, slip ${process.env.SLIP || 0}: ` + rows.join(" | ")
);
