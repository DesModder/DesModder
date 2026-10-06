// Free-surface D2Q9 liquid: GPT's round-4 oracle (free-surface.mjs), ported
// for the browser. Same five gather passes and mass ledger; buffers reused
// between steps; float64 arithmetic; a pour source with its own ledger.
const CX = [0, 1, 0, -1, 0, 1, -1, -1, 1];
const CY = [0, 0, 1, 0, -1, 1, 1, -1, -1];
const OPP = [0, 3, 4, 1, 2, 7, 8, 5, 6];
const W = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36];
const GAS = 0,
  INTERFACE = 1,
  FLUID = 2,
  SOLID = 3;
const DIR = [7, 3, 6, 4, 0, 2, 8, 1, 5]; // direction index of (cx, cy), at (cx + 1) * 3 + cy + 1
const dirOf = (cx, cy) => DIR[(cx + 1) * 3 + cy + 1];
const KAPPA = 0.41,
  LOG_B = 5.2;
/** Friction velocity from the law of the wall, U at height y (lattice units). */
function frictionVelocity(U, y, nu) {
  if (U < 1e-12) return 0;
  const viscous = Math.sqrt((nu * U) / y);
  if ((y * viscous) / nu < 11) return viscous; // inside the viscous sublayer
  let u = U / 20;
  for (let n = 0; n < 6; n++) {
    const l = Math.log((y * u) / nu) / KAPPA + LOG_B;
    u -= (u * l - U) / (l + 1 / KAPPA);
    if (!(u > 0)) return viscous;
  }
  return u;
}

function equilibrium(dr, ux, uy, out) {
  const rho = 1 + dr,
    usq = 1.5 * (ux * ux + uy * uy);
  for (let i = 0; i < 9; i++) {
    const cu = CX[i] * ux + CY[i] * uy;
    out[i] = W[i] * (dr + rho * (3 * cu + 4.5 * cu * cu - usq));
  }
  return out;
}

const EQ = new Float64Array(9);
function feqi(i, dr, ux, uy) {
  const cu = CX[i] * ux + CY[i] * uy;
  return (
    W[i] *
    (dr + (1 + dr) * (3 * cu + 4.5 * cu * cu - 1.5 * (ux * ux + uy * uy)))
  );
}
const SPRAY_CAP = 0.25 / Math.sqrt(3);
const REGULARIZED = typeof process === "undefined" || !process.env.BGK;
// BGK with Guo forcing and an optional Smagorinsky closure (collideCell).
function collide(g, tau, smag, fx, fy, out) {
  let omega = 1 / tau;
  const dr = g[0] + g[1] + g[2] + g[3] + g[4] + g[5] + g[6] + g[7] + g[8];
  const rho = 1 + dr;
  const jx = g[1] - g[3] + g[5] - g[6] - g[7] + g[8];
  const jy = g[2] - g[4] + g[5] + g[6] - g[7] - g[8];
  const ux = (jx + 0.5 * fx) / rho,
    uy = (jy + 0.5 * fy) / rho;
  equilibrium(dr, ux, uy, EQ);
  if (smag > 0) {
    let xx = ux * fx,
      yy = uy * fy,
      xy = 0.5 * (ux * fy + uy * fx);
    for (let i = 1; i < 9; i++) {
      const n = g[i] - EQ[i];
      xx += CX[i] * CX[i] * n;
      yy += CY[i] * CY[i] * n;
      xy += CX[i] * CY[i] * n;
    }
    const stress = Math.sqrt(xx * xx + yy * yy + 2 * xy * xy);
    omega =
      1 /
      (0.5 *
        (tau +
          Math.sqrt(
            tau * tau + (18 * Math.SQRT2 * smag * smag * stress) / rho
          )));
  }
  const keep = 1 - omega,
    source = 1 - 0.5 * omega;
  if (REGULARIZED) {
    // Latt & Chopard: keep only the non-equilibrium's momentum and stress,
    // the parts physics acts on, and drop the ghost moments BGK lets ring.
    // The momentum part is −F/2 under Guo's half-force velocity; dropping it
    // applies half the gravity (hydrostatic pressure came out at 0.50).
    let mx = 0,
      my = 0,
      xx = 0,
      yy = 0,
      xy = 0;
    for (let i = 1; i < 9; i++) {
      const n = g[i] - EQ[i];
      mx += CX[i] * n;
      my += CY[i] * n;
      xx += CX[i] * CX[i] * n;
      yy += CY[i] * CY[i] * n;
      xy += CX[i] * CY[i] * n;
    }
    for (let i = 0; i < 9; i++) {
      const cu = CX[i] * ux + CY[i] * uy,
        cf = CX[i] * fx + CY[i] * fy;
      const s =
        W[i] * (3 * ((CX[i] - ux) * fx + (CY[i] - uy) * fy) + 9 * cu * cf);
      const neq =
        W[i] *
        (3 * (CX[i] * mx + CY[i] * my) +
          4.5 *
            ((CX[i] * CX[i] - 1 / 3) * xx +
              (CY[i] * CY[i] - 1 / 3) * yy +
              2 * CX[i] * CY[i] * xy));
      g[i] = EQ[i] + keep * neq + source * s;
    }
  } else
    for (let i = 0; i < 9; i++) {
      const cu = CX[i] * ux + CY[i] * uy,
        cf = CX[i] * fx + CY[i] * fy;
      const s =
        W[i] * (3 * ((CX[i] - ux) * fx + (CY[i] - uy) * fy) + 9 * cu * cf);
      g[i] = keep * g[i] + omega * EQ[i] + source * s;
    }
  out[0] = dr;
  out[1] = ux;
  out[2] = uy;
}

