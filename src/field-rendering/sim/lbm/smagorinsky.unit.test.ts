import { CX, CY, Q, collideCell, shiftedEquilibrium } from "./d2q9";

/** A cell well away from equilibrium, in shifted populations. */
function sheared(): number[] {
  const g = shiftedEquilibrium(0.003, 0.04, -0.02);
  // Add a pure shear stress, which leaves mass and momentum alone.
  const pxy = 2e-3;
  for (let i = 0; i < Q; i++) g[i] += 4.5 * (1 / 36) * 2 * CX[i] * CY[i] * pxy;
  return g;
}

describe("the Smagorinsky closure", () => {
  test("with C = 0 it is plain BGK, bit for bit", () => {
    const a = sheared();
    const b = sheared();
    collideCell(a, { omega: 1 / 0.52, fx: 1e-5, fy: 0 }, "float32");
    collideCell(
      b,
      { omega: 1 / 0.52, fx: 1e-5, fy: 0, smagorinsky: 0, tau: 0.52 },
      "float32"
    );
    expect(b).toEqual(a);
  });

  test("relaxes at τ_eff computed independently from the stress", () => {
    const tau = 0.505;
    const C = 0.17;
    const fx = 2e-5;
    const fy = -1e-5;
    const g = sheared();
    // Independently: the macroscopic state, the equilibrium, and Π.
    let dr = 0;
    let jx = 0;
    let jy = 0;
    for (let i = 0; i < Q; i++) {
      dr += g[i];
      jx += CX[i] * g[i];
      jy += CY[i] * g[i];
    }
    const rho = 1 + dr;
    const ux = (jx + fx / 2) / rho;
    const uy = (jy + fy / 2) / rho;
    const eq = shiftedEquilibrium(dr, ux, uy);
    let xx = ux * fx;
    let yy = uy * fy;
    let xy = 0.5 * (ux * fy + uy * fx);
    for (let i = 0; i < Q; i++) {
      const ne = g[i] - eq[i];
      xx += CX[i] * CX[i] * ne;
      yy += CY[i] * CY[i] * ne;
      xy += CX[i] * CY[i] * ne;
    }
    const stress = Math.sqrt(xx * xx + yy * yy + 2 * xy * xy);
    const tauEff =
      0.5 *
      (tau + Math.sqrt(tau * tau + (18 * Math.SQRT2 * C * C * stress) / rho));
    expect(tauEff).toBeGreaterThan(tau);

    const withClosure = [...g];
    collideCell(
      withClosure,
      { omega: 1 / tau, fx, fy, smagorinsky: C, tau },
      "float64"
    );
    const atTauEff = [...g];
    collideCell(atTauEff, { omega: 1 / tauEff, fx, fy }, "float64");
    for (let i = 0; i < Q; i++)
      expect(withClosure[i]).toBeCloseTo(atTauEff[i], 14);
  });

  test("conserves mass, and momentum less the force", () => {
    const g = sheared();
    const before = [...g];
    const fx = 3e-5;
    collideCell(
      g,
      { omega: 1 / 0.51, fx, fy: 0, smagorinsky: 0.17, tau: 0.51 },
      "float64"
    );
    const sum = (p: number[], c?: readonly number[]) =>
      p.reduce((s, v, i) => s + v * (c ? c[i] : 1), 0);
    expect(sum(g)).toBeCloseTo(sum(before), 15);
    expect(sum(g, CX) - sum(before, CX)).toBeCloseTo(fx, 15);
    expect(sum(g, CY) - sum(before, CY)).toBeCloseTo(0, 15);
  });
});
