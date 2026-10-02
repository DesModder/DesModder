# Research brief: fluid flow in Vector Tools

_Written 2026-10-02 for a research assistant (GPT) who cannot see the
repository. It comes as a package, and §0 lists what is in it. What I need
back is described in §9._

Rafael asked three things:

1. Can Vector Tools get a fluid-flow section that uses the Navier–Stokes
   equations to give extremely accurate flow?
2. Can that fluid interact with the functions on the graph?
3. Can it be extended to 3D?

This brief gives my answer to each, the evidence behind it (including a
working mock-up and what building it taught me), an architecture to critique,
and the questions where outside research would change what gets built.

---

## 0. What is in the package

| Path                              | What it is                                                                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                       | Reading order and the reply format.                                                                                                           |
| `01_FLUID_RESEARCH_BRIEF.md`      | This document.                                                                                                                                |
| `02_FUTURE_RESEARCH_AND_IDEAS.md` | Related research for later, and ideas for what else to add to Desmos. Lower priority than this brief.                                         |
| `mockup/fluid-tab-mockup.html`    | A working mock-up of the proposed tab. Open it in any browser: the fluid is a real simulation. §4 describes what building it showed.          |
| `mockup/screenshots/`             | The mock-up in each of its scenes, captured in headless Chrome.                                                                               |
| `context/`                        | The project's own docs. `VECTOR_TOOLS_BRIEFING.md` is the one to read first: its §5 (platform constraints) and §10 (rules) bind any proposal. |
| `source/`                         | The code a fluid tab would build on, copied verbatim from the repository. Paths inside it match the repository's `src/`.                      |

---

## 1. Background in one page

**Vector Tools** is a plugin in a personal fork of **DesModder**, a browser
extension that adds features to the **Desmos** graphing calculator. It runs
inside a real desmos.com page with no server. It draws vector fields three ways:

- as **generated Desmos expressions**, which are shareable and still work
  without the extension;
- as **live arrows** on its own WebGL2 canvas over the graph;
- as **GPU particles** advected by RK4, adapted from fieldplay.

A field's components are Desmos LaTeX. The shared compiler, `latexToGLSL.ts`,
turns them into GLSL, and anything the expression list defines (sliders,
functions) becomes a uniform or a GLSL function. A slider drag therefore never
relinks a shader.

The renderers live in `src/field-rendering/`, a neutral package that three
plugins share: Vector Tools, Physics Lab (AP Physics and Calculus) and Audio Lab.
Audio Lab already streams live values back into Desmos variables at 8–12 Hz,
and that is the precedent for writing simulation results into the graph.

The audience is students and teachers in Calculus 3, differential equations,
linear algebra and AP Physics. The house standard is "research-grade in what it
decides, AP-level in how it explains": numbers must be defensible, and the
explanation plain, with depth behind a control.

---

## 2. The short answers

### 2.1 A 2D Navier–Stokes fluid: yes, and most of the machinery exists

What already exists and would carry over:

| Need                                      | Already in the code                                                                                                                                                              |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Float render targets, ping-pong textures  | `FlowRenderer.ts` requires WebGL2 and `EXT_color_buffer_float`, and ping-pongs particle state.                                                                                   |
| Turning a Desmos expression into GPU code | `latexToGLSL.ts`. Comparisons already compile inside piecewise conditions (`\{x^{2}+y^{2}\le1\}` is 1 inside and NaN outside), so an obstacle is a relation away from compiling. |
| Sliders and functions from the graph      | `environment.ts`. Values become uniforms, so an obstacle that a slider resizes needs no relink.                                                                                  |
| The clock                                 | `u_time` already drives time-dependent fields, and it would drive moving obstacles too.                                                                                          |
| A pointer as an input                     | `FieldDisturbances.pointer` in `field.ts`, which Audio Lab uses. Stirring the fluid with the mouse is the same thing.                                                            |
| Drawing a velocity field                  | The particle and arrow renderers. Each needs a new, opt-in field source that samples a velocity texture instead of evaluating `vtField(p)`.                                      |
| Colouring a signed scalar                 | The signed saturating ramp `sign(d)(1 − e^{−\|d\|/scale})`, already planned for divergence and curl on the GPU. Vorticity is the curl.                                           |
| Writing results into the graph            | `DesmosAudioAdapter.ts` creates variables in one `setState` and then streams them with `setExpressions` at a throttled rate, without serialising the graph.                      |

