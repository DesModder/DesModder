# Vector Tools fluid — research round 5: making the liquid behave like real water

This continues the thread of rounds 1–4. Round 4 gave us the free-surface
oracle (`free-surface.mjs`) and the FP16S study; both are built. The liquid now
runs as an interactive mock-up (`liquid-mockup.html`, attached), and a CPU
reference with validation scripts is attached as `liquid-validation/`. Please
read its `README.md` first: it holds every number quoted below and how each
was measured.

## Where the liquid stands

- **The tank.** A 1 m wide tank of water, simulated as a 2D slice.
  - D2Q9 free-surface LBM: your round-4 mass ledger and the five gather
    passes.
  - Regularized collision (Latt–Chopard), keeping the non-equilibrium momentum
    that Guo forcing puts there. Without it half the gravity was applied.
  - Smagorinsky C = 0.1.
  - Water's own viscosity: τ = 0.5 + 3ν·dt/dx² ≈ 0.50001.
  - Lattice gravity 3·10⁻⁵, so dt = √(g_lat·dx/g).
  - It plays in real time on WebGL2, float32, with mass stored as its
    difference from density. At 6 mm cells (160 × 96) on an Intel Iris Xe that
    takes 12 000 steps a second; real time needs 7 233.
- **Flag rules.**
  - A surface cell with no liquid beside it is emptied, and the ledger's
    reservoir keeps its mass.
  - For holes, either half-full cells inside the liquid fill 5% a step, or
    (with bubbles) Thürey's rule applies.
  - Spray (a surface cell with no bulk liquid beside it) is held to Mach 0.25.
- **Walls.** By default a slip wall with log-law friction: specular
  reflection on straight walls, plus a wall-stress body force from
  u/u*τ = ln(y u*τ/ν)/κ + B at the first cell's centre (κ 0.41, B 5.2). Plain
  bounce-back is a switch.
- **Bubbles (a switch).** Each enclosed gas region is an ideal gas with p·V
  kept, as in Thürey, Körner and Anderl. On the GPU:
  - regions are labelled in a shader and summed onto a root pixel with
    float-blended scatter;
  - pressure is limited to ±0.15 atm;
  - the update runs every 4th step.
- **Tap.** A nozzle kept full, with the jet leaving at 1 m/s.

What matches reality, measured:

- **Dam-break front speed.** Late-stage speed 1.32 √(gH) against Martin &
  Moyce's 1.32. Positions run 3–6% ahead; with 3 mm cells, 9%.
- **Hydrostatics.** Within 0.1–0.65% of ρgh.
- **Mass.** Kept to 10⁻⁷–10⁻⁸ on the GPU.

## What Rafael reports, and what we found

Rafael tried it and said the water is "too fast", leaves holes, sticks to
walls weirdly, and should "act exactly like real life fluid". He asked us to
look to real experiments and real simulations. In order:

1. **Sticking (largely fixed).** Bounce-back stops the first cell dead.
   - A 1.5 cm film beside a wall fell 38% as far as free fall; a 3 cm slab
     74%.
   - The slip-plus-log-law wall gives 80% and 93%. The same slabs in open air
     fall 89% and 98%.
   - So the free surface itself slows thin sheets by about 10%. Why?