class Liquid {
  constructor({
    nx,
    ny,
    tau = 0.53,
    smagorinsky = 0.1,
    gravity = 1e-4,
    fillRate = 0.05,
    bubbles = true,
    atmosphere = 0.148,
    closePockets = true,
    instantFill = false,
    wallSlip = 0,
    gasModel = "regions",
    gasPasses = 4,
    minBubble = 4,
    maxGauge = Infinity,
    solid = () => false,
    fill = () => 0,
  }) {
    Object.assign(this, {
      nx,
      ny,
      tau,
      smagorinsky,
      gravity,
      fillRate,
      bubbles,
      atmosphere,
      closePockets,
      instantFill,
      wallSlip,
      gasModel,
      gasPasses,
      minBubble,
      maxGauge,
    });
    const N = (this.N = nx * ny);
    const f64 = () => new Float64Array(N);
    this.type = new Uint8Array(N);
    this.mass = f64();
    this.reservoir = f64();
    this.rho = f64().fill(1);
    this.ux = f64();
    this.uy = f64();
    this.phi = f64();
    this.p = new Float64Array(9 * N);
    this.q = new Float64Array(9 * N);
    this.nb = new Int32Array(9 * N).fill(-1);
    // Per-step scratch, reused.
    this.nMass = f64();
    this.nRho = f64();
    this.nUx = f64();
    this.nUy = f64();
    this.tent = new Uint8Array(N);
    this.fixed = new Uint8Array(N);
    this.fin = new Uint8Array(N);
    this.excess = f64();
    this.base = f64();
    this.reserve = f64();
    this.recipients = new Uint8Array(N);
    this.enclosed = new Uint8Array(N);
    this.gasRho = f64().fill(1);
    this.label = new Int32Array(N);
    this.lastLabel = new Int32Array(N).fill(-1);
    this.stack = new Int32Array(N);
    this.bubblePV = [];
    this.stressOut = [0, 0];
    this.smallGas = new Uint8Array(N);
    this.gasMass = f64();
    this.gasVol = f64();
    this.gasFlow = f64();
    this.steps = 0;
    this.poured = 0;
    this.peakSpeed = 0;
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++) {
        const k = y * nx + x,
          f = Math.max(0, Math.min(1, fill(x, y)));
        this.type[k] = solid(x, y)
          ? SOLID
          : f === 0
            ? GAS
            : f === 1
              ? FLUID
              : INTERFACE;
        this.phi[k] = this.type[k] === SOLID ? 0 : f;
        for (let i = 0; i < 9; i++) {
          const xx = x + CX[i],
            yy = y + CY[i];
          if (xx >= 0 && xx < nx && yy >= 0 && yy < ny)
            this.nb[i * N + k] = yy * nx + xx;
        }
      }
    const t = this.type.slice();
    for (let k = 0; k < N; k++)
      if (t[k] === FLUID)
        for (let i = 1; i < 9; i++) {
          const j = this.nb[i * N + k];
          if (j >= 0 && t[j] === GAS) this.type[k] = INTERFACE;
        }
    // Hydrostatic start: each column's liquid above sets the pressure.
    const eq = new Float64Array(9);
    for (let x = 0; x < nx; x++) {
      let depth = 0;
      for (let y = ny - 1; y >= 0; y--) {
        const k = y * nx + x;
        if (this.type[k] === SOLID) {
          depth = 0;
          continue;
        }
        depth += this.phi[k];
        const dr = this.phi[k] > 0 ? 3 * gravity * Math.max(0, depth - 0.5) : 0;
        this.rho[k] = 1 + dr;
        this.mass[k] = this.phi[k] * this.rho[k];
        equilibrium(dr, 0, 0, eq);
        for (let i = 0; i < 9; i++) this.p[i * N + k] = eq[i];
      }
    }
  }

  totalMass() {
    let m = 0;
    for (let k = 0; k < this.N; k++) m += this.mass[k] + this.reservoir[k];
    return m;
  }

  /** Mass `amount` into the gas or interface cells of a disc, moving down at `speed`. */
  pour(cx, cy, radius, amount, speed) {
    const { nx, ny, N } = this,
      cells = [];
    for (
      let y = Math.max(0, Math.floor(cy - radius));
      y <= Math.min(ny - 1, Math.ceil(cy + radius));
      y++
    )
      for (
        let x = Math.max(0, Math.floor(cx - radius));
        x <= Math.min(nx - 1, Math.ceil(cx + radius));
        x++
      ) {
        const k = y * nx + x;
        if ((x - cx) ** 2 + (y - cy) ** 2 > radius * radius) continue;
        if (this.type[k] === GAS || this.type[k] === INTERFACE) cells.push(k);
      }
    if (cells.length === 0) return;
    const eq = new Float64Array(9),
      share = amount / cells.length;
    for (const k of cells) {
      if (this.type[k] === GAS) {
        this.type[k] = INTERFACE;
        this.mass[k] = 0;
        this.rho[k] = 1;
      }
      this.ux[k] = 0;
      this.uy[k] = -speed;
      equilibrium(this.rho[k] - 1, 0, -speed, eq);
      for (let i = 0; i < 9; i++) this.p[i * N + k] = eq[i];
      // Only where there is room: see GpuLiquid's brush.
      const added = Math.min(share, Math.max(0, this.rho[k] - this.mass[k]));
      this.mass[k] += added;
      this.poured += added;
      this.phi[k] = Math.max(0, Math.min(1, this.mass[k] / this.rho[k]));
    }
  }

  /** A cell turned to wall where it was empty, or back to empty. */
  paint(x, y, wall) {
    if (x < 0 || y < 0 || x >= this.nx || y >= this.ny) return;
    const k = y * this.nx + x;
    if (wall && this.type[k] === GAS) this.type[k] = SOLID;
    else if (!wall && this.type[k] === SOLID) {
      this.type[k] = GAS;
      this.phi[k] = 0;
      this.mass[k] = 0;
    }
  }

  step(count = 1) {
    for (let n = 0; n < count; n++) this.oneStep();
  }

  /** The gas pressure, as a density, that the free surface pushes against.
   *  Without it every gas pocket is a vacuum: a bubble in still water
   *  imploded in 0.14 s and left the water churning at 0.3 m/s. As in the
   *  free-surface bubble models of Thürey, Körner and Anderl, each enclosed
   *  gas region is an ideal gas whose pressure times volume is kept, so a
   *  squeezed bubble pushes back and a bubble rises instead of imploding.
   *  Regions are found afresh each step and matched to the last step's by
   *  the cells they share: merging bubbles add their p·V, a splitting one
   *  shares it by volume. Gas reaching the open top is the atmosphere.
   *  Pressure is in atmospheres; `atmosphere` is one atmosphere as a lattice
   *  density (P_atm / ρ c_s², 0.148 for 6 mm cells and g_lat 3e-5). */
  updateGas() {
    const { N, nx, ny, type: t, phi, nb } = this;
    const label = this.label,
      last = this.lastLabel,
      K = this.atmosphere;
    label.fill(-1);
    const regions = []; // { cells, volume, top }
    const stack = this.stack;
    for (let k0 = 0; k0 < N; k0++) {
      if (t[k0] !== GAS || label[k0] >= 0) continue;
      const r = regions.length,
        region = { cells: [], volume: 0, top: false };
      regions.push(region);
      let sp = 0;
      stack[sp++] = k0;
      label[k0] = r;
      while (sp) {
        const k = stack[--sp];
        region.cells.push(k);
        region.volume += 1;
        if (k >= (ny - 1) * nx) region.top = true;
        for (let i = 1; i < 9; i++) {
          const j = nb[i * N + k];
          if (j >= 0 && t[j] === GAS && label[j] < 0) {
            label[j] = r;
            stack[sp++] = j;
          }
        }
      }
    }
    // The gas part of surface cells belongs to the region beside them.
    for (let k = 0; k < N; k++) {
      if (t[k] !== INTERFACE) continue;
      for (let i = 1; i < 9; i++) {
        const j = nb[i * N + k];
        if (j >= 0 && t[j] === GAS) {
          regions[label[j]].volume += 1 - phi[k];
          break;
        }
      }
    }
    // Match to the last step's bubbles by shared cells; carry p·V. A bubble
    // that splits shares its p·V by the parts' volumes, so both keep its
    // pressure: shared by gas cells, a small part (more surface, fewer gas
    // cells) was born at 0.57 atmospheres and sucked water in at 10 m/s.
    const oldPV = this.bubblePV,
      oldVolume = new Map(),
      newPV = [];
    for (const region of regions) {
      if (region.top) continue;
      const share = new Map();
      for (const k of region.cells) {
        const o = last[k];
        if (o >= -2) share.set(o, (share.get(o) || 0) + 1);
      }
      region.share = share;
      for (const [o, n] of share)
        if (o >= 0)
          oldVolume.set(
            o,
            (oldVolume.get(o) || 0) + (region.volume * n) / region.cells.length
          );
    }
    for (const region of regions) {
      if (region.top) {
        newPV.push(region.volume);
        continue;
      } // the atmosphere: p = 1
      let pv = 0,
        matched = 0;
      for (const [o, n] of region.share) {
        const part = (region.volume * n) / region.cells.length;
        if (o === -2) {
          pv += part;
          matched += n;
        } // pinched off the open air at p = 1
        else if (o >= 0 && oldPV[o] !== undefined) {
          pv += (oldPV[o] * part) / oldVolume.get(o);
          matched += n;
        }
      }
      // Gas with no history (liquid emptied out) starts at the pressure of
      // the liquid around it, so it is born without a kick. Cells that just
      // emptied beside old gas join it: the same p·V, spread thinner.
      if (matched === 0)
        pv = region.volume * this.surroundingPressure(region.cells);
      newPV.push(pv);
    }
    this.bubblePV = newPV;
    this.lastVolume = regions.map((g) => g.volume);
    // Each gas cell's density: 1 + K (p − 1), p = p·V / V.
    const G = this.gasRho,
      small = this.smallGas;
    G.fill(1);
    small.fill(0);
    for (const [r, region] of regions.entries()) {
      if (region.top) {
        for (const k of region.cells) last[k] = -2;
        continue;
      }
      // A pocket of a few gas cells is too small to resolve, often a few gas
      // cells in a froth of part-filled ones whose volume swings 5% a step;
      // its p·V law then gave 0.6 to 1.9 atmospheres and threw water at
      // Mach 0.76. It takes the liquid's pressure, pushes on nothing, and may
      // close.
      if (region.cells.length < this.minBubble) {
        const rhoGas = 1 + K * (this.surroundingPressure(region.cells) - 1);
        for (const k of region.cells) {
          G[k] = rhoGas;
          small[k] = 1;
          last[k] = -1;
        }
        newPV[r] = undefined;
        continue;
      }
      const pressure = Math.max(
        1 - this.maxGauge,
        Math.min(1 + this.maxGauge, newPV[r] / region.volume)
      );
      if (this.debugGas && (pressure < 0.6 || pressure > 1.4))
        this.debugGas(
          `step ${this.steps}: region of ${region.cells.length} cells, volume ${region.volume.toFixed(2)}, p ${pressure.toFixed(2)}, from ${[...region.share].map(([o, n]) => `${o}:${n}` + (o >= 0 ? `(pv ${oldPV[o]?.toFixed(2)}, vol ${this.lastVolume?.[o]?.toFixed(2)})` : "")).join(" ")}`
        );
      const rhoGas = 1 + K * (pressure - 1);
      for (const k of region.cells) {
        G[k] = rhoGas;
        last[k] = r;
      }
    }
    for (let k = 0; k < N; k++) if (t[k] !== GAS) last[k] = -1;
  }

  /** The population a wall sends into cell k along direction i. Bounce-back
   *  stops the first cell dead: with water's viscosity nothing inside the
   *  liquid replaces the momentum, so a 6 mm layer sticks where real water
   *  grips the wall over half a millimetre (a 1.5 cm film fell at 38% of free
   *  fall). On a straight wall the population is mirrored instead (free
   *  slip), and `wallStress` puts back the friction the law of the wall
   *  gives; corners and diagonal walls still bounce back. */
  wallPopulation(k, i) {
    const { N, nb, type: t, p } = this,
      back = p[OPP[i] * N + k];
    const cx = CX[i],
      cy = CY[i];
    if (cx === 0 || cy === 0) return back; // head-on: mirror and bounce agree
    const sx = nb[dirOf(-cx, 0) * N + k],
      sy = nb[dirOf(0, -cy) * N + k];
    const solidX = sx < 0 || t[sx] === SOLID,
      solidY = sy < 0 || t[sy] === SOLID;
    let mirrored = back;
    if (solidX && !solidY && (t[sy] === FLUID || t[sy] === INTERFACE))
      mirrored = p[dirOf(-cx, cy) * N + sy]; // upright wall
    else if (solidY && !solidX && (t[sx] === FLUID || t[sx] === INTERFACE))
      mirrored = p[dirOf(cx, -cy) * N + sx]; // floor or lid
    return this.wallSlip * mirrored + (1 - this.wallSlip) * back;
  }

  /** Wall friction from the log law at the first cell's centre, half a cell out. */
  wallStress(k, ux, uy) {
    const { N, nb, type: t } = this,
      out = this.stressOut;
    out[0] = 0;
    out[1] = 0;
    const nu = (this.tau - 0.5) / 3,
      wall = (d) => {
        const j = nb[d * N + k];
        return j < 0 || t[j] === SOLID;
      };
    if (wall(1) || wall(3)) {
      const u = frictionVelocity(Math.abs(uy), 0.5, nu);
      out[1] -= Math.sign(uy) * u * u * this.wallSlip;
    }
    if (wall(2) || wall(4)) {
      const u = frictionVelocity(Math.abs(ux), 0.5, nu);
      out[0] -= Math.sign(ux) * u * u * this.wallSlip;
    }
    return out;
  }

  /** The same ideal gas, kept locally: each cell holds a gas mass, its
   *  pressure (in atmospheres) is that mass over its gas volume, and gas
   *  flows between neighbouring gas cells until the pressures even out.
   *  A bubble's gas then has a fixed total, which is the ideal-gas p·V law,
   *  and merging, splitting and the open top need no bookkeeping. Gas that a
   *  filling cell can no longer hold is pushed to its gas neighbours. */
  updateGasLocal() {
    const { N, nx, ny, type: t, phi, nb } = this;
    const M = this.gasMass,
      V = this.gasVol,
      flow = this.gasFlow,
      K = this.atmosphere;
    for (let k = 0; k < N; k++)
      V[k] =
        t[k] === GAS ? 1 : t[k] === INTERFACE ? Math.max(0, 1 - phi[k]) : 0;
    if (!this.gasStarted) {
      for (let k = 0; k < N; k++) M[k] = V[k];
      this.gasStarted = true;
    }
    // Gas in cells that filled goes to their gas neighbours.
    flow.fill(0);
    for (let k = 0; k < N; k++) {
      if (V[k] > 0 || M[k] === 0) continue;
      let n = 0;
      for (let i = 1; i < 9; i++) {
        const j = nb[i * N + k];
        if (j >= 0 && V[j] > 0) n++;
      }
      if (!n) continue;
      for (let i = 1; i < 9; i++) {
        const j = nb[i * N + k];
        if (j >= 0 && V[j] > 0) flow[j] += M[k] / n;
      }
      M[k] = 0;
    }
    for (let k = 0; k < N; k++) M[k] += flow[k];
    const D = 1 / 9,
      top = (ny - 1) * nx;
    for (let pass = 0; pass < this.gasPasses; pass++) {
      for (let k = 0; k < N; k++) {
        flow[k] = 0;
        if (V[k] <= 0) continue;
        const pk = M[k] / V[k];
        let d = 0;
        for (let i = 1; i < 9; i++) {
          const j = nb[i * N + k];
          if (j >= 0 && V[j] > 0)
            d += Math.min(V[k], V[j]) * (M[j] / V[j] - pk);
        }
        if (k >= top) d += V[k] * (1 - pk); // the air above the open tank
        flow[k] = D * d;
      }
      for (let k = 0; k < N; k++) M[k] += flow[k];
    }
    const G = this.gasRho;
    for (let k = 0; k < N; k++) G[k] = V[k] > 0 ? 1 + K * (M[k] / V[k] - 1) : 1;
  }

  // Pressure in atmospheres of the liquid touching these gas cells.
  surroundingPressure(cells) {
    const { N, type: t, rho, nb } = this;
    let sum = 0,
      n = 0;
    for (const k of cells)
      for (let i = 1; i < 9; i++) {
        const j = nb[i * N + k];
        if (j >= 0 && (t[j] === INTERFACE || t[j] === FLUID)) {
          sum += rho[j];
          n++;
        }
      }
    return n ? 1 + (sum / n - 1) / this.atmosphere : 1;
  }

  oneStep() {
    const {
      N,
      nx,
      type: t,
      mass: m,
      rho,
      phi,
      p,
      q,
      nb,
      tent,
      fixed,
      fin,
    } = this;
    const nMass = this.nMass,
      nRho = this.nRho,
      nUx = this.nUx,
      nUy = this.nUy;
    nRho.fill(1);
    nUx.fill(0);
    nUy.fill(0);
    tent.set(t);
    if (this.bubbles) {
      if (this.gasModel === "local") this.updateGasLocal();
      else this.updateGas();
    }
    const slip = this.wallSlip > 0;
    const gasRho = this.gasRho;
    const g = new Float64Array(9),
      macro = [0, 0, 0];
    let peak = this.peakSpeed;
    // Pass 1: mass exchange, gas-side reconstruction, collision.
    for (let k = 0; k < N; k++) {
      nMass[k] = m[k];
      this.enclosed[k] = 0;
      if (t[k] === SOLID || t[k] === GAS) continue;
      let dm = 0,
        wet = 0,
        dry = 0,
        bulk = 0;
      const uxk = this.ux[k],
        uyk = this.uy[k];
      for (let i = 0; i < 9; i++) {
        const j = nb[OPP[i] * N + k];
        if (j < 0 || t[j] === SOLID)
          g[i] = slip ? this.wallPopulation(k, i) : p[OPP[i] * N + k];
        else if (t[j] === GAS) {
          const dg = gasRho[j] - 1;
          g[i] =
            feqi(i, dg, uxk, uyk) +
            feqi(OPP[i], dg, uxk, uyk) -
            p[OPP[i] * N + k];
          dry++;
        } else {
          g[i] = p[i * N + j];
          if (i) {
            wet++;
            if (t[j] === FLUID) bulk++;
            const factor =
              t[k] === FLUID || t[j] === FLUID ? 1 : 0.5 * (phi[k] + phi[j]);
            dm += factor * (p[i * N + j] - p[OPP[i] * N + k]);
          }
        }
      }
      nMass[k] += dm;
      let fx = 0,
        fy = -this.gravity * rho[k];
      if (slip) {
        const w = this.wallStress(k, uxk, uyk);
        fx += w[0];
        fy += w[1];
      }
      collide(g, this.tau, this.smagorinsky, fx, fy, macro);
      // Spray, a surface cell with no bulk liquid beside it, is a drop one or
      // two cells wide: too small for the lattice to resolve, and bounced off
      // the lid without a splash it reached Mach 0.34. Past Mach 0.25 it is
      // slowed to that speed. A numerical guard, not physics.
      if (t[k] === INTERFACE && bulk === 0) {
        const sp = Math.hypot(macro[1], macro[2]);
        if (sp > SPRAY_CAP) {
          const f = SPRAY_CAP / sp;
          macro[1] *= f;
          macro[2] *= f;
          equilibrium(macro[0], macro[1], macro[2], g);
        }
      }
      nRho[k] = 1 + macro[0];
      nUx[k] = macro[1];
      nUy[k] = macro[2];
      if (!Number.isFinite(nRho[k]) || nRho[k] <= 0)
        throw new Error(`The liquid went unstable at step ${this.steps}.`);
      for (let i = 0; i < 9; i++) q[i * N + k] = g[i];
      // A surface cell with no liquid beside it can pass its mass nowhere, so
      // gravity would speed it up for ever: empty it, and the reservoir keeps
      // its mass until liquid comes back. One with no gas beside it is inside
      // the liquid, where inflow equals outflow and pressure never fills it:
      // pass 4 fills it a little each step. Filling it at once (Thürey's
      // rule) takes up to a whole cell from nearly empty spray beside it and
      // blew up a dam break at Mach 0.28.
      if (t[k] === INTERFACE) {
        tent[k] =
          wet === 0
            ? GAS
            : nMass[k] >= nRho[k] || (this.instantFill && dry === 0)
              ? FLUID
              : nMass[k] <= 0
                ? GAS
                : INTERFACE;
        this.enclosed[k] = wet > 0 && dry === 0 ? 1 : 0;
      }
      if (tent[k] !== GAS) {
        const sp = Math.hypot(macro[1], macro[2]);
        if (sp > peak) peak = sp;
      }
    }
    this.peakSpeed = peak;
    // Pass 2: an advancing interface wins over a retreat beside it, and a
    // one-cell gas pocket closes (2D gas here has no pressure to hold it open).
    fixed.set(tent);
    for (let k = 0; k < N; k++) {
      if (t[k] === SOLID || tent[k] !== GAS) continue;
      let wet = 0,
        dry = 0;
      for (let i = 1; i < 9; i++) {
        const j = nb[i * N + k];
        if (j < 0) continue;
        if (t[j] === INTERFACE && tent[j] === FLUID) {
          fixed[k] = INTERFACE;
          break;
        }
        if (t[j] === GAS) dry++;
        else if (t[j] !== SOLID) wet++;
      }
      if (
        (this.closePockets || this.smallGas[k]) &&
        t[k] === GAS &&
        wet > 0 &&
        dry === 0
      )
        fixed[k] = INTERFACE;
    }
    // Pass 3: liquid beside gas stays interface; newly wet cells start at their neighbours' mean.
    fin.set(fixed);
    for (let k = 0; k < N; k++)
      if (fixed[k] === FLUID)
        for (let i = 1; i < 9; i++) {
          const j = nb[i * N + k];
          if (j >= 0 && fixed[j] === GAS) {
            fin[k] = INTERFACE;
            break;
          }
        }
    const eq = new Float64Array(9);
    for (let k = 0; k < N; k++)
      if (t[k] === GAS && fin[k] === INTERFACE) {
        let r = 0,
          u = 0,
          v = 0,
          c = 0;
        for (let i = 1; i < 9; i++) {
          const j = nb[i * N + k];
          if (j >= 0 && (t[j] === FLUID || t[j] === INTERFACE)) {
            r += nRho[j];
            u += nUx[j];
            v += nUy[j];
            c++;
          }
        }
        nRho[k] = c ? r / c : 1;
        nUx[k] = c ? u / c : 0;
        nUy[k] = c ? v / c : 0;
        equilibrium(nRho[k] - 1, nUx[k], nUy[k], eq);
        for (let i = 0; i < 9; i++) q[i * N + k] = eq[i];
      }
    // Pass 4: each cell's own mass, and the excess it gives away.
    const { excess, base, reserve, recipients } = this;
    for (let k = 0; k < N; k++) {
      excess[k] = 0;
      base[k] = 0;
      reserve[k] = 0;
      recipients[k] = 0;
      if (fin[k] === SOLID) {
        reserve[k] = this.reservoir[k];
        continue;
      }
      base[k] =
        fin[k] === FLUID
          ? nRho[k]
          : fin[k] === GAS
            ? 0
            : Math.max(0, Math.min(nRho[k], nMass[k]));
      // An enclosed surface cell keeps up to fillRate of a cell more than it has;
      // the debt goes out as negative excess, so the ledger still balances.
      if (this.fillRate > 0 && fin[k] === INTERFACE && this.enclosed[k])
        base[k] = Math.min(nRho[k], base[k] + this.fillRate * nRho[k]);
      excess[k] = nMass[k] - base[k] + this.reservoir[k];
      for (let i = 1; i < 9; i++) {
        const j = nb[i * N + k];
        if (j >= 0 && (fin[j] === FLUID || fin[j] === INTERFACE))
          recipients[k]++;
      }
      if (!recipients[k]) {
        reserve[k] = excess[k];
        excess[k] = 0;
      }
    }
    // Pass 5: every liquid cell gathers its neighbours' shares.
    for (let k = 0; k < N; k++) {
      if (fin[k] === FLUID || fin[k] === INTERFACE)
        for (let i = 1; i < 9; i++) {
          const j = nb[i * N + k];
          if (j >= 0 && recipients[j]) base[k] += excess[j] / recipients[j];
        }
      phi[k] =
        fin[k] === FLUID
          ? 1
          : fin[k] === INTERFACE
            ? Math.max(0, Math.min(1, base[k] / nRho[k]))
            : 0;
    }
    // Swap state.
    [this.mass, this.base] = [base, m];
    [this.reservoir, this.reserve] = [reserve, this.reservoir];
    this.type.set(fin);
    [this.rho, this.nRho] = [nRho, rho];
    [this.ux, this.nUx] = [nUx, this.ux];
    [this.uy, this.nUy] = [nUy, this.uy];
    [this.p, this.q] = [q, p];
    this.steps++;
    void nx;
  }
}
if (typeof module !== "undefined")
  module.exports = { Liquid, GAS, INTERFACE, FLUID, SOLID };