What is missing: a grid-simulation core (state textures, a step scheduler that
is independent of frame rate, measurement reductions), an obstacle-mask entry
point in the compiler, and the panel.

**One structural constraint matters early.** A WebGL texture cannot be shared
between contexts, and the arrows and the particles live in two separate contexts
by design (briefing §5.3). The simulation must therefore live in the context of
whatever samples it — the flow overlay's — or the arrows must read velocity back
from it every frame, which stalls the pipeline.

### 2.2 "Extremely accurate": accurate enough to measure, not CFD-grade

What can honestly be claimed:

- A well-built GPU solver reproduces textbook flows quantitatively at moderate
  Reynolds numbers. Examples are the vortex-shedding frequency of a cylinder,
  its drag to within a few per cent at enough resolution, the parabolic
  Poiseuille profile, the decay rate of a Taylor–Green vortex, and continuity
  and Bernoulli through a constriction. Each of these can be a test with a
  number in it.
- It is **not** CFD-grade. It runs in float32 on a fixed grid, with staircase or
  interpolated boundaries and no turbulence model beyond a subgrid closure. It
  is also 2D, and 2D turbulence is different physics from 3D: energy cascades
  to large scales, not small ones. 2D Navier–Stokes is a legitimate model (soap
  films, stratified layers, the textbook flows above); it just has to be called
  2D.
- The usual browser "fluid" demo is Stam's stable fluids with vorticity
  confinement. It is **not** accurate: semi-Lagrangian advection adds heavy
  numerical viscosity, and vorticity confinement is a cosmetic force. It can sit
  behind a "fast" label, but cannot carry the accuracy claim.

My recommendation is the **lattice Boltzmann method** (D2Q9). It is local and
explicit, so one fragment pass makes one step. Obstacles of any shape reduce to
a per-cell flag. Pressure falls out of the density without a Poisson solve. It
is well validated against the benchmarks in Q4. Its costs are a
compressibility error of order Ma² (it needs a lattice speed of 0.1 or so, and
therefore many steps per frame for a fast flow) and BGK instability at high
Reynolds numbers, which needs MRT, cumulant or regularized collision, or a
subgrid model. Q1 asks whether a projection method would be better.

### 2.3 Interacting with the graph: yes, in both directions

Into the fluid, ordered from simplest to hardest:

1. **Inequality regions as solids.** `x² + y² ≤ r²`, `y < sin x`, an airfoil
   written as an inequality. These compile to GLSL today, give a mask, and, as
   a signed function F, give the distance and normal to the wall too.
2. **Equations as thin walls.** `y = 0.5x` becomes a wall through the distance
   estimate `|F|/|∇F|`.
3. **Moving solids.** A draggable point, a slider or `t` moves the obstacle. The
   wall velocity is the level set's own, `v = −F_t ∇F/|∇F|²`, and one rule
   covers all three. The mock-up does exactly this.
4. **Parametric and polar curves, and polygons.** These are not relations, so
   they cannot be compiled to a mask directly. Either sample them through
   Desmos's own evaluator (`HelperExpression` lists) into a polyline distance
   field, or read Desmos's computed sketch of the curve (see Q2).
5. **Forcing from the user's own vector field.** P and Q drive a closed box as a
   body force. The fluid keeps the curl and turns the divergence into pressure,
   which is the Helmholtz–Hodge decomposition made visible. The mock-up's
   "Source" preset (`P = x − 3, Q = y`) barely moves the fluid at all, and its
   pressure field is the potential. This is a Calculus 3 result that nothing
   else on the platform shows.
6. **Inflow profiles, heat sources and dye sources as expressions.**

Out of the fluid, into the graph:

- drag and lift coefficients, the Strouhal number, a probe's velocity at a
  draggable point, the flux through a user-drawn curve, and speeds and
  pressures at stations, all as live Desmos variables;
- later, the position of a body the fluid pushes, written back into a Desmos
  point (fluid–structure interaction: Q6).

### 2.4 3D: possible with real caveats, and a 2.5D route first

