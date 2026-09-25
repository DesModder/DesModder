# Upgrade roadmap: Physics Lab, Vector Tools, Audio Lab

Written after the tightening pass of 2026-09-25. It covers what an audit of
each engine turned up but did not fix, and what the plugins could do next.
Items are ranked within each section by payoff for effort. Anything marked
**decision** is a trade-off for Rafael, not something to be settled in code.

What the pass itself fixed is in `PHYSICS_LAB_HANDOFF.md` ("The tightening
pass"), and in the commits from `1aa6b26e` onwards.

---

## Physics Lab

### Found in the audit, not yet fixed

1. **Answers that are right but hard to read.** The differentiator's quotient
   rule output is left unsimplified: `x/(1+x²)^{3/2}` differentiates to a
   fraction over `((1+x²)^{3/2})²` rather than `(1−2x²)/(1+x²)^{5/2}`.
   `√(x²+1)³` comes back `3(x²+1)x/√(x²+1)`, not `3x√(x²+1)`. The cause in
   both is that the fold does not treat `√u` and `u^{1/2}` as the same base
   when cancelling. The fix is to cancel powers of a common base with
   rational exponents across the bar, including roots.
2. **Like terms that are spelled differently.** `4eˣ/(e^{2x}+1) − 3eˣ/(e^{2x}+1)`
   is not collected (seen in `∫sech³x`). `collectLikeTerms` matches on
   identical trees, so it needs a coefficient-splitting pass that sees through
   a numerator coefficient.
3. **Refusals that name the wrong reason.** `∫e^{−x} ln x` says "a quotient
   with the variable above and below" when the true answer is that it needs
   Ei(−x). The non-elementary classifier should run parts once before giving
   up.
4. **Integrals still refused.** Examples:

   - `cos 2x/(sin x + cos x)`, which needs factoring then a cancellation;
   - `√(4x²+4x+2)`, which needs a trigonometric substitution with a scaled
     square;
   - `|sin x|`, which is piecewise periodic;
   - `floor(x)`.

   Also, `1/(x√(x²+2x))` succeeds through a half-angle detour: it is right,
   but it should be `−√(x²+2x)/x`.

5. **Limits still unknown.**
   - `ln(ln x)/ln x`: iterated logarithms need a `ln ln t` slot on the
     scale, or the full Gruntz algorithm.
   - `x(2 + sin x) − x`: a bounded factor inside a sum.
   - `floor(1/x)·x` at 0⁺: squeeze with floor's bounds.
6. **Derivatives of step functions.** `floor`, `ceil` and `sign` are refused.
   Their derivative is 0 away from the jumps, which could be said with a
   domain note, the same way `|x|` gets one.
7. **Oscillatory improper integrals.** `∫₀^∞ sin x/x dx = π/2` does not
   settle under the double-exponential rules. The Ooura–Mori rule for
   Fourier-type integrals, or summing between zeros with Richardson or Levin
   acceleration, would add it.

### Next upgrades

1. **A Series tab.** It would do two things:

   - Taylor polynomials with a proved remainder bound (Lagrange form, bounded
     on an interval).
   - Convergence tests that name themselves (ratio, root, integral,
     comparison, alternating), each shown with its proof, the way the Limit
     tab shows routes.

   `powerSeries.ts` and the limit engine already do the hard parts.

2. **A Sums tab.** Closed forms by Gosper's algorithm for hypergeometric
   terms. For the rest, the digits would come from convergence acceleration
   (Euler–Maclaurin, Richardson) and be read back by the recogniser. This is
   exactly how `Σ1/n³ = ζ(3)` would be found and shown.
3. **Limits with parameters.** For example, `sin(ax)/x → a`, with the case
   split on `a = 0` stated (research Q6).
4. **Second-order ODEs, further.** Four additions:
   - variation of parameters, for any forcing whose integrals exist;
   - Cauchy–Euler equations;
   - reduction of order;
   - the Laplace transform, as a method with steps.
5. **Exact equations and Riccati.** `M dx + N dy = 0` with `M_y = N_x`, and
   an integrating factor in x or y alone when one exists. Riccati, given one
   solution.
6. **Heavy work off the main thread.** Quadrature, recognition, and the
   growth-race engine run synchronously today. The panel stays responsive
   only because each is sliced or debounced. A Web Worker would let the tab
   show a result as it arrives, with no slicing.
7. **Physical constants with units.** G, c, h, k_B and N_A, with units
   carried through, as a catalog rather than as recogniser targets. This was
   option 3 of the constants question.
8. **Practice problems from route templates** (research Q8).

---

## Vector Tools

### Found in the audit

1. **decision — Undefined values on the GPU.**
   - The compiler clamps where Desmos is undefined: `ln` of a non-positive
     number becomes `ln(10⁻¹²) ≈ −27.6`, `√` of a negative becomes 0, and
     `arcsin` outside [−1, 1] is clamped.
   - So the live arrows draw a large false arrow where the generated Desmos
     field draws nothing.
   - Piecewise branches now produce a real undefined (a NaN, which the field
     reads as no arrow). The same could be done for these three, but it
     changes what users see near every logarithm. The current clamping may
     also be deliberate for the flow's particles.
2. The shader's division guard, `vtDiv`, is a documented choice for poles and
   was left alone.

### Next upgrades (the agreed roadmap order)

1. **Divergence and curl on the GPU.** The exact half is done: `∇·F` and
   `∇×F` are in the Field tab, and so is the conservative check. What
   remains is the coloured overlay: a full-screen pass with central
   differences and a signed saturating ramp,
   `sign(d)·(1 − e^{−|d|/scale})`, on a diverging palette centred at zero.
2. **Nullclines and equilibria** (roadmap item 4). `P = 0` and `Q = 0` as
   generated implicit curves, with their intersections as the critical
   points.
3. **Classifying equilibria.** Four symbolic derivatives give the Jacobian at
   each critical point. Its eigenvalues give saddle, node, spiral or centre,
   and its eigenvectors can be drawn. This is the biggest linear-algebra
   payoff, and it follows almost for free from 1 and 2.
4. **A potential function for a conservative field.** The check exists. Showing
   `f` itself needs an integrator, and the only one is Physics Lab's. Moving
   the integrator into `src/symbolic` (neutral, below both plugins, as the
   differentiator already is) would allow it without a cross-plugin
   dependency. **decision**: this is a large move of shared code.
5. **Click-to-seed streamlines, and line integral convolution** (roadmap
   item 7).
6. **A cursor probe.** P, Q, |V|, angle, divergence and curl at the pointer,
   through a hidden helper expression.
7. **Matrix fields.** `V = Ax` for a 2×2 A, with eigenvalues, eigenvectors,
   and the image of the unit circle.
8. **Sums with constant bounds on the GPU**, unrolled in the shader, so that
   `Σ_{k=1}^{5} …` fields animate.

---

## Audio Lab

### Fixed in this pass

The dominant frequency and the components are refined with a parabola
through log magnitudes, which is seven times more accurate on the Blackman
window than the linear fit it replaced.

### Next upgrades

1. **Pitch as well as dominant frequency.** The loudest bin of a sung or
   played note is often a harmonic, so "dominant frequency" jumps octaves.
   A fundamental-frequency estimator would give a stable pitch, reported
   beside the dominant peak rather than replacing it. The McLeod pitch
   method and YIN are both cheap on the time-domain buffer already captured.
2. **Tempo in BPM.** Autocorrelate the onset envelope that `OnsetDetector`
   already produces, and lock the beat phase to it.
3. **Loudness as people hear it.** An approximation of ITU-R BS.1770 K-weighted
   loudness (LUFS) would replace RMS. RMS weights bass as heavily as the
   presence region, which is not how loudness is heard.
4. **Chroma and key.** Twelve pitch-class energies folded from the spectrum,
   as a `C_{hroma}` list, with the Krumhansl key estimate.
5. **Bass resolution.** At 2048 points, bins are 23 Hz apart, which is
   coarse below 100 Hz. A second, longer analyser for the bass band (or
   zero-padding) would fix that, at the cost of latency in that band only.
6. **Timbre.** Spectral rolloff and flatness, or a few MFCCs, as live
   variables. Flatness also separates a tone from noise better than peak
   prominence does.

---

## Cross-cutting

1. **One Web Worker for the symbolic engines**, shared by any plugin that
   needs heavy exact work.
2. **Probe suites as permanent tests.** The audit's probes (hundreds of
   integrals, limits, derivatives and ODEs, each checked independently)
   caught the wrong answers here. Pinning the whole list, as
   `coverage.unit.test.ts` and `limit.coverage.unit.test.ts` already do for
   theirs, would keep them caught.
