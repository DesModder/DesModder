# Follow-up research prompt: fluid flow and 3D FieldPlay

_Written 2026-10-02, after GPT's first reply (`Vector_Tools_Research_Reply.zip`:
`Vector_Tools_Fluid_Research.md` and `Future_Research_Assessment.md`). The
prompt below is meant to be pasted into the same ChatGPT conversation._

---

Thank you. Your reply was checked against the repository. Your replay of the
mock-up kernel reproduces exactly when rerun: mean C_D 2.06686, upstream
density 1.12076, St 0.19628, sampled peak Mach 0.2952. Three findings were
confirmed in the code, and all three change the plan:

- the tank is pressurised to ρ ≈ 1.08–1.14, because no boundary fixes the
  pressure and the inlet trim pumps mass in;
- `latexToGLSL.ts` guards such as `sqrt(max(a,0))`, `log(max(a,1e-12))`,
  `asin(clamp(...))` and `vtDiv` would fabricate solids;
- the level-set wall velocity carries normal motion only.

The `matrix3.ts` row-major/column-major comment conflict and the stale
`symbolic.ts` description were also confirmed.

This round is narrower. Please **turn your proposed targets into measured
numbers where a CPU can measure them**, and **pin data that must not be
reconstructed from memory**. Keep the evidence labels you used (code evidence,
supplied measurement, independent calculation, proposed target, unverified,
decision). They worked well.

The following are **out of scope**, because they will be done against a real
Desmos and real GPUs on our side:

- GPU timings;
- probing the live Desmos 3D camera and projection;
- testing how native `vector()` lists behave;
- product decisions.

## Task 1 (highest priority): a CPU reference solver, and the experiments you proposed

Write a dependency-free JavaScript ES module, `reference/lbm2d.mjs`, runnable
in Node 20 or later, that implements D2Q9 with **exactly the mock-up's
conventions**:

- numbering 0 rest, 1 E, 2 N, 3 W, 4 S, 5 NE, 6 NW, 7 SW, 8 SE;
- post-collision storage with pull streaming, `f_i(x, t+1) = f_i*(x − c_i, t)`;
- cell index `y·NX + x`, with y pointing up;
- lattice units, `c_s² = 1/3`;
- selectable `Float32Array` or `Float64Array` storage, because the GPU will be
  float32.

It will become the oracle our unit tests (Jest, Node) compare a GLSL
implementation against. Give it a small, documented, deterministic API. For
example:

- `createLattice({ nx, ny, tau, storage })`;
- `setSolids(predicate)`, and link fractions `q` for BFL from a signed function
  `F(x, y)` by bracketed bisection, as you described;
- `setBoundaries({ left, right, top, bottom })`, with types `zouHeVelocity`,
  `pressure` (reconstructed), `zeroGradient`, `equilibrium`, `slip`, `noSlip`
  and `periodic`;
- Guo forcing;
- `step(n)`;
- `macroscopic()`;
- `bodyForce(bodyId)` by momentum exchange;
- `massTotal()`.

Then run the experiments below. State each one's wall-clock time and the
resolutions you could afford. Shrink the grid rather than skip a case, and say
so when you do. Report numbers only from runs you actually completed.

1. **Boundaries in an empty channel.** No-slip walls, Re about 50, Zou–He
   velocity inlet (uniform, then parabolic) with a reconstructed pressure
   outlet. Run at H = 16, 32 and 64. Report inlet, section and outlet flux, mass
   drift, the density range, and the profile L2 error against Poiseuille once
   developed. Repeat with the mock-up's pair (an equilibrium inlet at ρ = 1 with
   a zero-gradient outlet) so the difference is measured, not argued.
2. **The mock-up's own cylinder, re-run with correct boundaries.** Use 300 × 120
   cells, D = 20, the centre at the mock-up's position, slip top and bottom, and
   Re 100. Use the same deterministic start: ramp, then a gust, as in the
   mock-up's code. Compare:

   - (a) the mock-up's boundaries with the inlet trim, against
   - (b) a Zou–He inlet with a reconstructed pressure outlet and no trim.

   For each, report the tank density range, mean upstream speed and density,
   C_D normalised both ways, C_L amplitude and St. Does the pressurisation
   disappear? Does St move?

3. **DFG 2D-1 (steady, Re 20)** at D = 16 and D = 32 (and 48 if time allows),
   with staircase bounce-back against BFL. Report C_D, C_L and Δp against the
   official values, plus the change in C_D when the cylinder is shifted by half
   a cell.
4. **Outlet reflection.** A small Gaussian pressure pulse travelling into
   (i) a zero-gradient outlet, (ii) the reconstructed pressure outlet and
   (iii) a sponge 16 and 32 cells wide. Report the reflection coefficient R
   measured as you defined it.
5. **Galilean check for a moving body.** A cylinder translating at constant
   speed through fluid at rest, against a fixed cylinder in uniform flow at the
   same Re. Use the moving-wall bounce-back term, and refill uncovered cells as
   you recommend. Compare the drag. This tells us whether the mock-up's
   "drag the point" interaction can ever be quantitative.
