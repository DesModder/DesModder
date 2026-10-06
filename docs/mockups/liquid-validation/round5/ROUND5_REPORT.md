# Vector Tools Fluid — Round 5 report

## Executive decision

The present liquid has **two different errors that should not be tuned with one knob**:

1. the mass-ledger free surface is too diffusive at 6–8 mm, which overdamps small waves and destroys marginally resolved gas regions; and
2. a 2-D slice cannot contain the full 3-D dissipation, spanwise wall layers, bubble-cloud physics, or spray cascade of real water.

The experiments in this round rule out an unconditional “make it more viscous / add more drag” fix. The matched quasi-2-D sloshing oracle already decays at `delta = 0.128 1/s`, while Bäuerlein & Avila measure `0.065 +/- 0.015 1/s`. More damping would move the linear regime in the wrong direction. Increasing Smagorinsky or adding strong quadratic drag can make a violent dam break look calmer, but it also slows the validated front.

The recommended order is therefore:

1. **Replace the mass-ledger fill-level advection with a true geometric VOF/PLIC advection pass.** Do not replace the Schwarzmeier free-surface PDF boundary; keep variant (iii), which is already the best-supported boundary variant.
2. **Do not ship the finite-difference curvature prototype as quantitative surface tension.** It is conservative and useful as a research probe, but its drop-oscillation period is badly wrong. Implement a higher-quality curvature reconstruction (least-squares or height-function-like) before enabling water surface tension.
3. **Keep Smagorinsky `C_s = 0.1`.** Do not use a larger value as the missing-3-D model.
4. **Do not add global calibrated drag now.** If a simulation is explicitly a slice of a finite-depth tank, a physical spanwise laminar term `12 nu / b^2` is defensible, but it is too weak to fix violent settling and the current numerical wave damping already exceeds experiment.
5. **Move unresolved bubbles and spray to a conservative Eulerian–Lagrangian representation instead of forcing 1–10-cell fragments through the free-surface solver.** For gas, only do this with a volume/mass accounting rule; for spray, the ledger coupling is straightforward.
6. **Keep the current slip/log-law wall only for resolved attached flow.** A one-cell liquid film is below the wall model’s domain of validity and below the free-surface method’s resolution. Do not tune the log law to make such a film “right.”

All Round-5 solver additions are opt-in. The regression test proves that with the new switches off the old dam oracle remains unchanged.

---

## Files added or changed

### `liquid-validation/liquid.cjs`

Added, opt-in:

- conservative PLIC face-fraction geometry for a research mass-exchange variant;
- physical slice-drag conversion from SI parameters;
- optional spanwise linear and quadratic momentum sinks;
- optional capillary pressure jump at the free surface;
- interface-normal and curvature fields used by the capillary oracle.

Exports added:

- `plicFaceFractions`
- `physicalSliceDrag`

### New scripts

- `capillary.cjs` — static-drop spurious-current and 2-D drop-oscillation oracle;
- `sloshing.cjs` — quasi-2-D sloshing oracle matched to Bäuerlein & Avila;
- `round5.test.cjs` — five automated regression/conservation tests.

### Existing scripts extended

- `wave.cjs` — `FLUX`, `SIGMA`, `B`, `CQ`, diagnostic sampling;
- `rise.cjs` — surface tension, slice drag, fitted rise speed;
- `physics.cjs` — corrected `SMAG` plumbing, drag/capillary options, 1.5–2.0 s mean kinetic energy.

Patch files are in `research/*_round5.patch`.

---

# A. Measured data to compare against

## A1. Closed-tank dam break / post-impact settling

### Lobovský et al. (2014)

Source: L. Lobovský et al., _Experimental investigation of dynamic pressure loads during dam break_, Journal of Fluids and Structures 48 (2014) 407–434, DOI `10.1016/j.jfluidstructs.2014.03.009`.

What is available:

- dry-bed dam break with `H = 0.30 m` and `0.60 m`;
- free-surface/wave-height histories;
- downstream-wall pressure histories;
- repeated tests and statistical pressure data;
- figure curves supplied as ASCII/MATLAB plus videos in the supplementary package.

