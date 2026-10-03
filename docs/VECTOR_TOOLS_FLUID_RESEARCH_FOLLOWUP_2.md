# Second follow-up research prompt: choosing the numerical core

_Written 2026-10-02, after GPT's `Vector_Tools_Fluid_Followup.zip`. Its 13
solver tests pass on our machine, and a rerun of the H16 channel pair matched
all 325 numeric fields of its JSON exactly. This round is meant to be the last
research round before building gate 0. It asks GPT to make the three remaining
core numerical choices by measurement, using its own oracle. Everything that
needs a live Desmos or a GPU stays on our side._

---

Thank you. The package was verified on our machine. All 13 reference tests
pass, and a rerun of `channel --case H16-uniform` reproduced every numeric
field of your JSON exactly. The oracle is now our ground truth.

Several findings are now settled and will be built on:

- the equilibrium inlet with a zero-gradient outlet starves the channel and
  pressurises the tank;
- a reconstructed pressure outlet reflects R ≈ 0.76, and a 32-cell blend
  brings that to about 0.008;
- regularised boundaries with that sponge give clean shedding;
- BFL cuts half-cell drag sensitivity about fivefold;
- the DFG 2D-2 cycle statistics are pinned.

Desmos runtime semantics, the live 3D camera (your Quake Pro leads,
`perspectiveDistortion` and `getFovBeforePerspectiveDistortion`, are exactly
what we needed), GPU timings and perceptual tests are all ours, so leave them
out.

Three core choices remain that your CPU oracle can decide. Please extend
`reference/lbm2d.mjs` without breaking its API or its 13 tests, add tests for
everything new, and run the experiments below.

The same rules as last time apply:

- report only completed runs, with wall-clock times;
- shrink a grid rather than skip a case, and say so;
- failed runs stay in the results;
- keep the evidence labels.

Priority order is A1, B1, C1, then A2, B2, B4, then the rest.

## A. The collision operator

Add `collision: { type: 'bgk' | 'trt' | 'regularized' | 'mrt', ... }`. For TRT,
include the magic parameter Λ as an option. Add an optional Smagorinsky closure
that can sit on top of any of them. Raw Zou–He at τ = 0.53 failed after 123
steps last round, and an interactive Reynolds-number slider will reach τ much
closer to 0.5 than that.

1. **A1, a stability map.** Use your case-2 cylinder with the regularised
   boundaries and the 32-cell sponge: 300 × 120, D = 20, the deterministic ramp,
   gust and seed. Run at U ∈ {0.05, 0.1} and Re ∈ {100, 200, 400, 800, 1600},
   for each of:

   - BGK;
   - TRT with Λ = 1/4;
   - TRT with Λ = 3/16;
   - regularised collision;
   - MRT, if you implement it;
   - BGK with Smagorinsky at C = 0.1 and C = 0.17.

   For each run, report survived or failed (with the step), the peak local
   Mach, the density range, and whether a regular shedding period was accepted
   under your own St criterion. Use a fixed advective duration per run, and
   state it.

2. **A2, accuracy at Re 100.** Run DFG 2D-2 with BFL at D = 16 and D = 32 for
   each operator that passed A1 at Re 100, against your pinned official cycle
   statistics:

   - C_D maximum, minimum and both means;
   - C_L amplitude;
   - St.

   Also run DFG 2D-1 at D = 32 with TRT and regularised collision. BGK's wall
   position depends on τ, and TRT is supposed to remove that dependence: does
   it close the remaining 1.46% drag gap?

3. **A3, cost.** Give the per-cell operation count for each operator, plus the
   measured JavaScript time per step relative to BGK on the same grid, labelled
   clearly as a CPU proxy, not GPU timing.

Deliver a recommendation: one default operator for an interactive slider
spanning Re 10–2000 at about 20 cells across D, and what the panel should do
when a setting is out of the stable envelope.

## B. Moving obstacles