What the platform allows, verified in the code:

- DesModder can read the 3D camera. `Calc.controller.grapher3d.controls.worldRotation3D`
  is a `Matrix3`, `setWorldRotation` can be hooked (the video-creator plugin
  does this), and `is3dProduct()` tells the products apart. Desmos 3D also has
  a **perspective slider**, running from orthographic to full perspective, and
  a matched overlay would need its value. That value is not in our types yet
  (Q11).
- Desmos 3D has a native `vector(start, end)`, so a generated snapshot of a 3D
  velocity field could be ordinary Desmos 3D that survives without the
  extension.
- **No depth compositing.** Our overlay is a separate WebGL context and cannot
  read Desmos's depth buffer. A 3D fluid drawn over Desmos's own surfaces
  cannot be occluded by them correctly unless we draw the obstacles ourselves
  too, or hook Desmos's renderer, which joins the class of breakage in
  briefing §5.4.
- **Cost grows as N³.** 128³ cells with D3Q19 is about 320 MB of float32
  state — too much. 64³–96³, possibly with FP16 storage, is plausible in WebGL2
  (3D textures, rendering to layers). WebGPU compute would be the right tool if
  it is available in the page context (Q10).

The cheaper route that would look spectacular is **2.5D**: the shallow-water
equations over a terrain `z = f(x, y)` that the user types, drawn as a moving
water surface in Desmos 3D. It is a 2D grid, so the cost is the 2D cost; the
physics is accurate for long waves; and it is new on this platform. Q11 asks
about it, with full 3D.

---

## 3. What the user would see

The mock-up (`mockup/fluid-tab-mockup.html`) shows the proposal as a sixth tab,
**Fluid**, after Field, Arrows, Color, Curve and Flow:

- **Simulate**: Off · Wind tunnel · Liquid · Stirred box.
- **Scene** (wind tunnel): Cylinder · Wing · Venturi · Your inequality. A scene
  writes its obstacles into the expression list as ordinary inequalities with
  sliders and a draggable point. Hiding a row (its colour circle) lets the fluid
  through.
- **Fluid**: Reynolds number on a log slider, which states the ν it implies,
  and a subgrid model (Auto · Off · Smagorinsky).
- **Show**: vorticity (curl), speed, pressure or dye, plus the existing
  particle and arrow renderers drawn over the simulated velocity.
- **Measured**: drag, lift and Strouhal number for a body, with literature
  values beside them; speeds and pressure drop against continuity and
  Bernoulli for the Venturi. A checkbox writes these into the graph as
  variables.
- **Liquid**: a free-surface liquid as particles that pours from a draggable
  point onto whatever the graph makes solid.

The tank is fixed in graph coordinates (a dashed box), because a domain that
followed the viewport would change the physics on every pan. That, and the
other open product choices, are in §8.

---

## 4. What building the mock-up established

The mock-up runs the same method a real tab would use, on one CPU thread at
300 × 120 cells. Its value here is the four things that went wrong, because
each one will go wrong on the GPU too.

### 4.1 Measured, after the fixes below

Captured in headless Chrome; every number is from the page's own readout.

| Scene                       | Measured                                                                                      | Reference                                                                                                                                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cylinder, Re 100            | St = 0.197, C_D = 2.1, C_L amplitude ≈ 0.4                                                    | Unconfined: St 0.164 (Williamson 1996), C_D 1.33 (Park, Kwon and Choi 1998). Ours blocks 1/6 of a slip-walled tank, which raises both. Schäfer–Turek 2D-2 (blockage 0.24, no-slip walls) gives St ≈ 0.30 and C_D,max ≈ 3.23. |
| Venturi, Re 300             | throat speed 1.110 u/s against 1.091 from continuity                                          | Continuity holds to 2%.                                                                                                                                                                                                      |
| Venturi, pressure drop      | 0.692 against Bernoulli's 0.496                                                               | The excess is viscous loss, which Bernoulli omits.                                                                                                                                                                           |
| Wing (ellipse, 8°), Re 400  | C_L ≈ 0.73, C_D ≈ 0.34                                                                        | Plausible for a thick ellipse at low Re; no benchmark checked.                                                                                                                                                               |
| Stirred box, gradient force | fastest flow 0.007 u/s                                                                        | Expected ≈ 0: an incompressible fluid cannot respond to a pure gradient force.                                                                                                                                               |
| Throughput                  | 27 MLUPS for the D2Q9 kernel alone (Node, V8); about 380–480 steps/s in the page at 36k cells | A GPU should give 1–3 orders of magnitude more (Q10).                                                                                                                                                                        |