The paper explicitly advertises the supplementary wave-height and pressure data as CFD-validation material. The legacy supplementary endpoint is `canal.etsin.upm.es/papers/lobovskyetaljfs2014/`; it is still cited by later work, but it was not directly retrievable through the current web tool in this run.

**2-D use:** wave-front motion, early free-surface elevations, and the first far-wall impact are reasonable 2-D comparisons. Later impact/splash topology and pressure peaks become increasingly three-dimensional and stochastic, so they should not be used to fit a single 2-D damping constant.

### SPHERIC Test 02 / Kleefsman et al. (2005)

SPHERIC Test 02 distributes the 3-D MARIN dam-break geometry and an experimental spreadsheet (`test_case_2_exp_data.xls`). Kleefsman’s tank is a fully 3-D obstacle-impact problem with wave probes and pressure sensors.

**2-D use:** the early, approximately center-plane propagation can be a qualitative sanity check, but the obstacle interaction and post-impact decay are fundamentally 3-D. Do **not** fit the 2-D slice to the late Kleefsman signal.

### Koshizuka & Oka (1996)

The classic MPS water-column collapse is useful as a free-surface fragmentation benchmark and was originally compared to experiment. It is not a strong modern source for a calibrated multi-second kinetic-energy decay curve.

### What was not found

This round did **not** find a clean experiment reporting the liquid’s total kinetic energy versus time for a closed, obstacle-free dam-break tank in exactly the form needed to calibrate `physics.cjs`. The best usable measured quantities are therefore wave gauges and wall-pressure/free-surface histories, not a direct experimental `J/m` curve.

**Consequence:** the oracle’s kinetic energy is a diagnostic, not yet a quantity with a direct experimental target.

---

## A2. Rectangular-tank sloshing

Best quantitative target found: B. Bäuerlein & K. Avila, _Phase lag predicts nonlinear response maxima in liquid-sloshing experiments_, JFM 925 (2021), DOI `10.1017/jfm.2021.576`.

Geometry:

- width `w = 0.500 m`;
- span/depth `l = 0.050 m`;
- water height `h = 0.400 m`;
- explicitly described as quasi-two-dimensional.

Measured free-decay values:

- `delta_1 = 0.065 +/- 0.015 s^-1`;
- dimensionless damping `gamma_1 = 8.4e-3`;
- `omega_1,exp = 7.86 +/- 0.10 s^-1`;
- potential-theory `omega_1 = 7.800 s^-1`;
- Keulegan laminar boundary-layer prediction `delta_1 = 0.0434 s^-1`, about 1.5 times smaller than experiment.

For a strongly nonlinear asymmetric wave in their Fig. 6:

- crest decay `delta_a = 0.069 s^-1`;
- trough decay `delta_b = 0.060 s^-1`;
- center-of-mass decay `delta = 0.064 s^-1`.

This is the strongest Round-5 damping benchmark because the tank is intentionally narrow and quasi-2-D.

### Oracle comparison

`sloshing.cjs`, `dx = 6.25 mm`:

- theory period `0.806 s`;
- measured oracle period `0.821 s`;
- oracle decay `delta = 0.128 s^-1`;
- experimental decay `0.065 +/- 0.015 s^-1`;
- oracle loss per period `10.0%`;
- amplitudes `2.00, 1.90, 1.80 cm`.

The current solver is therefore already about **2x too dissipative** in a directly comparable quasi-2-D small-wave experiment.

---

## A3. Jet/tap pouring into a pool

Useful experimental literature exists for **plunging round jets**, but this is intrinsically 3-D.

- Qu et al. (2013), DOI `10.1016/j.expthermflusci.2012.05.013`: vertical round water jet, `D = 6 mm`, measures entrainment regimes and bubble-plume penetration depth versus jet impact velocity and fall length.
- Guyot, Cartellier & Matas (2020), DOI `10.1103/PhysRevLett.124.194503`: bubble-cloud penetration measurements spanning jet diameters `0.3–210 mm` and fall heights `0.2–9.5 m`.

**2-D use:** qualitative only: whether a plunging jet entrains air, whether the gas cloud reaches the right order of depth, and whether bubbles persist after impact. A 2-D free-surface slice cannot quantitatively reproduce a circular jet’s entrainment rate, bubble-size distribution, or plume residence time.

