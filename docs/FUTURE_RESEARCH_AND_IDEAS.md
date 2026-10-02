# Future research, and ideas for what else to add to Desmos

_Written 2026-10-02, alongside `VECTOR_TOOLS_FLUID_RESEARCH_BRIEF.md`. That
brief is the priority. This document is the next layer down: research of the
same kind that the project may take on later, followed by my own ideas for the
three plugins. Rafael will see a mock-up of each one he wants to pursue once
the research is back, so a short, honest assessment per item is worth more
than depth on all of them._

Every item has to clear the same rules as everything else here (briefing §10):
it runs in a desmos.com page with no server; it needs no new Desmos notation;
it says which half it belongs to (generated Desmos expressions that survive
without the extension, or our own live canvas); any trade-off sits behind a
labelled control; and it can be shown working in a screenshot.

---

## Part A — Research items related to the fluid work

The common thread is that a fluid solver is a **grid simulation driven by
expressions from the graph**. Once that core exists (obstacles from
inequalities, state textures, a fixed-dt scheduler, GPU reductions, results
written back as Desmos variables), each item below is a new update rule on the
same core rather than a new system.

For each one, please give: the equations and a WebGL2 scheme with its
stability condition, what is exact and what is approximate, two or three
benchmarks with numbers, the cost at 512² and 1024², and a verdict (now, later
or never).

### F1. A shared GPU PDE core: five equations on one engine

| Equation                               | What the user types                                                      | Why it earns a place                                                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Heat / diffusion `u_t = κ∇²u`          | initial temperature `u(x, y)`, hot and cold regions as inequalities      | The gentlest PDE, and the one Calc 3 and DE courses mention first. Exact solutions (Gaussians, Fourier modes) for tests.                               |
| Wave `u_tt = c²∇²u`                    | sources as points, walls and slits as inequalities                       | Interference, diffraction through a slit typed as an inequality, and reflection. AP Physics 2 (waves) and Physics C.                                   |
| Schrödinger `iħψ_t = −(ħ²/2m)∇²ψ + Vψ` | the potential `V(x, y)` as an expression, and a Gaussian wave packet     | Tunnelling through a barrier the user typed, and double-slit interference with \|ψ\|² as the colour. Split-step Fourier or Visscher's explicit scheme. |
| Reaction–diffusion (Gray–Scott)        | feed and kill rates as sliders, seeds as inequalities                    | Turing patterns, and the most beautiful picture per line of code available.                                                                            |
| Laplace / Poisson (electrostatics)     | conductors as inequalities with a potential each, charge density ρ(x, y) | The potential, `E = −∇V` drawn by the existing arrows and flow, and capacitance as a measured number. AP Physics C: E&M. Needs a multigrid solve.      |

Questions: which explicit schemes are stable at frame rate (CFL for the wave
equation; Visscher's staggered scheme for Schrödinger, which conserves
probability to second order); whether multigrid in fragment shaders reaches
interactive rates for Poisson at 512²; and what a single "update rule" interface
looks like so the five share boundaries, measurement and colouring.

### F2. Potential flow and conformal maps, generated as Desmos expressions

Ideal (inviscid, irrotational) flow has a complex potential `w(z) = φ + iψ`. Its
streamlines are the level curves `ψ = c`, and **those are implicit curves
Desmos already draws exactly**. So this is a generated-expression feature that
survives without the extension. Uniform flow plus a doublet gives flow past a
cylinder; adding a vortex gives lift (Kutta–Joukowski); the Joukowski map gives
an airfoil with the Kutta condition.

It pairs with the fluid tab: the same cylinder, ideal against viscous, side by
side, is d'Alembert's paradox in one picture.

Questions: which families of `w(z)` can be expanded into real Desmos expressions
for `ψ(x, y)` without a complex-arithmetic evaluator (Desmos now has a complex
mode; does it help?); how to place the stagnation points and the Kutta
condition automatically; and how to draw a family of level curves cheaply (one
expression with a list of constants).

### F3. Complex functions: domain colouring and the Pólya field