### 4.2 Four failures, and what fixed them

1. **The equilibrium inlet delivered 57% of the nominal speed.** Setting the
   inlet column to `f_eq(ρ = 1, u = U)` prescribes only the incoming half of the
   populations. While the top and bottom were also held at equilibrium, they fed
   in the missing momentum and hid the problem. With slip walls it showed up as
   a Strouhal number a third low (0.130 against 0.197) and a drag half the
   corrected value (1.05 against 2.1). Giving the inlet the inside cell's
   density instead turned the boundary into a resonator: the drag swung between
   0.4 and 3.4. The mock-up now trims the inlet with a slow integrator that holds
   the measured upstream speed at the nominal value. That is a patch, not an
   answer, and Q3 asks for the right inlet.
2. **Slip walls trap sound.** An impulsive start sends a pressure pulse that
   rings between the top and bottom walls in their transverse acoustic modes
   (periods of order H/c_s, about 210 steps here). It barely decays, because
   acoustic damping in LBM is set by the viscosity. The lift signal picked the ringing up and read it as shedding:
   St came out as 0.6 and 1.2. The fixes were to ease the inflow in over 1500
   steps and to low-pass the lift (τ ≈ 150 steps) with hysteresis before
   counting crossings. A non-reflecting boundary or a sponge would be the
   principled fix (Q3).
3. **The symmetric wake is a real solution.** With a quiet start, the cylinder
   at Re 100 held a steady, symmetric, unstable wake for the whole 28-second
   run, about 13,000 steps. (My estimate of the growth rate, about 5·10⁻⁴ per
   step, puts noise of 10⁻³ at 14,000 steps from shedding; that is an estimate,
   not a measurement.) One brief transverse gust at the inlet tips it over. A
   real tab needs a deliberate, documented perturbation, or users will meet a
   cylinder that does not shed.
4. **The Smagorinsky model halves the CPU step rate** and changes nothing at
   Re 100 (St and C_D identical with and without it). The panel therefore
   defaults to **Auto**: on when the lattice relaxation time τ falls below 0.55,
   with Off and Smagorinsky as explicit choices. On a GPU the cost ratio will
   differ, and Q1 asks whether a better collision operator makes the choice
   unnecessary.

Two smaller findings are worth recording:

- **Pressure must be shown as gauge pressure against the tank's mean.** In a
  channel, the whole interior sits above the inlet's pressure, and a colour
  ramp centred on the inlet showed one flat colour.
- **A liquid at full Clavet cohesion clumps into a gel that never levels.** The
  mock-up keeps a quarter of the negative pressure. Real surface tension needs
  a better model (Q8).

---

## 5. Proposed architecture, for critique

```
src/field-rendering/sim/            neutral, shared, opt-in (absent unless used)
  GridSim.ts        state textures, ping-pong, step scheduler (fixed dt,
                    steps per frame from elapsed time, clamped after a stall)
  obstacles.ts      compiled relations → signed function F → mask, link
                    fractions q for interpolated bounce-back, wall velocity
                    from F_t; thin walls from F = 0; sampled curves → SDF
  lbm/D2Q9.ts       collision (BGK/TRT/MRT/cumulant), streaming, boundaries
  measure.ts        GPU reductions: momentum-exchange force, probes, flux
                    through a curve, upstream speed (for the inlet controller)
  scalar.ts         passive scalars: dye, temperature (BFECC/MacCormack)
  VelocityField     an opt-in FlowField source that samples the velocity
                    texture, so FlowRenderer and ArrowRenderer draw the fluid

src/plugins/vector-tools/
  fluid/            config, scenes, panel tab, adapter that writes measured
                    values into the graph (Audio Lab's pattern: one setState,
                    then throttled setExpressions)
```

Rules this must respect:

- **Opt-in in the shader.** Additions to `field-rendering` must be absent from
  the shader when unused, or every other plugin's field gets a new identity and
  relinks (see `FieldDependencies.disturbances` in `source/field-rendering/field.ts`).
- **Settings are versioned.** `VectorFieldConfig` has a `schemaVersion` and a
  normaliser. Key order must match the defaults, or the stored library is
  rewritten on every page load (a trap already hit with `normalizeFlow`).
- **Frame-rate independence.** Briefing §11.1 records that the existing flow is
  frame-rate dependent. A simulation has to step on a fixed dt with a variable
  number of steps per frame.
- **Context loss.** A lost context loses the simulation state. Rebuilding from
  rest is acceptable; pretending nothing happened is not.
- **Evidence is a picture.** The integration harness drives a real Desmos in
  headless Chrome with a software GL renderer (SwiftShader), so every claim
  needs a screenshot. Numeric tests can read state back with `readPixels`, and
  a small CPU reference implementation can run in unit tests.

---

## 6. Platform constraints (condensed; the briefing has the full list)

- Browser extension inside desmos.com: no server, no external service, no WASM
  CAS. A WASM build of a solver would need a strong case; plain WebGL2 is the
  default.
- **Desmos cannot be taught new notation** (briefing §5.1). Everything the user
  types must be ordinary Desmos.
- `setExpression` drops `folderId` and `colorLatex`. Generated sets go through
  `getState`/`setState`. Live values go through throttled `setExpressions`, as
  Audio Lab does.
- `on-evaluator-changes` fires on every frame of an animating slider, so
  anything hung off it must be cheap and coalesce.
- WebGL2 plus `EXT_color_buffer_float` is already required. The plugin already
  holds two contexts on top of Desmos's own, and browsers cap the number of
  contexts per page.
- The flow overlay refuses the 3D product today, because 3D
  `graphpaperBounds` is a rotatable box with no screen-space meaning.
- **A trade-off goes behind a labelled control with a sensible default**, never
  a limit imposed on the user (briefing §10.5).

---

## 7. Research questions

For every question, see §9 for what an answer should contain. Depth on Q1, Q2,
Q3, Q4, Q10 and Q11 matters most.

### Q1. Which solver, for accuracy per millisecond in WebGL2 fragment shaders?

Compare, for 2D incompressible flow at Re 10–5000 on 256²–1024² grids:

- **LBM collision operators**: BGK, TRT (with the "magic" parameter Λ = 3/16 for
  wall placement), MRT (Lallemand–Luo 2000), regularized (Latt–Chopard 2006),
  central-moment and cumulant (Geier et al. 2015, 2017), entropic (Karlin).
  Which is stable at τ → 0.5 without a subgrid model? What does each cost per
  cell in a fragment shader?
- **Projection methods**: MAC grid, MacCormack or BFECC advection, and a
  pressure Poisson solve by Jacobi, red–black Gauss–Seidel, multigrid or PCG,
  all in fragment shaders. How many iterations does a divergence-free result to
  a stated tolerance need, and at what cost?
- **Vorticity–stream function** (2D only), including a spectral or FFT Poisson
  solve in WebGL2.
- **The stable-fluids family**: is there a version accurate enough to quote
  numbers from?

I would like an accuracy-against-cost table on at least the cylinder at Re 100
and the lid-driven cavity at Re 1000, plus your recommendation. Address
float32 versus FP16 storage (Lehmann et al. 2022, the FP16S and FP16C formats
in FluidX3D), the compressibility error and Mach limit, and how the step should
be tied to wall-clock time.

### Q2. Boundaries from implicit functions, moving and thin

- Staircase bounce-back against **interpolated bounce-back** (Bouzidi,
  Firdaouss and Lallemand 2001; Yu, Mei and Shyy 2003), with the link fraction
  q found in-shader by bisection or Newton on the user's F. How accurate is
  each, and is q from F robust where F is not a distance (for example
  `x² + y² − r²`, whose gradient scales with r)?
- **Moving boundaries**: refilling freshly uncovered nodes (Lallemand and Luo
  2003; Caiazzo 2008), the momentum term for a moving wall, and whether the
  level-set velocity `v = −F_t ∇F/|∇F|²` (normal component only) is good
  enough. A rigid translation also has a tangential component, which this
  formula loses.