This round did **not** identify a suitable quasi-2-D tap-shutoff experiment with a published pool-settling time history. Therefore A3 should not be used to fit a 2-D drag coefficient.

---

## A4. Rising planar bubbles

Collins (1965) remains the correct comparison for the present 2-D bubble oracle. Later literature summarizes his correlation for a two-dimensional air bubble in water as

`V_B = 0.58 sqrt(g d_B)`

where `d_B` is the circle-area-equivalent planar bubble diameter.

For `d = 6.3 cm`, the target is about `0.46 m/s`.

Current oracle at 160 cells (`dx = 6.25 mm`):

- no surface tension: fitted rise `0.17 m/s`;
- with `sigma = 0.072 N/m`: fitted rise `0.15 m/s`.

The bubble is only about ten cells across, so this is a marginally resolved interface problem, not evidence that physical water needs more viscosity.

---

# B. The 2-D slice of 3-D water

## What the evidence says

Published 2-D / quasi-2-D free-surface work does not support one universal artificial dissipation constant. The physically interpretable missing terms are wall/boundary-layer losses for a finite span and unresolved turbulent dissipation in violent flow. The Bäuerlein–Avila experiment is particularly useful because it separates these ideas: the classical laminar wall-layer estimate gives `0.0434 s^-1`, while the experiment gives `0.065 +/- 0.015 s^-1`, leaving additional dissipation not captured by that laminar theory.

However, the current oracle gives `0.128 s^-1` before adding any spanwise correction. A fit to the experiment would require _negative_ extra damping. That makes a global 3-D sink indefensible at this stage.

## Recommended model

Implement the **physical spanwise parallel-plate term** as an optional geometry correction only when a finite physical span `b` is declared:

`a_span = -(12 nu / b^2) u`.

The CPU helper converts it to lattice units. If later evidence requires a high-Re extension, add it as a separately validated turbulent-wall contribution, not as a free visual knob.

Do **not** enable an unconditional quadratic drag by default.

### Calibration result now

For the present interface, the calibrated extra global damping is effectively **zero**. The reason is not that real 3-D dissipation is zero; it is that numerical interface diffusion is currently larger than the missing physical damping in the best quasi-2-D experiment.

### Dam-break before/after at NX=80

Baseline (`C_s=0.1`, no extra drag):

- front mean error `+0.6%`;
- late speed `1.28 sqrt(gH)` vs Martin–Moyce `1.32`;
- mean kinetic energy from 1.5–2.0 s `8.43 J/m`;
- KE at 2.0 s `6.12 J/m`.

Larger Smagorinsky (`C_s=0.2`):

- front mean `-0.3%`;
- late speed `1.19` vs `1.32`;
- mean KE `8.43 J/m`;
- KE at 2.0 s `4.83 J/m`.

Quadratic drag `C_q=0.2 1/m`:

- front mean `-0.7%`;
- late speed `1.28`;
- mean KE `8.82 J/m`;
- KE at 2.0 s `4.07 J/m`.

Quadratic drag `C_q=1 1/m`:

- front mean `-4.5%`;
- late speed `1.09`;
- mean KE `3.45 J/m`;
- KE at 2.0 s `1.45 J/m`.

The exact-time KE is phase-sensitive: `C_q=0.2` lowers the 2.0 s value while the 1.5–2.0 s mean increases. This is why it is not a safe calibration target.

Physical laminar span `b=0.15 m` changes the dam weakly: late speed remains `1.28`; mean KE `8.54 J/m`; KE(2s) `6.05 J/m`. At `b=0.05 m`, the front still remains `1.28`, but phase changes make the short-window KE metric rise rather than provide a clean damping calibration.

### Hydrostatics

The added drag is exactly zero when `u=0`, so it cannot change the static hydrostatic solution algebraically. A separate Round-5 hydrostatic rerun was **not** performed. Default-feature regression is pinned by the automated test.

---

# C. Bubbles and spray at 6–8 mm

## C1. Why the 10-cell bubble fails

The evidence points to a combination of **resolution + first-order free-surface transport + missing/poorly resolved capillarity**, not to insufficient molecular viscosity.

Schwarzmeier & Rüde (2023) show that no tested free-surface PDF reconstruction perfectly balances liquid/gas pressure forces, although “only missing PDFs” (variant iii) is the most accurate overall. The present code already uses the equivalent of that preferred variant, so switching boundary variants is not a likely solution.

