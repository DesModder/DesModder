# The Fluid tab

_Built 2026-10-03 on `feature/vector-tools-foundation`, from the plan in
`VECTOR_TOOLS_FLUID_RESEARCH_BRIEF.md` and GPT's three research replies. Every
number below comes from a test in the repository that checks it on each run._

The sixth Vector Tools tab simulates a fluid on the GPU, round whatever the
graph shades. It has two fluids:

- **Wind tunnel.** Air enters on the left of a fixed tank and leaves on the
  right, flowing round every inequality in the expression list. Each solid's
  drag, lift and shedding frequency are measured.
- **Stirred box.** The field's own P and Q push a closed box of fluid. The
  fluid keeps the part of the push that curls and answers the part that
  spreads with pressure.

The liquid comes next (brief §8.0).

| Wind tunnel                                                    | Stirred box                                  |
| -------------------------------------------------------------- | -------------------------------------------- |
| ![wind tunnel](assets/fluid-wind-tunnel.png)                   | ![stirred box](assets/fluid-stirred-box.png) |
| ![particles and arrows](assets/fluid-particles-and-arrows.png) | ![panel](assets/fluid-wind-tunnel-panel.png) |

## What it does

- **Solids are the graph's inequalities**, compiled strictly so the fluid sees
  exactly what Desmos shades: undefined is never solid
  (`FLUID_STRICT_GEOMETRY.md`). A hidden row lets the fluid through. Each row
  in the tab says whether it is a solid and, if not, why.
- **The tank is fixed in graph coordinates.** "Fit to view" moves it, and
  panning moves the picture, not the flow. A preview shows the tank cell by
  cell as the fluid sees it, with undefined cells in amber.
- **What is shown:** vorticity, speed or pressure, on a canvas under Desmos's
  own. The existing particles and arrows draw the flow while it runs, and the
  field's formula again when it stops.
- **Measurements:** each solid's `C_D`, `C_L` and, once its lift repeats
  steadily, its Strouhal number, with forces averaged over the last cycle.
  Before that the tab says why there is no number yet. Ticking "Write
  measurements into the graph" puts them in a folder as `C_{D1}`, `C_{L1}` and
  `S_{t1}`, with values still settling written as undefined.