- Alternatives: immersed boundary (Peskin 2002), Brinkman penalization (Angot
  et al. 1999), and cut cells for a projection solver. Which fits "an arbitrary
  Desmos inequality" best?
- **Thin walls from equations** (`y = f(x)`, `F = 0`): a wall one or two cells
  thick, via `|F|/|∇F|`, leaks or blocks depending on the grid. What is the
  correct treatment for a wall thinner than a cell (link-wise bounce-back
  across the curve)?
- **Curves that are not relations**: parametric `(x(t), y(t))`, polar,
  polygons, and points with a radius. Is there a stable way to read the
  polyline Desmos itself computed for an expression (its "sketch")? DesModder's
  GLesmos plugin hooks Desmos's sketch drawing in 2D (`source/GLesmos/`); is
  that hook usable read-only? Otherwise, sample through `HelperExpression`
  lists and build a distance field on the GPU (jump flooding).
- Undefined values: Desmos draws nothing where F is undefined. The mock-up
  treats undefined as fluid. Is that right?

### Q3. Open boundaries that neither starve nor ring

Section 4.2 has the failures. Please cover:

- Velocity inlets: Zou–He (1997), regularized, non-equilibrium extrapolation
  (Guo et al. 2002), and whether any of them deliver the nominal flux without a
  controller.
- Outlets: zero gradient, convective (Orlanski), pressure (Zou–He), and their
  reflection coefficients.
- **Non-reflecting and absorbing boundaries for LBM**: characteristic
  boundary conditions (Izquierdo and Fueyo 2008; Heubes, Bartel and Ehrhardt
  2014), sponge or absorbing layers (Xu and Sagaut 2013), and perfectly
  matched layers. Which is simplest to make correct in a fragment shader?
- Slip walls (specular reflection, as in the mock-up) against far-field
  boundaries, and how to state the blockage effect on a measured C_D and St,
  for example by blockage correction (Maskell; Allen and Vincenti).
- How to start a flow without an acoustic pulse, and how to trigger shedding
  deterministically and honestly.

### Q4. Verification: exact solutions and benchmarks, with numbers

For each item, give the setup in lattice units, the expected values, the
tolerance achievable at 128², 256², 512² and 1024², and how to measure it from
our side (`readPixels`, a GPU reduction, or a CPU reference run):

- Poiseuille and Couette flow (exact), the Taylor–Green vortex decay
  (exact, `exp(−2νk²t)`), and Kovasznay flow (exact, steady, Re 40);
- lid-driven cavity (Ghia, Ghia and Shin 1982; Erturk 2005) at Re 100, 400,
  1000, 3200 and 10000;
- Schäfer and Turek (1996) 2D-1 (steady, Re 20) and 2D-2 (periodic, Re 100):
  C_D, C_L, St and Δp;
- the unconfined cylinder at Re 40, 100 and 200 (Williamson 1996; Park, Kwon
  and Choi 1998): St, C_D, C_L and the recirculation length;
- the backward-facing step (Armaly et al. 1983) and its reattachment length;
- the Blasius boundary layer;
- Rayleigh–Bénard onset at Ra = 1708, if heat is added (Q9).

The aim is a suite like the project's existing probe suites: dozens of pinned
cases, each with a number and a tolerance.

### Q5. Measurement on the GPU

- Forces by momentum exchange (Ladd 1994; Mei et al. 2002) and the Galilean-
  invariant correction (Wen et al. 2014) for moving bodies.
- Reductions in WebGL2 without compute shaders: ping-pong halving passes,
  `readPixels` latency, and pixel buffer objects with fences to avoid stalls.
- Robust Strouhal detection, the pressure coefficient along a surface,
  circulation and Kutta–Joukowski lift, the stream function (a Poisson solve),
  and the **flux of u through a user-drawn curve** (a Calculus 3 line integral,
  which is a strong teaching link).
- Which of these should be exact identities the panel can state (for example,
  mass conservation through any closed curve) and which are estimates?

### Q6. Two-way coupling with Desmos, including bodies the fluid moves