2. **Holes and churning (cause found, fix incomplete).**
   - Air held at one atmosphere implodes: a 6 cm pocket under 30 cm of water
     collapsed in 0.14 s and stirred the water at 0.3–0.5 m/s for seconds.
   - The ideal-gas bubble model stops that, but a 6.3 cm bubble, 10 cells
     across, breaks up within about 0.4 s. It rises at 0.2 m/s; Collins (1965)
     measured 0.58 √(g d) ≈ 0.46 m/s.
   - More dissipation makes it rise faster and cleaner: at τ 0.51 (about 300×
     water's viscosity) it reached 0.39 m/s.
   - With bubbles on, the water is no calmer after a pour.
3. **"Too fast": unknown.** Sliding walls leave the water livelier: 11.5 J/m
   of kinetic energy 2 s into the dam break, against 4.7 with gripping walls.
   We have no measured energy decay to compare either with. A 2D slice also
   lacks the 3D turbulence that drains real water.
4. **Waves die too fast.** A standing wave (mode 2, 30 cm deep, 2 cm high)
   keeps its period (0.831 s against 0.819) but loses 13% of its height a
   period at 6 mm and 4.8% at 3 mm, against under 1% for real water.
   - Eddy viscosity, collision, bubbles and fill rules do not change it;
     only finer cells help.
   - It looks like the free surface smeared over a few cells.

## What we ask

As before, **a runnable CPU oracle with `node --test` tests and pinned numbers
is worth more than prose**. Please build on `liquid-validation/liquid.cjs` and
its scripts, report what you measured, and say plainly what you did not run.

### A. Measured data to compare against

We need real experiments with numbers, not only pictures. For each, give the
source, the geometry, the measured quantities, and digitized values or where to
get them:

1. **Energy decay or settling after a dam break in a closed tank.**
   - Wave gauges or wall pressures over several seconds: Lobovský et al. 2014;
     SPHERIC test cases; Kleefsman et al. 2005 (3D with an obstacle — is a
     2D-comparable part usable?); Koshizuka & Oka 1996; any others.
   - We want what happens after the first impact on the far wall, which is
     where "too fast" shows.
2. **Sloshing in a rectangular tank.** Damping of free decay at small and at
   large, breaking, amplitude.
3. **A jet or tap pouring into a pool.** How far and how long entrained air
   lasts, and how the pool settles once the tap stops.
4. **Rising bubbles that can be compared in 2D.** Planar or Hele-Shaw bubbles
   (Collins 1965 and later), with rise speed and shape against size.

Say which of these a 2D slice can honestly be compared with, and which need 3D.

### B. A 2D slice of 3D water

Our tank is a slice of something, and real water loses energy in ways a 2D
lattice cannot represent: the 3D turbulence cascade, and friction on front
and back walls.

1. What do published 2D free-surface simulations validated against
   experiments do about this? Possible answers include:
   - a Hele-Shaw or wall-friction drag for a tank of depth b;
   - a depth-averaged turbulence closure;
   - a larger Smagorinsky constant, or WALE or Vreman;
   - a calibrated linear or quadratic drag;
   - nothing.
2. Recommend one, give its parameters in terms of physical quantities (tank
   depth b, water's ν, cell size), and calibrate it on your oracle against
   A.1–A.3.
3. It must not spoil the dam-break front (Martin & Moyce, and Lobovský if
   usable) or hydrostatics. Show the before and after numbers.

### C. Bubbles and spray at 6–8 mm cells

1. Why does a 10-cell bubble fragment and rise at half speed at water's
   viscosity? Is it the free-surface condition (Schwarzmeier et al. 2023 found
   no variant balances liquid and gas pressure), the absent surface tension,
   too little dissipation, or resolution?
2. **Surface tension.** Water's capillary length (2.7 mm) is smaller than a
   cell, yet surface tension is what keeps small bubbles and drops whole.
   - How do FSLBM codes add it at the free surface, and with which curvature
     estimate (Thürey's local triangulation, finite differences of normals,
     height functions)?
   - Is it stable and useful at our resolution, or harmful?
   - Measure on the oracle with the CPU bubble model on: a 2D drop's
     oscillation, a bubble's rise, and spurious currents.
3. **Subgrid bubbles.** Is the right answer for bubbles smaller than about
   20 cells to stop resolving them? For example, convert an enclosed gas
   region below some size into Lagrangian bubble particles that rise at
   measured speeds (Clift, Grace & Weber; Collins) and pop at the surface,
   with the liquid refilled consistently with the mass ledger. Give a
   conservative algorithm, or say why not.
4. The same question for spray: drops of one or two cells. We currently cap
   them at Mach 0.25.

### D. Standing waves damp too fast

Our free surface loses 13% of a wave's height a period at 6 mm (3.2 cells of
amplitude) and 4.8% at 3 mm. Is this the known first-order behaviour of the
mass-ledger free surface?

Which fix is known to work on a wave: a sharper interface reconstruction
(PLIC-like normals in the mass exchange), the Schwarzmeier variant (iii) we
already use, a different mass-exchange weight, or a higher-order
free-surface condition? Measure the damping per period on the oracle with
`wave.cjs`.

### E. The wall model

Is reflection plus log-law wall stress at the first cell a sound wall model
for a free-surface liquid at these resolutions? Check:

- where it is wrong: thin films, contact lines, corners and diagonal walls
  (we fall back to bounce-back there);
- whether a published LBM wall function (Malaspinas & Sagaut 2014 and
  successors) does better for films;
- what a cell-thick film on a wall should do, and whether our 80% fall is
  right for a 1.5 cm film or still too slow.

### F. Constraints for anything you recommend

- **Platform.** WebGL2 fragment shaders, float32 (FP16S storage possible),
  no compute shaders and no atomics. Float blending (`EXT_float_blend`) is
  available, which is how we sum bubbles.
- **Step budget.** About 140 µs a step at 160 × 96 on an Iris Xe to stay in
  real time. Today a step is about 100 µs without bubbles and 125 µs with
  bubbles every 4th step. Say what each recommendation costs per cell per
  step.
- **Mass.** It stays conserved to round-off; anything that adds or removes
  liquid must go through the ledger.
- **Rafael judges by eye.** Within these limits, prefer what makes the
  water look and move like real water: pours, splashes, settling, bubbles and
  films. But every claim must stand on a measured comparison, and say where
  the comparison is only qualitative.

## Attached

- `liquid-mockup.html`: the mock-up. It runs offline in Chrome. The solver
  (`Liquid`, CPU) and `GpuLiquid` (WebGL2) are inline in its script.
- `liquid-validation/`:
  - `liquid.cjs`, the CPU reference;
  - `dam.cjs`, `rise.cjs`, `wave.cjs`, `wall.cjs`, `physics.cjs`;
  - `README.md`, with every number above.
- `FLUID_TAB.md`: the Fluid tab and the liquid's history, rounds 1–4.
- `VECTOR_TOOLS_FLUID_RESEARCH_FOLLOWUP_3.md`: the round-4 prompt, for
  continuity.