The Pólya field (`conj f(z)` drawn as a vector field) is already on the agreed
list of field sources. Domain colouring (hue for the argument, brightness for
the modulus) is its sibling on the GPU. Both need complex arithmetic in
`latexToGLSL`. Questions: which colouring scheme is perceptually honest
(Wegert's _Visual Complex Functions_; the phase-portrait conventions); how to
compile complex expressions (a `vec2` type through the compiler); and branch
cuts for `ln`, `√` and powers.

### F4. Dynamical systems beyond the phase portrait

The roadmap already has nullclines, equilibria and their classification. Past
those:

- limit cycles, found and drawn;
- Poincaré sections for forced systems;
- bifurcation diagrams over a slider;
- basins of attraction coloured on the GPU;
- Lyapunov exponents;
- **FTLE fields and Lagrangian coherent structures** for time-dependent fields.
  The particle advection already exists, so FTLE is a flow-map gradient away.
  This is the research-grade tool oceanographers use, and nothing else on the
  platform has it.

Questions: robust limit-cycle detection; the FTLE computation and its
integration time; and how to certify an equilibrium's type with exact
arithmetic where the Jacobian allows it (the "research-grade" standard).

### F5. The theorems of Calculus 3, live

Green's theorem: the circulation of F around a closed curve the user drags,
against the double integral of the curl inside it, both computed live and shown
to agree. The same for flux against divergence. Line integrals and work along a
curve, with path independence shown for a conservative field. Stokes and the
divergence theorem in 3D (F6).

The exact half exists: `symbolic.ts` gives the curl and divergence exactly, and
Physics Lab's quadrature gives certified numeric integrals. Questions: how to
let the user draw the curve (a parametric expression, a polygon of draggable
points, or a freehand stroke); which integrals can be exact; and how a teacher
would want the comparison presented.

### F6. Vector fields in Desmos 3D

Desmos 3D has a native `vector(a, b)`, so a generated 3D field could be
ordinary Desmos 3D that survives without the extension. Live 3D arrows and
particles would need the camera matching in the fluid brief, Q11. Questions:
the expression cost of n³ native vectors (what cap, and does a list of vectors
in one expression work?); seeding 3D streamlines; and divergence and curl in 3D
(the curl is a vector, so how is it drawn?).

### F7. Transformations and the Jacobian

The briefing's open design question: draw the image of the Cartesian grid under
a map `(X(x, y), Y(x, y))` as an overlay, coloured by the Jacobian determinant
(area scaling, and orientation flips where it is negative). Linear maps
`V = Ax` with eigenvectors, the image of the unit circle, and the SVD ellipse.
Questions: the overlay design that makes a transformation legible (prior art:
3Blue1Brown's linear-algebra visuals, Grapher); and generating the grid image
as Desmos parametric curves so it survives.

### F8. Electromagnetism

Point charges and line currents from a table in the graph: E and B fields,
Biot–Savart, equipotentials as implicit curves, and Faraday's law with a
time-varying B. It reuses the agreed "point sources" field source. Questions:
which configurations have closed-form fields (generated) against which need the
Poisson solver (F1); and what AP Physics C: E&M actually asks students to see.

### F9. Gravity and orbits

N-body with a symplectic integrator and an energy readout; the restricted
three-body problem, whose zero-velocity curves (from the Jacobi constant) are
**implicit curves Desmos draws exactly**, with the five Lagrange points found
and classified. Questions: integrators that conserve energy visibly over long
runs (leapfrog, Yoshida, Wisdom–Holman); and close encounters (regularisation).

### F10. The fluid and the sound: Aeolian tones

A cylinder in a wind sheds vortices at `f = St·U/D`, and that is the tone a
wire sings in the wind. With Audio Lab beside the fluid tab, the measured
shedding frequency could be **played**, scaled into the audible range, so that
dragging the Reynolds number changes the pitch. It is a real physical link
between two plugins that exist. Questions: the scaling that stays honest
(say so on screen); and whether it can go through a neutral shared module
without either plugin depending on the other (the project's separation rule).

---

## Part B — My own ideas for what else to add to Desmos

Ranked by payoff for effort as I see it. "Half" is generated (survives without
the extension), live (our canvas), or panel (Physics Lab-style analysis).

| #   | Idea                                                         | Half              | What it is, and why                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------ | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | **Settings that travel with the graph**                      | generated         | Vector Tools keeps a field's configuration in plugin settings, so a shared graph link loses the live look (palette, flow, gallery preset). Serialising the configuration into a hidden, namespaced note or folder in the graph state would let a teacher share a link that opens the same picture for every student with the extension. Cheap, and it multiplies the value of everything else. |
| B2  | **Certified plotting: "is this graph right?"**               | live + panel      | Desmos samples, so it occasionally draws a false spike at an asymptote or misses a narrow feature. Interval arithmetic over the same compiled expression can certify where a curve is and is not, and flag the places where the picture is wrong. Research-grade in exactly the house sense, and nothing like it exists for Desmos.                                                            |
| B3  | **Lagrange multipliers, found and proved**                   | generated + panel | For f(x, y) on g(x, y) = c, draw the level curves, the constraint, and the points where ∇f ∥ ∇g, solved exactly where the algebra allows. A Calculus 3 topic every student finds hard to see. It reuses the differentiator and Physics Lab's exact layer.                                                                                                                                      |
| B4  | **Optimisation paths**                                       | live              | Gradient descent, momentum, Newton and Adam on f(x, y) over its level curves, with the step size on a slider and divergence shown honestly. A bridge from Calculus 3 to machine learning that students ask about.                                                                                                                                                                              |
| B5  | **Fourier series tab (Physics Lab)**                         | generated + panel | The coefficients of a piecewise function exactly where possible, the partial sum as a Desmos expression, the Gibbs overshoot measured (≈ 8.95% of the jump), and the link to Audio Lab's spectrum. AP Physics 2 waves and every DE course.                                                                                                                                                     |
| B6  | **Random walks and diffusion, side by side**                 | live              | Thousands of random walkers against the heat equation in the same tank (F1), converging to the same Gaussian. The central limit theorem made visible. AP Statistics as well as physics.                                                                                                                                                                                                        |
| B7  | **Newton's-method basins and fractals from your expression** | live              | Colour each starting point by which root Newton's method finds for the user's polynomial. It ties to root-finding in calculus, and also gives Mandelbrot and Julia sets for any iteration typed in Desmos. Cheap on the GPU through `latexToGLSL`.                                                                                                                                             |
| B8  | **Cursor probe**                                             | live              | Already on the agreed list: P, Q, \|V\|, angle, divergence and curl at the pointer, through Desmos's own evaluator. In the fluid tab it would read velocity, pressure and vorticity.                                                                                                                                                                                                           |
| B9  | **Video and GIF export that includes our canvases**          | live              | DesModder's video creator captures Desmos's own screenshot, which leaves our overlays out. Compositing them in would let teachers export the fluid, the flow and the arrows as a clip. High value for anyone making class material.                                                                                                                                                            |
| B10 | **Sonification for accessibility**                           | live              | Pitch for the speed under the cursor, pan for direction, and a click for a critical point. Desmos already takes accessibility seriously (audio trace, Braille), and vector fields have no audio story at all. It reuses Audio Lab's synthesis side.                                                                                                                                            |
| B11 | **Units that carry through**                                 | panel             | Already on the Physics Lab roadmap. With a fluid tab it becomes concrete: say the tank is metres and the fluid is water, and get ν, Re and the drag in newtons.                                                                                                                                                                                                                                |
| B12 | **Practice problems from the engines**                       | panel             | Already on the Physics Lab roadmap. The fluid version would be "predict the shedding frequency, then run it", with the simulation as the answer key.                                                                                                                                                                                                                                           |

Questions for B1–B12, briefly each: prior art and whether it is already done
well elsewhere; the hardest technical risk; and whether the item clears the
rules at the top of this document.

---

## Part C — Questions about the platform itself

These would change many items at once:

1. **Has the Desmos public API changed in 2025–2026** in ways that relax
   briefing §5.1: folders and colours through `setExpression`, tickers, an
   official way to read a curve's computed sketch, or 3D camera access?
2. **What do Desmos's terms say** about extensions that draw over the
   calculator and write into graphs? This matters most for anything that would
   be shared publicly.
3. **WebGPU in an MV3 extension** on desmos.com, across Chrome, Edge and
   Firefox, in 2026.
4. **Desmos 3D's renderer.** Is it three.js or its own? Is there a scene graph
   an extension could add objects to, so that depth would be shared? How often
   does it change?