- What to write back (scalars, lists, a table of a time series), at what rate,
  and how to avoid feedback loops: an obstacle that reads a variable the
  simulation writes.
- **Fluid–structure interaction**: a ball the flow pushes, a pendulum, a hinged
  flap or a falling leaf. Integrate the body with the measured force, write its
  position back into a Desmos point, and handle the added-mass instability for
  light bodies. Which partitioned scheme is stable at our step sizes?
- Should a dragged body follow the pointer exactly (prescribed motion, as in
  the mock-up) or feel the fluid (a spring to the pointer)?

### Q7. Visualization that teaches

- Streamlines, pathlines and streaklines: they coincide only in steady flow,
  and showing all three on an unsteady wake is a classic lesson. How should the
  existing particle renderer offer each?
- Dye with low numerical diffusion (BFECC, MacCormack, or particle-based dye).
- LIC from a velocity texture (briefing §9 Q2), FTLE and Lagrangian coherent
  structures, the Q-criterion and λ₂ in 2D.
- Compositing over Desmos's graph paper without hiding it, in both themes.

### Q8. Liquids with a free surface

- SPH variants (WCSPH, PCISPH, IISPH, DFSPH), position-based fluids (Macklin
  and Müller 2013), Clavet et al. 2005 (which the mock-up uses), FLIP/PIC/APIC
  (Zhu and Bridson 2005; Jiang et al. 2015) and MLS-MPM. Which is accurate,
  stable and implementable in **WebGL2 without compute shaders**? Particle-to-
  grid by additive blending is the obvious route for FLIP/APIC; neighbour
  search by texture sorting is the obvious route for SPH.
- Collisions against the user's F, with friction and without tunnelling.
- Benchmarks: dam break (Martin and Moyce 1952; Koshizuka and Oka 1996),
  hydrostatic pressure, and Torricelli efflux, with numbers.
- Surface rendering: screen-space fluid rendering, metaballs, or a level set.
- Surface tension that does not clump.

### Q9. Heat, buoyancy and transported scalars

Boussinesq convection (Rayleigh–Bénard; a heated obstacle written as an
inequality; a temperature boundary given as a Desmos expression), double-
distribution thermal LBM, the advection–diffusion of a concentration, the Péclet
number, and which of these are worth a preset.

### Q10. Performance engineering in the browser

- D2Q9 layouts: three RGBA32F textures with MRT, against RGBA16F with shifted
  populations; esoteric pull or the AA pattern for in-place streaming.
- Expected MLUPS on integrated GPUs (Intel UHD and Iris Xe, AMD APUs, Apple
  M-series) and mid-range discrete GPUs at 512×256 and 1024×512, and the steps
  per frame that leaves at 60 Hz.
- **WebGPU** in 2026: availability in Chrome, Edge and Firefox (including Linux
  and Android), and whether a content or page script in an MV3 extension can
  use it on desmos.com. Compute shaders would change Q1, Q5, Q8 and Q11.
