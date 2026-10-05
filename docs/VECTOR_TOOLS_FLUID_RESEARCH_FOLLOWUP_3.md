# Vector Tools fluid — research round 4: the liquid, and half-precision storage

This continues the thread that produced `Vector_Tools_Fluid_Research.md`,
`lbm2d.mjs` (round 2) and the PSM/collision/float32 study (round 3). Everything
from rounds 1–3 that was adopted is now built, live and tested; the state is
summarised in `FLUID_TAB.md` (attached), and the solver sources are attached
too.

What changed since round 3, briefly:

- The D2Q9 solver (BGK + Guo, shifted float32 populations, BFL walls,
  regularised Zou–He sides, sponge, Smagorinsky above Re 200) runs on WebGL2 in
  one fragment pass per step, three RGBA32F textures plus an RGBA32F force
  target, ping-pong. GPU matches the CPU reference to 4·10⁻⁹ per step;
  DFG 2D-1 C_D within 1.45%, 2D-2 St within 0.17%.
- Moving solids are PSM (your M2/B2) while they move and are **parked** as BFL
  solids when their slider is still. Their level set is sampled on the GPU.
- Auto now halves the lattice speed **in place** (equilibrium at s·u and s²·δρ,
  non-equilibrium × s(τ′−1)/(τ−1) for post-collision populations): a
  Taylor–Green vortex rescaled mid-decay continues within 0.08% of the
  unscaled run.
- The velocity inlet now absorbs sound (part C below asks you to check it).

Measured on the maintainer's machine (Intel Iris Xe, Chrome, ANGLE/D3D11):
300 × 167 cells costs 0.10 ms per step (≈500 MLUPS); 600 × 334 costs 1.22 ms
per step (≈160 MLUPS) — 12× the time for 4× the cells, so the solver is
memory-bandwidth bound once the lattice outgrows the cache.

Please answer A, B and C. As in round 2, **a runnable CPU oracle with tests
and pinned numbers is worth more than prose**: where you recommend a method,
implement it in `reference/` as `.mjs` with `node --test` tests, report the
numbers you measured, and say plainly what you did not run.

---

## A. Half-precision population storage (efficiency)

The step reads 9 populations from three RGBA32F textures and writes 12 floats
plus a 4-float force target: about 200 bytes per cell per step. Halving the
population bytes should nearly halve the step time on integrated GPUs.