Their standing-wave study also states that FSLBM requires the wave amplitude to span at least one and preferably multiple interface cells; meaningful oscillations disappear as resolution is reduced. That is directly consistent with the present bubble/wave failure mode.

## C2. Surface tension

FSLBM commonly adds capillarity as a Young–Laplace pressure jump at the free boundary:

`p_interface = p_gas + sigma kappa`.

Bogner, Rüde & Harting (2016) specifically study curvature reconstructed from the VOF fill level and show that curvature error produces spurious currents. They also identify simplified interface advection as a major limitation.

### Round-5 prototype

The CPU oracle adds the pressure jump and estimates curvature by finite differences of normalized fill-level gradients.

Static `R=4 cm` water drop, `dx=6.25 mm`:

- liquid mass drift: `-6.64e-16`;
- peak speed during 0.5 s: `0.0087 m/s`;
- final-frame maximum speed: `0.0021 m/s`.

The pressure force is therefore stable enough to run and conservative, but not quiescent.

### Drop oscillation

Analytical 2-D mode-2 period for `R=4 cm`, water, `sigma=0.072 N/m`:

- theory `T = 2.418 s`.

Completed oracle runs before the final diagnostic-label patch:

- `dx=6.25 mm`: measured `T = 1.315 s`;
- `dx=3.125 mm`: measured `T = 1.478 s`.

The period error remains very large even when the grid is doubled. This rules out the present finite-difference curvature as a quantitatively correct shipping model.

### Bubble rise with capillarity

At `dx=6.25 mm`, `d=6.3 cm`:

- no surface tension: `0.17 m/s`, gas falls to `16%` by 0.40 s;
- `sigma=0.072`: `0.15 m/s`, gas is `36%` at 0.40 s.

Surface tension improves cohesion/retention but does **not** recover Collins’ rise speed and slightly reduces it in this oracle.

### Recommendation

Do not ship this curvature estimator. Next implementation should be a higher-quality local curvature reconstruction (least-squares as in Bogner et al., or a robust height-function-like estimator where orientation allows it), then repeat:

1. static-drop peak spurious speed;
2. 2-D mode-2 period;
3. 6.3 cm bubble rise and gas retention.

Only enable physical `sigma` if those tests converge with refinement.

## C3. Subgrid bubbles

Yes: once a gas region is materially smaller than the resolution needed to maintain a coherent interface, a point/parcel model is preferable to pretending it is resolved.

A conservative algorithm for this solver:

1. Label enclosed gas regions as today.
2. Compute each region’s gas area/volume, centroid, gas amount `pV`, and mean liquid velocity around it.
3. Use hysteresis, e.g. convert to subgrid when equivalent diameter falls below ~`16 dx`; do not re-resolve until it grows above ~`24 dx`. The exact threshold must be calibrated, but the current ten-cell case is demonstrably below the reliable range.
4. The Lagrangian parcel carries gas amount/volume, position and velocity. Its slip/rise law can use the planar Collins relation in 2-D validation cases and a separate 3-D correlation when the rendering semantics are 3-D.
5. A point bubble cannot simply replace a finite gas hole without accounting for displaced liquid. To conserve the liquid ledger, filling the old gas footprint must withdraw the same amount of liquid volume from the connected open free surface. This lowers the resolved free surface by the now-unresolved gas volume. Therefore this zero-volume point approximation should be limited to a small total hidden-gas fraction.
6. If parcels coalesce until their represented volume is no longer negligible, re-inflate a resolved gas region by removing exactly the corresponding liquid mass through the ledger.
7. Popping at the open surface removes the gas parcel; no liquid mass is created or destroyed.

For large concentrations of subgrid gas, a volume-displacing Eulerian–Lagrangian/VANS coupling is required; a purely visual particle cloud is not physically conservative in volume.

This direction is supported by Eulerian–Lagrangian LBM literature in which particles smaller than the grid are tracked as Lagrangian points with two-way coupling; the exact gas-bubble closure still needs dedicated validation.

## C4. Spray

Spray is easier to make conservative than subgrid gas.

For a disconnected liquid component below a small resolved-size threshold (start testing around 1–4 cells, not 20):