- The context budget (Desmos's own plus our two), and whether the simulation
  should share the flow overlay's context or take a third.
- Graceful degradation: what to do on a GPU without `EXT_color_buffer_float`,
  or a slow one.

### Q11. 3D, and the 2.5D route

(a) **Desmos 3D's camera.** Beyond `grapher3d.controls.worldRotation3D` and
`setWorldRotation` (see `source/globals/Calc.ts`, `matrix3.ts` and
`source/video-creator/orientation.ts`), where do the perspective setting, the
projection, the 3D viewport bounds and the canvas transform live, and how would
an overlay match Desmos's projection pixel-exactly? Is there any way to
composite with Desmos's depth: a shared canvas, or drawing inside Desmos's
context through a hook as GLesmos does in 2D? How fragile would that be
(briefing §5.4)?

(b) **Solvers.** D3Q19 or D3Q27 LBM in WebGL2 (3D textures, rendering to layers
with `framebufferTextureLayer`, or 2D atlases), memory at 64³, 96³ and 128³ in
FP32 and FP16, and the WebGPU version.

(c) **Visualization.** Volume ray-marching of vorticity or dye, isosurfaces,
streamtubes, and 3D particles. Which reads best over Desmos 3D's own drawing?

(d) **Obstacles** from Desmos 3D relations: implicit surfaces `F(x, y, z) ≤ 0`
and terrains `z ≤ f(x, y)`.

(e) **2.5D**: the shallow-water (Saint-Venant) equations over a terrain
`z = f(x, y)`: well-balanced schemes (lake at rest stays at rest), wet–dry
fronts, a dam break over terrain, and drawing the water surface in Desmos 3D
(an overlay, or a generated Desmos surface fed a coarse height list?).

(f) **Desmos-native output.** Desmos 3D has `vector(start, end)` (Desmos help:
"Vectors and Point Operations"). Could a snapshot of a 3D velocity field be
generated as native vectors, as the 2D generator does with segments, and what
caps would apply?

### Q12. Teaching, and the menu

- What should AP Physics 2 (fluids: continuity, Bernoulli, Torricelli),
  AP Physics C and Calculus 3 students see first? Rank the presets.
- Potential flow against viscous flow (d'Alembert's paradox) as a side-by-side
  scene. Potential flow is exact and can be generated as Desmos expressions
  (`02_FUTURE_RESEARCH_AND_IDEAS.md`, F2).
- A plain-words explanation for each scene, with deeper detail behind an
  explanation-level control (Physics Lab's Simple / With reasons / Proof).
- The menu: a sixth tab against a mode of the Flow tab, in a panel 460 px wide
  with no `<select>` (briefing §9 Q5).

### Q13. Prior art and licences

What exists and what can legally be adapted (the fieldplay port is MIT with its
notice kept; the repository is MIT):

- Pavel Dobryakov's WebGL-Fluid-Simulation (stable fluids);
- Daniel Schroeder's JavaScript LBM (Weber State University);
- WebGPU fluid demos;
- Matthias Müller's Ten Minute Physics (Euler and FLIP in JavaScript);
- GPU Gems chapter 38 (Harris 2004); Stam 1999; Bridson's _Fluid Simulation
  for Computer Graphics_; Krüger et al. 2017, _The Lattice Boltzmann Method_;
- Palabos and OpenLB (reference C++); FluidX3D (OpenCL; check its licence);
- PhET's "Fluid Pressure and Flow".

Also: has the Desmos community built fluid simulations natively, with tickers
and lists? How far did they get?

### Q14. A version that survives without the extension

Briefing §1 commits to output that survives without the extension where it
reasonably can. Could a coarse fluid (for example a 24 × 12 LBM, or a stream-
function solve) run in plain Desmos with a ticker and actions over lists, at a
usable rate? If not, what snapshot is worth generating: streamlines as
polylines, the velocity as generated arrows, or Desmos 3D vectors?

---

## 8. Decisions that belong to Rafael

Flag anything you find that bears on these. Do not settle them.

1. **Tab or mode.** A sixth Fluid tab, as in the mock-up, or a "Flow follows: the
   field / a fluid" switch on the Flow tab.
2. **Which fluids.** Wind tunnel (LBM), liquid (particles), stirred box
   (forcing from P and Q), or a subset. They are different solvers with
   different costs.
3. **Fixed tank or follow the view.** The mock-up uses a fixed tank, because
   following the view changes the physics on every pan.
4. **How loudly to claim accuracy.** For example, show the benchmark comparison
   by default, or only behind the explanation level.
5. **Writing results into the graph.** On by default, or opt-in as in the
   mock-up.
6. **3D first, 2.5D first, or neither yet.**

---

## 9. Format of the reply

One section per question, in order. For each:

1. **The mechanism**, precisely enough to implement: equations, pseudocode
   (GLSL ES 3.00 for anything that runs per cell), the data it needs, and
   stability conditions.
2. **Its scope**: where it works and where it stops (Reynolds range, Mach,
   resolution, geometry).
3. **Numbers**: benchmark values with their sources, and the error you expect
   at our resolutions.
4. **Test cases**: 5–15 per question where it makes sense, including cases that
   must fail or be refused.
5. **References**: papers with years, and open-source code with its licence.
6. **Your verdict**: implement now, later, or never, for this project.

End with **a ranked implementation plan** in gates (gate 0, 1, 2…). Each gate
should be shippable on its own and provable by a screenshot plus a numeric
test, the way the project has built everything else.