6. **Mach sensitivity.** Run case 2(b) at an inlet lattice speed of 0.05, 0.1
   and 0.15, with τ adjusted to hold Re. Show how C_D and St move.

Deliver the module, a `reference/run-all.mjs` that reproduces every number,
and `results/*.json`.

## Task 2: benchmark data, retrieved rather than remembered

Build `data/benchmarks.json`. Every value needs its source (URL, paper, table or
figure number) and a retrieval date. A value you cannot retrieve from a primary
or official source is marked `"unretrieved"`, never filled from memory.

- **Ghia, Ghia and Shin (1982)**: u along the vertical centreline and v along
  the horizontal centreline at Re 100, 400 and 1000. Add Erturk et al. (2005)
  where it supersedes them.
- **DFG 2D-1 and 2D-2** official values. For 2D-2, the cycle statistics (mean,
  minimum and maximum of C_D and C_L, and St) from the official time-series
  files, with their checksums.
- **The unconfined cylinder**: Park, Kwon and Choi (1998) at Re 40, 60, 80, 100
  and 160. Williamson's St–Re relation for laminar shedding, with its stated
  range. The recirculation length at Re 40.
- **The backward-facing step** (Armaly et al. 1983): reattachment length
  against Re, with the expansion ratio and Re definition.
- Kovasznay and Blasius constants, as you gave them, with sources.

## Task 3: Desmos's real-number semantics, for a strict geometry compiler

Obstacles will compile through a new strict mode in which each operation
returns a value and a validity flag. To match Desmos rather than guess, please
produce a table: **expression → what Desmos does → source (help-centre article,
official documentation, or "needs a runtime test")**. We will run every
"needs a runtime test" row in a real Desmos.

Cover at least:

- `sqrt`, `ln`, `log`, `arcsin`, `arccos`, `arccosh` and `arctanh` outside
  their domains;
- division by zero, and `0^0`;
- negative bases with fractional exponents (Desmos's rule for odd-denominator
  rationals such as `(−8)^{1/3}`), and `\sqrt[n]{}` of negatives;
- `mod` with negative arguments;
- factorial of non-integers;
- a piecewise with no matching branch;
- a restriction `\{...\}` attached to an inequality;
- chained inequalities;
- strict against non-strict inequalities (how the boundary is drawn);
- how `y < f(x)` is shaded where `f` is undefined;
- degree mode;
- what changes in complex mode.

Then propose the validity-propagation rules in GLSL ES 3.00: which operations
produce invalid, how invalid passes through comparisons and piecewise
branches, and the cost per operation.

## Task 4: legibility and rendering for layered 3D FieldPlay

Rafael's proposal, which your Q11(c) endorsed: particles seeded in stacked
z-layers that share one fixed total count, most of them opaque and bold, and
10–30% lighter so the motion inside stays visible. You noted that opaque
particles occlude strongly. Please research how to keep a dense 3D particle and
trail field legible, with mechanisms rather than names:

- opacity optimisation for line and particle fields (Günther, Rössl and
  Theisel 2013, and successors, including any particle or point variants);
- depth-dependent halos (Everts et al. 2009);
- illuminated lines (Zöckler et al. 1996; Mallo et al. 2005);
- ambient occlusion for lines;
- depth cueing;
- seeding strategies for 3D.

For each technique, give its cost in WebGL2 and its benefit to legibility.
Then recommend what "lighter" should modulate (alpha, luminance, size, trail
length, or a combination), with perceptual reasons.

Give WebGL2 specifics for 60,000 particles with 30 world-space history samples
each:

- trails as camera-facing quads or ribbons expanded in the vertex shader from
  `gl_VertexID`, since `lineWidth` above 1 is not portable;
- the ring-buffer layout in textures;
- per-frame draw cost;
- what to drop first when over budget.

## Task 5: what upstream DesModder and the Desmos API know about 3D

Our fork merged upstream DesModder at `53ff70bc`, and our `graph-state` types
know only `threeDMode` and the 3D parametric domains. Please check:

- **Upstream DesModder** (github.com/DesModder/DesModder) since that merge, for
  any 3D-related code: camera or projection access, 3D viewport bounds,
  perspective, 3D GLesmos or overlay work, and `graph-state` additions for 3D.
  Cite file paths and commits.
- **The Desmos API v1.11 `Calculator3D` documentation**: which options,
  settings or `getState()` fields expose 3D bounds, rotation and perspective.

We will verify everything you find at runtime. Do not guess private property
names; say "not found" instead.

## Format of the reply

Send one zip containing:

- `Vector_Tools_Fluid_Followup.md`: one section per task, measured numbers in
  tables, and evidence labels throughout;
- `reference/`: the solver and the run-all script;
- `results/`: the JSON from every run;
- `data/benchmarks.json`.

End the report with any change to your gate order that the measurements
justify, and list what is still unknown.