1. remove its exact liquid mass/momentum from the Eulerian ledger;
2. create a Lagrangian droplet carrying that mass, momentum and radius;
3. integrate gravity and optional aerodynamic drag;
4. on collision with resolved liquid/wall, deposit mass and momentum through `EXT_float_blend` into the ledger/interface neighborhood;
5. coalesce particles when appropriate, and convert back to resolved liquid when the represented footprint becomes large enough.

This is preferable to the present Mach-0.25 cap because the cap changes the motion of a numerically unresolved object without changing its representation.

---

# D. Standing-wave damping

Production-resolution rerun (`NX=160`, 6.25 mm, first measured period):

Baseline mass-ledger exchange:

- theory `T = 0.819 s`;
- measured `T = 0.825 s`;
- damping `8.3%/period`;
- half-period amplitudes `2.00, 1.91, 1.83 cm`.

Research PLIC-face-weight variant (completed earlier in this Round-5 session; the final rerun exceeded the 300 s CPU batch limit):

- measured `T = 0.825 s`;
- damping `8.9%/period`;
- amplitudes `2.00, 1.92, 1.82 cm`.

Therefore replacing the arithmetic interface-interface flux weight with a geometric face fraction **inside the old ledger formula is not a PLIC solution** and does not improve the wave.

This is consistent with the literature. Janßen, Krafczyk and coauthors’ successful hybrid LBM–VOF method does not merely change the local mass weight: it solves a separate finite-volume VOF advection equation and uses a piecewise-linear interface reconstruction (PLIC). It was validated on dam breaks, a free-falling jet and an overturning breaker.

### Decision

- Keep Schwarzmeier variant (iii); it is already the best tested PDF boundary.
- Do not tune a different arithmetic/geometric ledger weight.
- The next serious wave fix is a **true geometric VOF advection pass** with PLIC reconstruction and conservative fluxing.

This is the highest-priority solver change from Round 5.

---

# E. Wall model

Malaspinas & Sagaut (2014) validate an LBM-LES wall model for **turbulent attached channel flow**, using an analytic first-cell profile or turbulent-boundary-layer equations. They report good skin-friction accuracy even on very coarse channel grids, but that is not validation for a one-cell free-surface film or a moving contact line.

The present log-law wall therefore has a defensible pedigree for resolved attached turbulent flow, but its domain of validity does not include:

- a one-cell film;
- a contact line;
- corners with ambiguous normals;
- diagonal/stair-step walls;
- laminar film flow whose entire thickness lies inside the nominal wall-model cell.

### Oracle

`NX=160`, nominal 1.5 cm film = 2 cells:

- bounce-back: `38%` of free-fall distance by 0.25 s;
- slip + log wall: `80%`;
- same two-cell slab in open air: `89%`.

So the wall still costs roughly 9 percentage points relative to the already under-resolved free slab.

One-cell `6.25 mm` film:

- slip + log wall: `60%` of free fall;
- same one-cell slab in open air: `74%`.

The one-cell free slab is itself badly under-resolved, so there is no meaningful wall-function coefficient that can make this regime physically correct.

### Recommendation

- Keep the slip/log wall for resolved wall-bounded liquid.
- For film thickness below ~3 cells, flag the result as under-resolved and use a separate thin-film model if this visual regime is important.
- Do not “fix” thin films by strengthening or weakening the turbulent log law.
- At contact lines, a dedicated wetting/contact-angle model is needed if physical adhesion is desired; bounce-back fallback is only a stability choice.

---

# F. WebGL2 cost and implementation priority

These are **operation/pass estimates**, not Iris-Xe timings. No GPU code was ported or timed in Round 5.