Last round's translating cylinder matched the fixed one's mean drag to 2.36%.
But its force fluctuation RMS was about 10× the fixed case, and the tank lost
0.34% of its mass. Dragging a Desmos point through the fluid is the
interaction users will try first, so the method matters more than any other.

Add two alternatives to the refill bounce-back:

- **Partially saturated cells**, after Noble and Torczynski (1998): the solid
  fraction per cell comes from the signed function F, either by sub-cell
  sampling or as a smooth coverage estimate from `F/|∇F|`. State which you use.
  It is attractive here because it needs no refill and works directly from the
  strict geometry's F.
- **One immersed-boundary direct-forcing scheme.** For example, multi-direct
  forcing (Wang, Fan and Luo 2008) or implicit velocity correction (Wu and Shu
  2009). Choose one and justify it.

Then run:

1. **B1, the Galilean pair again** (your case 5) for refill bounce-back, PSM and
   IB. Report mean C_D against the fixed case, force fluctuation RMS and
   half-range, mass change, and the cost per step relative to the stationary
   case.
2. **B2, tangential wall motion.** Taylor–Couette flow: the inner cylinder
   rotates at Ω, the outer is fixed. The steady solution is exact,
   `u_θ = A r + B/r`, and the torque is known. Run it at two resolutions for
   halfway bounce-back with a material wall velocity, BFL with a moving
   correction (if you can make one consistent; otherwise say so), PSM, and IB.
   This is the case the level-set velocity cannot represent.
3. **B3, a resizing body.** A circle whose radius grows smoothly from r₀ to 1.5r₀
   over a stated time, in fluid initially at rest: the "slider changes r" case.
   Report the mass balance, the pressure pulse amplitude, and the displaced
   volume against the measured outflow.
4. **B4, a realistic pointer.** Move a cylinder along a recorded-style pointer
   path: 60 Hz samples, smooth segments mixed with jumps of 1, 3 and 10 cells
   per frame. For each method, report:
   - the substeps per frame needed to keep wall displacement at or below 0.25
     cells per step;
   - what breaks when that is violated;
   - the best policy for a teleport (sweep the body, reset locally, or pause
     and resume).

Deliver a recommendation: which moving-obstacle method the tab should use for
dragged points, sliders and t-dependent obstacles, and whether any of them can
carry a quantitative force readout while moving.

## C. Float32 fidelity

The oracle stores float32 but computes in binary64, so it cannot set tolerances
for comparing it against a GLSL implementation.

1. **C1.** Add an arithmetic mode that rounds with `Math.fround` after every
   operation in the hot loop (collision, streaming and boundaries), so it
   behaves like a float32 ALU. Compare four variants:

   - float64;
   - float32 storage only;
   - float32 arithmetic;
   - float32 arithmetic with **shifted populations** (storing `f_i − w_i ρ₀`).

   Run each on:

   - (a) a long Taylor–Green decay at a small velocity (at least 10⁵ steps):
     amplitude error, mass drift;
   - (b) the case-2 cylinder at Re 100 with the A1 default operator: C_D, St,
     mass drift, density range.

2. From those results, recommend:
   - the storage form for the GPU;
   - per-quantity tolerances for GLSL-against-oracle tests (single step,
     100 steps, the long run, and forces);
   - whether any reduction (mass, force) must be done in higher precision,
     such as Kahan or pairwise summation in the reduction passes.

## D. Optional, only if time remains

Find an open-access primary source with fine-grid unconfined-cylinder values
at Re 100: mean C_D, C_L amplitude or RMS, and St, with domain size and
blockage. That would replace the unretrieved Park and Williamson rows. The
same rule applies: retrieved from the primary text, or marked unretrieved.

## Format of the reply

One zip, the same layout as last time:

- `Vector_Tools_Fluid_Followup_2.md`, with one section per task, tables, the
  three recommendations, and what is still unknown;
- `reference/`, updated and backward-compatible, with new tests;
- `results/`, the JSON for every run;
- `results/INDEX.md`.

Run commands should be `node reference/run-all.mjs --group <name>` as before.
