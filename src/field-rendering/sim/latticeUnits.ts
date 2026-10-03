/**
 * Graph units to lattice units, for a D2Q9 lattice over a fixed tank.
 *
 * The user sets what a physicist would: the inflow speed in graph units per
 * second, a reference length, and a Reynolds number. The lattice runs in its
 * own units, with a cell one unit across, a step one unit long, and a speed of
 * sound of 1/√3. Joining the two takes one free choice, the lattice speed
 * `U_lat`, which is the inflow speed in cells per step. Everything else follows:
 *
 *   dx  = tank width / cells across            graph units per cell
 *   dt  = U_lat · dx / U                       simulated seconds per step
 *   N   = L / dx                               cells across the reference length
 *   ν   = U_lat · N / Re                       lattice viscosity
 *   τ   = 3ν + ½                               BGK relaxation time
 *   Ma  = U_lat · √3                           the inflow's Mach number
 *
 * GPT's third round measured where this is safe on the CPU oracle: U_lat = 0.05
 * held from Re 10 to 2000 with a Smagorinsky closure (C = 0.17) above Re 200,
 * and U_lat = 0.1 survived but exceeded local Mach 0.3 in the wake from about
 * Re 200 up (brief §8.1). Those two speeds, and the closure's switch, live
 * here.
 */

/** The lattice speed the Accurate setting uses, measured safe at every Re. */
export const ACCURATE_LATTICE_SPEED = 0.05;
/** The faster speed Lively keeps, and Auto starts at. */
export const LIVELY_LATTICE_SPEED = 0.1;
/** Above this, the closure switches on. */
export const CLOSURE_REYNOLDS = 200;
/** The Smagorinsky constant measured stable to Re 2000. */
export const SMAGORINSKY_C = 0.17;
/** Local Mach above which a state is outside the measured envelope. */
export const MACH_LIMIT = 0.3;
/**
 * Fewer cells than this across the reference length and a measurement means
 * little; GPT's first round set 32 for quantitative work.
 */
export const MEASUREMENT_CELLS = 32;

export interface LatticeUnitsInput {
  /** The tank's width in graph units. */
  tankWidth: number;
  cellsAcross: number;
  /** Graph units per second. */
  inflowSpeed: number;
  /** Graph units. */
  referenceLength: number;
  reynolds: number;
  latticeSpeed: number;
}

export interface LatticeUnits {
  /** Graph units per cell. */
  dx: number;
  /** Simulated seconds per step. */
  dt: number;
  /** Steps per simulated second, which at speed 1 is steps per real second. */
  stepsPerSecond: number;
  /** Cells across the reference length. */
  cellsPerLength: number;
  /** Lattice viscosity. */
  nu: number;
  /** BGK relaxation time. */
  tau: number;
  /** Physical kinematic viscosity, graph units² per second. */
  physicalViscosity: number;
  /** Mach number of the inflow itself; the wake can be faster. */
  inflowMach: number;
  /** Whether the Smagorinsky closure is on at this Reynolds number. */
  closure: boolean;
}

export function latticeUnits(input: LatticeUnitsInput): LatticeUnits {
  const dx = input.tankWidth / input.cellsAcross;
  const dt = (input.latticeSpeed * dx) / input.inflowSpeed;
  const cellsPerLength = input.referenceLength / dx;
  const nu = (input.latticeSpeed * cellsPerLength) / input.reynolds;
  return {
    dx,
    dt,
    stepsPerSecond: 1 / dt,
    cellsPerLength,
    nu,
    tau: 3 * nu + 0.5,
    physicalViscosity:
      (input.inflowSpeed * input.referenceLength) / input.reynolds,
    inflowMach: input.latticeSpeed * Math.sqrt(3),
    closure: input.reynolds > CLOSURE_REYNOLDS,
  };
}

export type SpeedMode = "auto" | "accurate" | "lively";

/**
 * The lattice speed a setting starts at. Auto starts fast and is slowed by
 * the solver when the measured local Mach number crosses `MACH_LIMIT`, which
 * this cannot know in advance.
 */
export function initialLatticeSpeed(mode: SpeedMode): number {
  return mode === "accurate" ? ACCURATE_LATTICE_SPEED : LIVELY_LATTICE_SPEED;
}