| Change                                    |                                                                                       Approximate extra work | Expected budget risk | Recommendation                                            |
| ----------------------------------------- | -----------------------------------------------------------------------------------------------------------: | -------------------: | --------------------------------------------------------- |
| Physical linear span drag                 |                                                a few scalar ops, no new neighbors if velocity already loaded |             very low | keep available, default off unless `b` is physical        |
| Quadratic span drag                       |                                                                             one speed magnitude + scalar ops |             very low | research only; do not default on                          |
| Current FD curvature                      | normal stencil + curvature stencil; effectively one/two extra interface passes and multiple neighbor fetches |               medium | do not ship due accuracy failure                          |
| Least-squares / height-function curvature |                                   larger local stencil and reconstruction; at least one extra interface pass |          medium–high | next capillary prototype after PLIC                       |
| True VOF/PLIC advection                   |                 reconstruction + conservative face fluxes; likely one or more added full-grid texture passes |  high but high value | highest priority; profile on Iris Xe                      |
| Lagrangian spray                          |                                               particle update plus blended deposition only when spray exists |      scene-dependent | recommended                                               |
| Subgrid bubbles                           |                         region-to-particle conversion + particle update; gas volume coupling adds complexity |      scene-dependent | recommended after conservative volume rule is implemented |

The current step budget is ~100 µs without bubbles and ~125 µs with the existing gas update. The true PLIC advection is the only recommendation likely to threaten the 140 µs target materially, so it should be implemented first in the CPU oracle and then GPU-profiled before additional curvature passes are added.

---

# Automated tests

`node --test round5.test.cjs` passes 5/5:

1. PLIC half-cell face geometry;
2. SI-to-lattice physical slice-drag conversion;
3. Round-5 features are opt-in and default dam output is unchanged;
4. PLIC-weight mass exchange remains conservative to roundoff;
5. capillary pressure jump remains finite and mass-conservative in the coarse-drop check.

Latest run: 5 passed, 0 failed.

---

# What was not completed / not claimed

- No WebGL2 implementation or Iris-Xe timing of Round-5 features was performed.
- No direct GPU `liquid-mockup.html` port was made.
- The long production `FLUX=plic` wave rerun exceeded the 300 s CPU batch limit; the earlier completed run is reported and the timeout is logged.
- The 3 s capillary oscillation rerun also exceeded the current batch window. Period values reported above are from completed runs earlier in this Round-5 session; the later diagnostic patch only corrected labels/peak tracking, not the solver.
- No separate hydrostatic test was rerun after adding optional drag; the drag term is zero for `u=0`, and the automated regression proves default behavior is unchanged.
- No quantitative 2-D calibration was made to plunging-jet air entrainment because the available experiments are circular/3-D.
- No direct experimental total-kinetic-energy trace was found for the exact closed-tank dam-break geometry, so `J/m` remains a solver diagnostic rather than an experimental goodness metric.

---

# Sources most directly used

- Schwarzmeier, C. & Rüde, U. (2023), _Analysis and comparison of boundary condition variants in the free-surface lattice Boltzmann method_, DOI `10.1002/fld.5173`.
- Bogner, S., Rüde, U. & Harting, J. (2016), _Curvature estimation from a volume-of-fluid indicator function for the simulation of surface tension and wetting with a free-surface lattice Boltzmann method_, DOI `10.1103/PhysRevE.93.043302`.
- Janßen, C. F., Grilli, S. T. & Krafczyk, M. (2013), _On enhanced non-linear free surface flow simulations with a hybrid LBM–VOF model_, DOI `10.1016/j.camwa.2012.05.012`.
- Lobovský, L. et al. (2014), _Experimental investigation of dynamic pressure loads during dam break_, DOI `10.1016/j.jfluidstructs.2014.03.009`.
- Bäuerlein, B. & Avila, K. (2021), _Phase lag predicts nonlinear response maxima in liquid-sloshing experiments_, DOI `10.1017/jfm.2021.576`.
- Malaspinas, O. & Sagaut, P. (2014), _Wall model for large-eddy simulation based on the lattice Boltzmann method_, DOI `10.1016/j.jcp.2014.06.020`.
- Qu, X. et al. (2013), _Experimental characterization of air-entrainment in a plunging jet_, DOI `10.1016/j.expthermflusci.2012.05.013`.
- Guyot, G., Cartellier, A. & Matas, J.-P. (2020), _Penetration Depth of a Plunging Jet: From Microjets to Cascades_, DOI `10.1103/PhysRevLett.124.194503`.
- Collins (1965), planar-bubble rise correlation, as reproduced and discussed in later narrow-channel bubble literature: `V_B = 0.58 sqrt(g d_B)`.
- SPHERIC Test 02, 3-D schematic dam break / Kleefsman benchmark: experimental spreadsheet and geometry distributed by SPHERIC.