1. Lehmann et al. (FluidX3D; "Accuracy and performance of the lattice
   Boltzmann method with 64-bit, 32-bit, and customized 16-bit number
   formats", Phys. Rev. E 106, 015308, 2022) report FP32 arithmetic with
   16-bit storage (FP16S: IEEE half of scaled DDF shifts; FP16C: a custom
   16-bit float) at near-FP32 accuracy for many cases. **Which of these maps
   onto WebGL2**, where the options are `RGBA16F` render targets (IEEE half,
   filterable, renderable with `EXT_color_buffer_float`) and `RGBA16UI`
   integer targets decoded with bit operations in GLSL ES 3.00?
2. Our populations are already shifted (f − w_i). Give the exact scaling for
   FP16S given our δρ and velocity ranges (Ma ≤ 0.3, Re up to ~1000, τ from
   0.5005 to ~1.5), and the FP16C encode/decode in GLSL ES 3.00 if FP16S is
   not enough.
3. **Accuracy, measured on your oracle:** Taylor–Green decay rate at
   U₀ = 10⁻² and 10⁻⁴, Poiseuille, DFG 2D-1 C_D and Δp, DFG 2D-2 St and
   C_D,max, each with FP32, FP16S and FP16C storage (FP32 arithmetic).
   Which fail, and where (low Mach, high Re, near walls)?
4. The macroscopic δρ/ux/uy channel and the force target: can they drop to
   half precision too, given that BFL reads δρ at moving walls, the absorbing
   inlet reads δρ, and drag/lift are summed from the force target?
5. Any other bandwidth saving that is valid in WebGL2 fragment shaders
   (round 1 already ruled out in-place AA/esoteric streaming: no reading and
   writing the same attached texture). For example, packing the solid mask and
   link fractions, or skipping the force target on steps nobody reads.

## B. The liquid

Rafael's product choice (brief §8.0): after the wind tunnel and stirred box,
"the liquid right after": a free-surface liquid that pours from a draggable
point onto whatever the graph makes solid. The house rule is a research-grade
engine explained in AP-level words, so a liquid that can be **measured**
(hydrostatic pressure, Torricelli efflux, a dam break against published data)
is the goal, with a visual-only mode acceptable only if clearly labelled.

Round 1 concluded: visual PBF possible now; quantitative liquid later via a
MAC/APIC grid solver or a validated incompressible particle method; do not
reuse single-phase LBM pressure without an interface algorithm. We now have a
validated, fast D2Q9 GPU solver with strict-geometry solids, BFL walls, PSM
moving solids, Guo forcing and an in-place speed change. That makes a
**free-surface LBM** (mass-tracking VOF-LBM: Körner et al. 2005; Thürey 2007;
Bogner, Rüde et al.; FluidX3D's GPU implementation) the obvious candidate,
since it would reuse all of that. Please decide between it and the
alternatives, and if it wins, specify it fully.

1. **Method choice**, against: (a) free-surface D2Q9 with mass tracking
   (fluid / interface / gas cells, fill level φ); (b) FLIP/APIC on a MAC grid
   with a pressure projection; (c) PBF or DFSPH. Criteria: accuracy on the
   benchmarks below; implementability in **WebGL2 fragment shaders without
   compute or scatter** (round 1 noted that RGBA32F blending is not
   guaranteed, which matters for particle-to-grid); reuse of our solver and
   solids; behaviour with moving PSM solids and parked BFL ones; cost at
   300 × 170 cells on an integrated GPU.
2. If free-surface LBM: give the algorithm as ordered GPU passes, each a
   pure gather (no scatter, no atomics), with:
   - the interface boundary condition (reconstruct missing populations from
     the gas pressure and the interface velocity, and which directions to
     reconstruct: those from gas cells, or those against the normal too);
   - mass exchange between cells, in a form two neighbouring cells compute
     identically (so it conserves mass without atomics);
   - cell-type conversions (interface→fluid when φ ≥ 1, →gas when φ ≤ 0),
     the neighbour fixes they require (new interface cells' populations;
     excess mass redistribution), all as gather passes, and how many passes;
   - the normal and curvature from φ for surface tension (and whether to
     include it at all at this resolution);
   - gravity in lattice units: the bounds that keep the flow below Ma 0.3 and
     the interface stable, and how to choose g_lattice from a graph's g;
   - how solids (BFL and PSM) meet the interface, including a moving PSM
     solid entering liquid;
   - the in-place speed change (above) with liquid present: does it carry
     over, and what scales with what.
3. **Oracle:** a CPU free-surface D2Q9 in `reference/` (or an extension of
   `lbm2d.mjs`), with tests that report:
   - total mass drift in a closed tank over 10⁴ steps (target < 0.1%);
   - hydrostatic pressure at rest against ρ g h (target < 1% at mid-depth);
   - a dam break against Martin & Moyce (1952) with the geometry, aspect
     ratio, release and time normalisation pinned, front position x(t);
   - Torricelli efflux from a tank with an orifice against √(2gh), with the
     discharge coefficient you expect at this resolution;
   - the same at two resolutions, to show convergence.
4. **Display:** the surface from φ (marching squares at φ = ½ in a fragment
   pass? a screen-space reconstruction?), and how our particle renderer should
   behave inside and outside the liquid (particles only where φ > ½?).
5. **The visual alternative:** if (a) is out of reach, specify the best
   labelled visual liquid instead, and what it would have to show to say so.

## C. Check the absorbing inlet

The wind tunnel's velocity inlet reflected sound fully, so a solid near it
made the tunnel ring at its round-trip period (inflow pulsing 3.5%,
δρ swinging 8.9·10⁻³ at the inlet). We now prescribe, on the inlet's
regularised Zou–He reconstruction,

u_n = U_n − c_s (δρ − δρ̄), δρ̄ ← δρ̄ + (1/2000)(δρ − δρ̄) per step,

where δρ is the cell's previous-step density and δρ̄ a per-row low-pass, so the
first-order characteristic condition lets an outgoing acoustic wave leave while
the steady pressure a solid raises is kept. Measured: a pulse comes back at
0.90 from the rigid inlet and 0.018 from this one; on the ringing scene δρ's
swing fell to 9.7·10⁻⁴ and the pulsing to 0.7%. While the tank's mean
pressure is still settling, δρ̄ lags it and the inflow runs up to 2% short for
some seconds.

1. Is this a sound condition, and is there a better one for regularised
   Zou–He at Ma ≤ 0.3 (Izquierdo & Fueyo 2008; Wissocq, Sagaut & Boussuge
   2017; Heubes et al.)?
2. A better way to keep the mean than the low-pass, with no lag during
   start-up (a global mass-flux constraint? a target total inflow?).
3. Does it change DFG 2D-2's St or C_D on your oracle, with the inlet as
   it is in the benchmark?

## Deliverables

- `Vector_Tools_Fluid_Round4.md`: answers to A, B, C, with what was measured
  and what was not.
- `reference/`: runnable oracle code and tests for A (storage formats) and B
  (free surface), with result files we can rerun bit for bit, as in round 2.
- A recommendation, in order: what to build first (FP16 storage, the liquid,
  or both), and the acceptance numbers each must meet.