- **Moving solids:** a solid whose inequality reads a slider or `t` moves
  through the fluid as partially saturated cells (GPT's third round), pushing
  it aside and carrying what is inside. A solid's translation is averaged
  over the last 100 ms of updates, because Desmos reports a dragged slider
  every frame or two and unevenly; one update alone scattered the wall speed
  by ±40%.
  - **Parked while still.** A solid only sliders move is a fixed solid, with
    the sharper interpolated walls and no fluid inside, while its sliders are
    still; it turns into partially saturated cells the moment one changes,
    starting from its parked shape, and is parked again half a second after
    they stop. Every cell keeps its populations across the switch. A solid
    that reads `t` never parks.
  - **Sampled on the GPU.** Each moving row's signed function and gradient are
    drawn into a float texture from the GLSL its compiler emits, and read
    back a frame later (`obstacleSampler.ts`); the cells are built from those
    samples by the same code the CPU's feed. On two parabolas over 300 × 182
    cells, a drag cost 12.6 ms of the tab's time a frame on the CPU and costs
    5.7 ms now, and the median frame went from 33 to 16.8 ms.
  - **The inlet blows only into the fluid part of a cell.** Where a moving
    solid covers it, the inlet prescribes the solid's own velocity
    (`openPrescribed`); blowing into the solid filled it until the fluid
    burst out of its sides and the lattice went unstable.
- **Rafael's guards (brief §8.1):**
  - Lattice speed: Auto, Accurate or Lively. Auto halves the lattice speed if
    the flow anywhere passes Mach 0.3. The wind tunnel is rescaled in place
    and runs on with the flow it had (`rescale`, below); the stirred box, and
    a flow that has gone unstable, restart. Lively keeps its speed and
    says "speed limit exceeded" while the flow is past Mach 0.3, and nothing
    measured meanwhile counts as settled.
  - Resizing a solid (its area changing by more than 2%): Auto updates it in
    place and marks the flow as settling; Strict restarts.
  - Moving solids above Re 200, where the moving-solid method runs with the
    turbulence model it was not validated with: Auto moves them and gives
    them no force numbers; Strict runs the flow at Re 200 while any solid can
    move.
  - Always: a wall moves at most 0.05 cells a step, a jump of more than two
    cells is placed without a wall velocity rather than swept, and a moving
    solid's forces are marked provisional until it has been still for ten
    passes.
  - Writeback is opt-in.
- **The clock** steps a fixed dt; frames only decide how many steps to run. A
  slow machine runs slower than real time and says so, and never changes the
  physics.
- **Cells are square.** The lattice spans the tank's width and a whole number
  of square cells in height, centred on the tank, so a rounded cell count
  never stretches the solids (`fluidLatticeTank`).
- **The page never waits for the GPU.** Forces and the flow are read back
  through pixel-pack buffers and fences, and collected a frame later, labelled
  with the step they were taken at. Measured live (300 × 120, two solids),
  synchronous reads were 78% of each frame's main-thread time: 12.6 ms a frame
  then, 3.2 ms now. Moving solids are sampled the same way (above).
- **The inlet lets sound out.** A rigid velocity inlet reflects every
  pressure wave, and a solid near it made the tunnel ring at its round-trip
  period, drawn by the particles as bands across the stream. The inlet now
  prescribes u = U − c_s(δρ − δρ̄) against each row's slow mean δρ̄
  (`absorbingInflow`): a pulse comes back at 0.018 of itself instead of 0.90.
- **The particles follow the flow every frame** the GPU has a read ready,
  about 45 times a second, not 10.
- **The backdrop follows the arrows.** The dark backdrop is laid by the
  particles while they run, and by the arrows when the particles are off.

## How it works

| Piece                   | Where                                                    | What it is                                                                                                                                          |
| ----------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strict geometry         | `src/field-rendering/sim/strict*.ts`                     | LaTeX to a tree, to a CPU evaluator with Desmos's measured rules, and to GLSL with a validity flag beside every value                               |
| Obstacles               | `sim/obstacles.ts`                                       | an inequality as `contains`, a signed function whose zero is the wall, and a tank rasterizer                                                        |
| Lattice, CPU reference  | `sim/lbm/d2q9.ts`, `boundaries.ts`                       | D2Q9, BGK with Guo forcing and an optional Smagorinsky closure, shifted float32 populations, walls, Zou–He open sides, solids, sponge, force fields |
| Lattice, GPU            | `sim/lbm/GpuD2Q9.ts`                                     | the same, one fragment pass per step, four RGBA32F targets; tables generated from the TypeScript so the two cannot drift                            |
| Walls and forces        | `sim/lbm/links.ts`                                       | interpolated bounce-back from the signed function (16 samples, 24 bisections), momentum-exchange force, compensated sums                            |
| Benchmarks              | `sim/lbm/dfg.ts`                                         | the DFG cylinder channels, set up from Desmos LaTeX                                                                                                 |
| Shedding                | `sim/measure.ts`                                         | GPT's acceptance rule: three cycles, a real swing, periods within 2%                                                                                |
| Scheduler, units, probe | `StepScheduler.ts`, `latticeUnits.ts`, `capabilities.ts` | fixed steps; graph units to lattice units; a GPU check that renders and reads back                                                                  |
| Display                 | `sim/FluidOverlay.ts`                                    | the lattice's context, and a two-pass display: a value per cell, then a filtered screen pass                                                        |
| Moving solids           | `sim/movingSolids.ts`                                    | coverage from the signed function, and a wall velocity: the level set's normal speed at walls, and a least-squares translation everywhere           |
| Moving-solid sampler    | `sim/obstacleSampler.ts`                                 | the signed function and its gradient at every cell centre, drawn on the lattice's context and read back asynchronously                              |
| Speed change            | `CpuD2Q9.rescale`, `GpuD2Q9.rescale`                     | the flow at a new lattice speed: equilibrium at s·u and s²·δρ, non-equilibrium times s(τ′ − 1)/(τ − 1)                                              |
| The tab                 | `plugins/vector-tools/fluid/`                            | `FluidSession` (lattice, clock, measurements, guards), `FluidGraphWriter` (writeback)                                                               |

## How it was verified

The CPU reference is checked against exact solutions. The GPU is checked
against the CPU, step by step. The whole path, from Desmos LaTeX to GPU
forces, is checked against the official DFG benchmarks and GPT's independent
CPU oracle.

| Check                                                      | Result                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| Desmos edge cases (152) and rational exponents (60)        | CPU evaluator matches live Desmos on every one; GLSL within float32      |
| 30, 60, 120 and 144 Hz frames, and jittered frames         | bit-identical states step for step                                       |
| GPU against CPU, bulk, one step / 100 steps                | 4·10⁻⁹ / 2.5·10⁻⁸ per population                                         |
| GPU against CPU, every boundary, BFL, closure, force field | within 5·10⁻⁸ / 2·10⁻⁷                                                   |
| Taylor–Green vortex decay, 64 cells                        | 0.23% from 2νk²                                                          |
| Shifted float32, weak vortex                               | within 0.5% of float64, where unshifted float32 loses most of it         |
| Poiseuille (halfway walls) / Couette (moving lid)          | 0.2% / 10⁻⁴                                                              |
| Off-grid walls, BFL against halfway                        | 0.3% against 4.7%; matches GPT's oracle row for row                      |
| Drag in a pushed periodic box                              | balances the applied force to four decimals                              |
| Channel from rest, velocity inlet and pressure outlet      | parabola within 0.83% of the peak; interior flux within 0.014%           |
| DFG 2D-1, Re 20, 32 cells across                           | C_D 1.45%, Δp 1.10% from the benchmark; within 0.02% of GPT's oracle     |
| DFG 2D-2, Re 100, 32 cells across                          | peak C_D 0.95%, lift range −0.09%, St 0.17%; equal to the oracle to 4 dp |
| Stirred box, curl against gradient of the same strength    | the gradient moves the fluid at under 5% of the curl                     |
| Moving cylinder against a held one (GPT's Galilean pair)   | GPU within 10⁻³ of GPT's 2.013008 and 2.016551                           |
| A disc slid by a slider at 2 units/s, live                 | fluid inside moves at 0.02793 cells/step against its walls' 0.02771      |
| Moving solids sampled on the GPU against the CPU           | signed values to 10⁻⁵, gradients to 10⁻³, coverage to 10⁻³, area 10⁻⁴    |
| Inlet across a moving solid, 8 s of flow                   | no restart; the inside at no more pressure than the fluid around it      |
| Speed halved mid-decay, Taylor–Green, 48 cells             | 0.08% from the run that never changed speed (0.31% from equilibrium)     |
| GPU rescale against CPU, at once / 50 steps on             | 10⁻⁸ / 2·10⁻⁷ per population                                             |

Evidence pictures: `assets/fluid-gate1-taylor-green.png`,
`fluid-gate2-poiseuille.png`, `fluid-gate3-dfg.png` and
`fluid-gate4-shedding.png`; the tab live: `fluid-wind-tunnel.png`,
`fluid-stirred-box.png`, `fluid-particles-and-arrows.png` and
`fluid-moving-solid.png`.

## Known limits

- **A moving solid's forces include the fluid it carries**, so they are
  provisional while it moves. A spin in place is invisible to the graph: a
  slider moves a region, not a rigid body, so a rotating ellipse's walls get
  their normal velocity and its inside none. Neither PSM nor IB conserves
  volume when a solid grows (GPT's third round), hence the resize guard.
- **Auto's rollback above Re 200 is not built.** The brief asks Auto to keep a
  last valid state while a solid moves above Re 200, and to roll back and cap
  Re at 200 if the flow goes invalid. For now the tab's general guard
  applies: an invalid flow halves the lattice speed and restarts.
- **Parking and unparking rebuild the mask on the CPU**, 9 to 19 ms once at
  the start of a drag and half a second after it.
- **The solver is memory-bandwidth bound.** 300 × 167 cells cost 0.10 ms a
  step on Iris Xe, 600 × 334 cost 1.22 ms. Half-precision storage is round 4's
  question A (`VECTOR_TOOLS_FLUID_RESEARCH_FOLLOWUP_3.md`).
- **While the tank's mean pressure settles after a start**, the absorbing
  inlet's mean lags it and the inflow runs up to 2% short for some seconds.
- **While a solid moves, its walls are partially saturated cells**, a blend
  over a cell rather than a line, with fluid inside that moves with it. A
  sharper moving wall (interpolated bounce-back with refilled cells) is the
  alternative, untested here.
- **Reynolds number is per reference length**, one graph unit unless set.
  A solid several units across runs at several times that, where real flow
  is unsteady: two parabolas four units across at Re 100 are at about 400.
- **The reconstructed outlet bends the flow in its last two columns**, where
  a cell-centre ρu stops being the flux (0.5–0.6%). The sponge keeps this
  from reflecting, and nothing measures there.
- **Inlet corners.** The inlet holds the flow exactly uniform. With a solid
  close to it, the flow there wants to speed up along the walls to get round
  the solid, and the mismatch sheds weak vorticity from the inlet's two
  corners; the wind-tunnel picture's cylinder blocks a quarter of the tank
  only two diameters downstream. An empty tunnel shows none, on the CPU or on
  the GPU, which agree there step for step. Placing solids further from the
  inlet removes it.
- **The stirred box's strength is regulated, not taken literally.** The field
  gives the push its shape. The strength eases toward the typical speed,
  because a push shaped like a rotation spins a closed box up without
  inertial limit. It is regulated every half second of flow, not of wall
  clock, so a slower computer stirs the same flow, and it changes smoothly
  through a uniform: changed in jumps, each correction set the closed box
  ringing, and the ringing was most of what a gradient field appeared to
  move.
- **Desmos snaps tan(π/2) to infinity, and factorial is refused** in solids
  until the GPU has a tested Gamma.

## Next

- **The liquid** (brief §8.0): GPT's round-4 free-surface solver, ported to
  the browser, runs in `docs/mockups/liquid-mockup.html` (dam break, pour,
  tank with a hole, still tank; pour and draw walls by hand). The tab waits
  on Rafael's verdict on that mock-up. What the port found beyond GPT:

  - **A stranded surface cell ran away.** A 1%-full cell left behind when
    the dam column fell had no liquid beside it, so it could pass its mass
    nowhere and gravity sped it up for ever: Mach 0.94 by step 9700 while
    the liquid itself never passed 0.12. Such a cell is now emptied and the
    ledger's reservoir keeps its mass. The front is unchanged to two
    decimals.
  - **Pools had holes.** A surface cell with liquid all round has inflow
    equal to outflow, so pressure never fills it: 336 of them sat inside
    the poured pool, and the row along the floor stayed a third to half
    full. Filling them at once (Thürey's rule) blew up a dam break at Mach
    0.28, because it takes a whole cell from nearly empty spray. Filling
    5% of a cell a step, as negative excess through the ledger, is stable
    everywhere and keeps mass to 1e-13. It costs the dam-break front about
    one point at every size, so it is a switch in the mock-up, for Rafael.
  - **The dam break converges.** GPT refined at fixed gravity and saw 5.3%
    then 8.7%. Held at the same speeds (g ∝ 1/a, front read in a/10 rows),
    the mean error against Martin & Moyce is 9.0%, 4.9%, 3.9% at a = 15,
    30, 45 with holes left, and 10.6%, 5.9%, 4.5% with them filled.
  - **It was honey in slow motion.** Mapped to metres, the first mock-up
    (τ 0.53) was 460–2800× as viscous as water and played 13× slower than
    real time. The mock-up is now a 1 m tank of water: lattice gravity held
    at 3e-5 (doubling it pushed scenes past Mach 0.3), the step from
    dt = √(g_lat·dx/g), and τ = 0.5 + 3ν·dt/dx² ≈ 0.50001.
  - **Regularized collision makes water's viscosity stable.** BGK at τ near
    0.5 reached Mach 0.36 on noise and blew up at stronger gravity;
    Latt–Chopard regularization, keeping the non-equilibrium's momentum and
    stress only, holds peak Mach at 0.18 or less. Dropping the momentum part
    as well, the textbook form, applies half the gravity under Guo forcing
    (hydrostatic pressure came out at 0.50); with it, 0.999.
  - **At water's viscosity the front moves at the experiment's speed**:
    1.32 √(gH) late on at a = 45, against Martin & Moyce's 1.32; the thick
    liquid managed 1.15. Positions run 3–6% ahead, where their gate slowed
    the first moments, and 9% at 3 mm cells, where water's boundary layer is
    far thinner than a cell and the tip film slides.
  - **Drops a cell or two wide bounced off the lid at full speed** and fell
    to Mach 0.34: spray, a surface cell with no bulk liquid beside it, is
    held to Mach 0.25. A numerical guard, not physics.
  - **The GPU solver** (WebGL2, float32, in the page) matches the CPU to
    1e-8 after a step and to rounding through 500; past that the splash is
    chaotic and they part. 12 200 steps a second at 6 mm cells on Iris Xe,
    22× the CPU, so Auto picks 6 mm in real time; 4 mm runs at real time
    with nothing to spare. Two things made it that fast: populations are
    written once by the collision and never copied (a cell the liquid has
    just reached is flagged and the next collision builds its equilibrium,
    for itself and for neighbours streaming from it), worth 1.4–1.7×;
    merging the five passes into three by recomputing neighbours' flags was
    slower, so the passes stay five.
  - **Float32 mass drifted** 3e-4 in 12 s, enough to fail the 0.1% gate in
    a minute: a full cell's mass sits near 1.0017, where float32 resolves
    1e-7, and the ledger's small shares fell below that. Stored as its
    difference from the cell's density, exactly zero when full, it keeps
    4e-7 over an 18 s pour.
  - **Discharge is still not validated**: Cd 0.89–0.90 at 6 mm and water's
    viscosity, against 0.61 for a sharp-edged slot (Kirchhoff, π/(π+2)).
    An 8-cell gap does not resolve the jet narrowing past the edge.
  - **Rafael's report after real time** (water too fast, holes, sticking to
    walls, a walled-in tap bursting) was checked against experiments and
    exact theory in `docs/mockups/liquid-validation/`. In the mock-up now:

    - sliding walls with log-law friction, as a switch against gripping
      ones;
    - the tap as a nozzle kept full, which pours only where there is room;
    - ideal-gas bubbles on the GPU, behind an Air switch (off by default). They
      end the implosions without moving the dam-break front, but at 6–8 mm a
      6 cm bubble breaks up within half a second and the water is no calmer.
      They cost a quarter more GPU time, which drops Auto to 8 mm.

    Measured, with no fix yet: the standing wave damps 13% a period at 6 mm,
    against under 1% for real water. Whether the water is "too fast" needs
    measured energy decay to compare against.

- **Gate 7 onward:** 3D FieldPlay on the camera match in
  `DESMOS_3D_CAMERA.md`.
