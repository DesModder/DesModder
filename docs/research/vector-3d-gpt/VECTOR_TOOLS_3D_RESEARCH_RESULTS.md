# Vector Tools 3D — research result and implementation recommendation

Date: 2026-10-05

This report follows `VECTOR_TOOLS_3D_RESEARCH_BRIEF.md`. It treats the attached `DESMOS_3D_CAMERA.md` as established ground truth: the camera matrices and redraw hook are already solved, and I did not re-derive them.

Evidence labels used below:

- **MEASURED HERE** — code or numerical experiment actually run in this research environment.
- **SOURCE-BACKED** — behavior stated in current documentation or inspected source.
- **PROPOSED DEFAULT** — product/engineering decision recommended for Vector Tools, not a measurement.
- **NOT RUN** — specifically not measured here and must not be mistaken for a benchmark result.

## Executive decision

Build 3D Vector Tools as a separate transparent WebGL2 overlay driven by the already-verified Desmos 3D camera matrices. Make the normal field renderer an **opaque, depth-tested, shaded 3D glyph renderer** with a sparse, deterministic stratified sample. Encode direction primarily by arrow orientation and magnitude primarily by a robust color ramp, not raw arrow length. Keep a labeled quality control that can force solid 3D, camera-facing flat arrows, or lines.

The initial defaults should be:

| Control           | Default                           | Rationale                                                                                                                                                        |
| ----------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Placement         | `Auto: sparse volume`             | Full `n^3` lattice density becomes cluttered quickly; ParaView and VisIt both expose thinning/sampling controls.                                                 |
| Count             | `Auto`                            | One target sample per ~40×40 CSS pixels, clamped to roughly 216–1000 arrows, then rounded to a cubic stratification.                                             |
| Glyph quality     | `Auto`                            | Solid 3D for ordinary counts; billboard/line fallbacks exist for stress cases. Thresholds below are provisional until Iris Xe is measured.                       |
| Arrow length      | `Direction` (fixed)               | Mathematica's default is fixed-length arrows colored by magnitude; this preserves direction near singular fields.                                                |
| Magnitude color   | `Auto robust`                     | `t = 1 - exp(-m/s)`, with `s = P60` of finite sampled magnitudes.                                                                                                |
| Pole behavior     | `Hide invalid; saturate finite`   | Never turn domain errors/division-by-zero into a finite-looking arrow. Very large but finite fields remain visible with saturated color and capped/fixed length. |
| Overlay occlusion | `X-ray`                           | Honest label: the separate WebGL context cannot see Desmos's depth buffer. Its own arrows still depth-test against each other.                                   |
| Flow style        | `Streaklets`                      | World-space short trails are more informative than points and remain correct under camera rotation.                                                              |
| Particle count    | 16k default, 32k high, 64k stress | 16k matches the existing 2D architecture's scale. These are proposed tiers, not new Iris Xe measurements.                                                        |

The most important architecture choice is to **not** make “native Desmos vectors” the live renderer. Native vectors should be a separate `Snap to Desmos`/`Generate native field` output mode for shareability, printing, and true Desmos surface occlusion. The live overlay remains the responsive analysis mode.

---

## 1. What professional 3D vector tools actually do

### Sampling

**SOURCE-BACKED.** ParaView's glyph modes explicitly include “Every Nth Points,” reproducible uniform spatial sampling in a bounding box, surface sampling, and volume sampling. Its documentation warns against glyphing all points for large datasets because of clutter, memory, and rendering cost. VisIt likewise says that too many vectors make the plot incomprehensible and exposes fixed-count and stride thinning. This is strong evidence that the right abstraction is a target sample budget, not “fill the whole volume with an `n × n × n` grid.”

**SOURCE-BACKED.** A VisIt aneurysm tutorial uses a vector stride of 5, magnitude coloring, and a cylinder arrow body at high geometry quality. ParaView's CFD tutorial mixes slices, glyphs, stream tracers, tubes, and cone direction markers rather than trying to make one dense glyph plot carry every piece of information.

**PROPOSED DEFAULT.** For Vector Tools:

```text
N_target = clamp(round(viewportCssWidth * viewportCssHeight / 1600), 216, 1000)
n = round(cuberoot(N_target))
N = n^3
```

That corresponds to roughly one projected seed per 40×40 CSS pixels before 3D depth overlap. Examples:

- 900×600 CSS px → target 338 → `7^3 = 343` arrows.
- 1200×800 → target 600 → `8^3 = 512` arrows.
- 1920×1080 → raw target 1296, clamped → `10^3 = 1000` arrows.

This is deliberately much lower than a naïve `20^3 = 8000` volume.

### Jitter instead of a visible cubic lattice

**PROPOSED DEFAULT.** Divide the box into `n^3` cells and place one seed at a deterministic jittered position inside each cell. Keep the jitter away from the exact cell faces, e.g. 14%–86% of each cell. Use a graph/expression-derived seed so the point cloud stays stable when the camera moves.

**MEASURED HERE.** In a 512-point `8^3` test over `[-2,2]^3`, deterministic stratified jitter had:

- nearest-neighbor mean: `0.33225`
- nearest-neighbor coefficient of variation: `0.31615`
- 5th-percentile nearest-neighbor spacing: `0.16105`

The same number of fully uniform random points had:

- nearest-neighbor mean: `0.28950`
- coefficient of variation: `0.38083`
- 5th-percentile spacing: `0.10781`

So the stratified sample produced fewer tight clumps while still breaking the distracting perfectly aligned lattice. This is exactly the visual compromise wanted for a vector field.

Controls should remain explicit:

```text
Placement: Auto volume | Grid | XY slice | XZ slice | YZ slice | Surface
Count: Auto | slider / numeric
Jitter: On | Off
```

For analysis tasks involving a surface, selecting `Surface` should sample on that surface; it should not silently change the global mode.

---

## 2. Arrow geometry and shading

### Recommended solid glyph

**PROPOSED DEFAULT.** Use an 8-sided cylinder shaft plus an 8-sided cone head, generated procedurally with `gl_VertexID` and instanced with `gl_InstanceID`/instanced attributes. No index buffer is required.

Per arrow:

- shaft: 8 quads × 2 triangles × 3 vertices = **48 vertices**
- cone: 8 triangles × 3 vertices = **24 vertices**
- total = **72 vertices/arrow**

Exact vertex traffic:

| Arrows | Solid 72-vtx | Billboard 9-vtx | Line 2-vtx |
| -----: | -----------: | --------------: | ---------: |
|    216 |       15,552 |           1,944 |        432 |
|    512 |       36,864 |           4,608 |      1,024 |
|  1,000 |       72,000 |           9,000 |      2,000 |
|  1,500 |      108,000 |          13,500 |      3,000 |
|  8,000 |      576,000 |          72,000 |     16,000 |

The visual prototype in this package uses exactly the 72-vertex solid arrow and WebGL depth testing.

### Shape

**PROPOSED DEFAULT.** Fixed direction-glyph length `L = 0.55 * d`, where `d` is the local stratification cell spacing. Cap any magnitude-scaled mode at `0.72 * d` so neighboring arrows do not routinely cross. Use a head length near `0.30 L`; Matplotlib's current 3D quiver default `arrow_length_ratio` is 0.3, which is a reasonable, familiar baseline.

The shaft radius can be about `0.05 L`, and cone-base radius about `0.14 L`. At normal field counts these proportions read well without making the field look like a forest of oversized cones.

### Shading

Use simple view-independent diffuse lighting plus a small ambient term. Do not copy Desmos's internal light; the goal is shape perception, not pretending to be native geometry. A single directional light in camera/world coordinates is enough. Because arrows are opaque, enable the overlay's own depth buffer so arrows correctly occlude one another.

A thin contrast halo is optional for flat/billboard glyphs. For solid glyphs, shading and depth are preferable to a screen-space outline.

### Automatic quality

**PROPOSED DEFAULT, NOT BENCHMARKED ON IRIS XE.** Start with:

```text
Glyph quality: Auto | Solid 3D | Flat | Lines
Auto provisional:
  <= 1500 arrows  -> solid 72-vertex glyph
  <= 8000 arrows  -> 9-vertex camera-facing arrow
  >  8000 arrows  -> 2-vertex line/needle, or clamp count
```

These thresholds are engineering starting points based on exact geometry counts, not measured Iris Xe frame times. The standalone benchmark in this package exists to replace these provisional thresholds with measured values on the maintainer's machine.

---

## 3. Magnitude, dynamic range, and poles

### Direction and magnitude should not fight each other

**SOURCE-BACKED.** Wolfram `VectorPlot3D` defaults to arrows normalized to fixed length and colors them according to vector magnitude. It separately exposes magnitude-based vector scaling. This is a sound default for educational fields because direction remains visible when magnitudes span orders of magnitude.

**PROPOSED DEFAULT.** Keep arrow length fixed in `Direction` mode. Encode magnitude with:

```text
t = 1 - exp(-m / s)
```

where `m = |F|` and `s` is a robust scale. In `Auto`, use the 60th percentile of valid sampled magnitudes, `P60`. Add a manual `Magnitude scale` control for experts.

Do **not** normalize by the maximum magnitude when singularities are present.

### Point-charge and dipole test

**MEASURED HERE.** I sampled 512 stratified-jittered points in `[-2,2]^3`.

For `F = r/|r|^3` (point charge):

- median magnitude = `0.25153`
- P60 = `0.30524`
- maximum = `36.5829`
- max/median = **145.44×**
- linear `m/max` maps the median to only **0.00688** of the palette
- `1-exp(-m/P60)` maps the median to **0.56135**
- only **8.59%** of samples exceed 0.95 in the saturated ramp

For a unit dipole with charges at `x=±0.5`:

- median magnitude = `0.15889`
- P60 = `0.21117`
- maximum = `19.0229`
- max/median = **119.73×**
- linear `m/max` maps the median to **0.00835**
- exponential P60 ramp maps the median to **0.52877**
- **13.87%** of samples exceed 0.95

That is a decisive visual result: max-normalization would make almost every ordinary arrow look like the bottom of the color map.

### Invalid values and singularities

The current 2D GLSL compiler regularizes several operations. That is useful for keeping shaders finite but can fabricate a plausible-looking direction at an exact pole. 3D should distinguish two cases:

1. **Invalid/domain-error** sample: denominator effectively zero, negative square-root argument, non-real result, NaN/Inf. Hide the glyph and respawn a particle.
2. **Finite but huge** sample: keep the direction, fixed/capped length, and saturated magnitude color.

**PROPOSED IMPLEMENTATION.** Extend the GLSL helper layer with a per-invocation validity flag rather than silently replacing every invalid expression with a finite value. A low-intrusion pattern is:

```glsl
bool vt_valid;

float vtDiv(float a, float b) {
    if (abs(b) < 1e-12) {
        vt_valid = false;
        return 0.0;
    }
    return a / b;
}

void main() {
    vt_valid = true;
    vec3 f = field(p);
    if (!vt_valid || any(isnan(f)) || any(isinf(f))) {
        // move vertex out of clip space / discard particle
    }
}
```

Do not use an exclusion radius large enough to erase legitimate near-pole behavior. The deterministic jitter already makes sampling an exact mathematical pole uncommon; the validity flag handles the exact/domain-invalid case.

---

## 4. Occlusion and the Desmos surface problem

There are four distinct options. They should not be conflated.

### A. Separate overlay, honest X-ray semantics — recommended default

The attached camera work already makes the overlay land on the correct 3D projection. The overlay can have its **own depth buffer**, so its arrows self-occlude correctly. What it cannot do is test against depth values produced in Desmos's separate WebGL context.

**PROPOSED DEFAULT UI:**

```text
Surface occlusion: X-ray | Selected surfaces (experimental) | Native Desmos
```

Call the default `X-ray`, not “normal,” because arrows can appear over a Desmos surface that is geometrically in front of them.

Useful depth cues that do not pretend to solve the missing depth buffer:

- shaded solid glyphs;
- perspective from the already-matched Desmos matrices;
- mild camera-depth attenuation/fog;
- box clipping to the same visible 3D bounds;
- opaque arrows by default, avoiding transparency-order ambiguity.

Weighted blended order-independent transparency is a real technique for approximate transparent-object composition, but it only solves ordering **inside the Vector Tools overlay**. It cannot magically incorporate Desmos's depth. Use it, if at all, for translucent trails/tubes; it is not the answer to surface occlusion.

### B. Reproduce selected surfaces into the overlay depth buffer

This is feasible for a deliberately limited set of surfaces:

- `z = f(x,y)`: tessellate a regular `(x,y)` grid and evaluate `f` in the vertex shader;
- parametric `r(u,v)`: tessellate the `(u,v)` domain;
- explicit `x=f(y,z)` / `y=f(x,z)`: analogous;
- implicit `F(x,y,z)=0`: requires mesh extraction such as marching cubes/tetrahedra and is a much larger project.

Render selected surface geometry depth-only before arrows:

```js
gl.enable(gl.DEPTH_TEST);
gl.depthMask(true);
gl.colorMask(false, false, false, false);
renderSelectedSurfaceDepth();
gl.colorMask(true, true, true, true);
renderGlyphs();
```

This gives visually correct occlusion against the reproduced surface **in the Vector Tools context**. It does not guarantee pixel-identical agreement with Desmos's own tessellation, clipping, discontinuity handling, or depth peeling.

This should therefore be an explicitly experimental mode, not hidden magic.

### C. Native Desmos vectors

This is the only low-fragility way to get the vector arrows themselves into Desmos's own 3D rendering and therefore its native surface depth/peeling behavior. The tradeoff is evaluation/rebuild cost and reduced styling freedom. It should be a generated/snap mode, not the live renderer.

### D. Hook Desmos 3D's renderer/context

This could theoretically provide exact access to the current depth-peeling pipeline, but it is the highest-risk option. It means private renderer state, framebuffer/pass ordering, GL state restoration, extension compatibility, and constant risk of breakage when Desmos changes internals.

Do not make this the first implementation.

---

## 5. What GLesmos actually proves — and what it does not

I inspected current DesModder GLesmos source, specifically:

- `src/plugins/GLesmos/glesmosCanvas.ts`
- `src/plugins/GLesmos/drawGLesmosSketchToCtx.ts`
- `src/plugins/GLesmos/shaders.ts`
- `src/plugins/GLesmos/index.ts`

The important correction is that **GLesmos creates its own WebGL2 canvas/context**. It performs its float-texture/framebuffer work there, then `drawGLesmosSketchToCtx.ts` composites the result into Desmos's 2D draw context with `ctx.drawImage(canvas.element, 0, 0)`.

So GLesmos proves that DesModder can:

- hook expression compilation/worker behavior;
- reuse Desmos GLSL-related helpers;
- keep a persistent auxiliary WebGL2 renderer;
- composite the result into Desmos's drawing pipeline.

It does **not** prove that an extension can safely share Desmos's active WebGL context or depth buffer. For 3D, that distinction is decisive.

A true “GLesmos for 3D vectors” would require either a 3D compositing hook exposed by Desmos or private intervention inside the 3D WebGL renderer. Until a stable hook is demonstrated, keep the camera-matched overlay architecture.

---

## 6. Native Desmos 3D vector output

**SOURCE-BACKED.** Current Desmos 3D supports `vector(a,b)` with 3D start/end points. Current Desmos lists can be used to plot multiple 3D objects, and current custom-color documentation says a list of colors can be assigned to a list of objects.

This makes a compact generated representation plausible: one list-valued vector expression rather than three separate parametric objects per arrow as in the older 2D generator.

A target form is conceptually:

```text
P = (X,Y,Z)
Q = (...end-point lists...)
vector(P,Q)
```

or a `for`-based list construction if broadcasting `vector` over point lists behaves better.

### What is established

- 3D `vector(start,end)` exists.
- Lists are supported in 3D for multiple objects.
- Lists of colors can style lists of objects in the current calculators.

### What I did not establish

- The exact vector count at which Desmos 3D becomes slow on the maintainer's hardware.
- Whether every desired vector style property, including arrowhead geometry/size, can be independently list-driven.
- Whether `vector(pointList, pointList)` broadcasts exactly as desired in the current 3D runtime; the included benchmark is designed to test this live.
- Slider rebuild cost at 125/343/512/729/1000/1728 vectors on desmos.com.

There is no responsible reason to invent those numbers.

I included `desmos3d_native_vector_bench.js`. Paste it into DevTools on `desmos.com/3d`. It generates one native vector-list expression at increasing cubic counts and records `setExpression -> first changed grapher3d.redrawResult` latency. It cleans up after itself. Record browser build, Desmos build, GPU, and whether the candidate list syntax is accepted.

**PROPOSED product boundary:** native snap should initially cap at 1000 vectors unless the live benchmark shows headroom. If the benchmark shows a much lower knee, lower the cap; if it stays fluid well above 1000, increase it. The cap is a product guard, not a mathematical limit.

---

## 7. 3D flow: particles, streaklets, streamlines, tubes

### State update architecture

The current 2D `FlowRenderer` already uses float-texture ping-pong and a fragment-shader RK4 update. The lowest-risk 3D extension is to keep the same architecture and change particle state from 2D position/age to 3D position/age:

```text
RGBA32F texel = (x, y, z, age)
```

WebGL2 can make 32-bit float color attachments renderable through `EXT_color_buffer_float`. Feature-test it exactly as the existing renderer feature-tests required capabilities. Transform feedback is a legitimate alternative and does not require rendering into a float texture, but it would be a second state-update architecture with no clear payoff for the first 3D version.

**Recommendation:** texture ping-pong primary; transform feedback only as a fallback/experimental path if a target GPU has a problematic float-FBO implementation.

### World-space trails, not screen-space fade

The current 2D trail strategy is a screen-space persistence texture. In 3D, that smears when the user rotates the camera because the old pixels represent old projections.

Store short position history in world space and reproject it every frame.

A useful default is 8 history samples/particle:

- 32,768 particles × 8 samples × 4 float32 values = **4.0 MiB** for history.
- current ping-pong state at 32,768 particles = about **1.0 MiB** total for two RGBA32F state textures.

Then render 7 line segments per particle as a short fading streaklet. Camera rotation becomes immediately correct because every segment is transformed with the current Desmos camera matrix.

### Display ranking

1. **Streaklets — default.** Best compromise: direction and motion are visible, camera rotation is correct, and history is bounded.
2. **Points.** Cheapest, useful in very high-count stress mode, but weak directional information.
3. **Streamlines.** Excellent analysis mode for a static field. Seed deliberately from point/line/plane/surface; compute trajectories until length/step/box limit.
4. **Tubes.** Use only for a small selected set of streamlines. ParaView tutorials explicitly add tube geometry because plain streamlines can be visually weak, then add glyphs/cones to communicate direction. Tubes are far too much geometry for every particle trail.

### Proposed count tiers — not hardware measurements

```text
Particles: 16k default | 32k high | 64k stress
History:   8 samples default
Integrator: RK4, same family as 2D
```

The benchmark page includes 16k and 64k float-texture update tests, but this environment could not produce trustworthy hardware WebGL timings. Run it on the Intel Iris Xe machine before setting an automatic quality threshold.

For singular fields, use the validity flag described above. Invalid particles respawn. Very fast but finite fields should not explode the integrator: cap visual advection distance per step relative to the local sample spacing, or expose `Particle speed: Field | Normalized`. If `Normalized` is selected, label it as a visualization path, because it no longer represents physical time evolution.

---

## 8. Divergence and curl visualization

### Computation

For the live overlay, finite differences are the simplest extension because the field already exists as GLSL:

```glsl
float h = ...;
vec3 FxP = F(p + vec3(h,0,0));
vec3 FxM = F(p - vec3(h,0,0));
vec3 FyP = F(p + vec3(0,h,0));
vec3 FyM = F(p - vec3(0,h,0));
vec3 FzP = F(p + vec3(0,0,h));
vec3 FzM = F(p - vec3(0,0,h));

float divF = (FxP.x-FxM.x + FyP.y-FyM.y + FzP.z-FzM.z)/(2.0*h);
vec3 curlF = vec3(
  (FyP.z-FyM.z - (FzP.y-FzM.y)),
  (FzP.x-FzM.x - (FxP.z-FxM.z)),
  (FxP.y-FxM.y - (FyP.x-FyM.x))
)/(2.0*h);
```

**PROPOSED Auto step:** start near `h = 0.05 * sampleCellSpacing`, clamped to a small fraction of the current box diagonal. The correct value is scale-dependent; therefore expose an `Derivative step: Auto / Manual` advanced control rather than hard-coding a universal epsilon.

### Display

- **Divergence:** scalar diverging color on a slice or selected surface, optionally with small `+`/`-` markers at extrema. Do not try to show divergence as another dense 3D arrow field.
- **Curl:** sparse arrows showing `curl F`, usually on a movable slice, with magnitude color.
- **Combined:** original field muted + selected slice showing divergence or curl.

ParaView's CFD tutorial exposes Gradient, Divergence, and Vorticity as explicit analysis products; this supports treating them as separate field-analysis modes rather than overloading normal arrow rendering.

---

## 9. Flux through a surface

For a parametric surface `r(u,v)`, use the standard integrand

```text
F(r(u,v)) · (r_u × r_v)
```

and midpoint quadrature over the `(u,v)` domain. The derivatives `r_u`, `r_v` can initially use central finite differences in the same GLSL expression path; later, symbolic derivatives can replace them where the Desmos compiler exposes them reliably.

### Recommended execution path

This operation is user-triggered, so favor accuracy and debuggability over per-frame cleverness:

1. Render one integrand value per quadrature sample into an `R32F`/`RGBA32F` texture.
2. `readPixels` the small result texture after the analysis button is pressed.
3. Sum in JavaScript `Number` using pairwise/Kahan summation.
4. Display the scalar result and keep the integrand texture for visualization on the surface.

This causes a GPU readback stall, but a button-triggered integral is not a 60 Hz operation. It avoids a complex multi-pass reduction and accumulates the final sum in JS double precision.

### Measured validation

**MEASURED HERE.** For `F=r/r^3` through the unit sphere, exact flux is `4π = 12.566370614...`. Midpoint spherical quadrature gave:

| theta × phi samples |       value | relative error |
| ------------------: | ----------: | -------------: |
|                8×16 | 12.64748079 |       0.64545% |
|               16×32 | 12.58657971 |       0.16082% |
|               32×64 | 12.57141863 |       0.04017% |
|              64×128 | 12.56763235 |       0.01004% |

So a 32×64 surface grid is already visually/educationally useful; 64×128 is a strong “high accuracy” tier for a smooth surface.

### Implicit surfaces

For `G(x,y,z)=0`, do not fake a flux integral from a screen-space surface. First obtain an oriented triangle mesh, then sum triangle flux using triangle centroids/normals (with refinement if needed). Mesh extraction and consistent orientation make this a later milestone.

---

## 10. Line integral along a curve

For a parametric curve `r(t)`:

```text
Integral F(r(t)) · r'(t) dt
```

A robust implementation can work directly from polyline samples. For each segment `p_i -> p_{i+1}`, evaluate the field at the segment midpoint and accumulate

```text
F((p_i+p_{i+1})/2) · (p_{i+1}-p_i)
```

This avoids separately differentiating the user curve for the first version and maps naturally to displayed segments.

### Measured validation

**MEASURED HERE.** For `F=(-y,x,0)` around the unit circle, exact circulation is `2π = 6.283185307...`:

| Segments |      value | relative error |
| -------: | ---------: | -------------: |
|       16 | 6.12293492 |       2.55046% |
|       32 | 6.24289030 |       0.64131% |
|       64 | 6.27309698 |       0.16056% |
|      128 | 6.28066231 |       0.04015% |
|      256 | 6.28255450 |       0.01004% |

A practical default is 128 segments with automatic refinement to 256 if the 64→128 estimate changes more than the requested tolerance.

### Integrand display

Show the curve itself with segment color representing signed `F·dr` contribution. Add a small running-total chart or readout only on selection; do not add another permanent UI panel.

For flux, color the selected surface by signed `F·n dA` density using a diverging palette. This makes the scalar result traceable back to geometry.

---

## 11. Teaching preset ranking

These presets should only set normal controls; they should not introduce new mathematical notation.

### AP Physics C: Electricity & Magnetism

College Board's current framework includes Electric Charges, Fields, and Gauss's Law; Electric Potential; Magnetic Fields and Electromagnetism; and representation/mathematical-routine practices. The highest-value presets are therefore:

1. **Point charge / superposition** — fixed-length field arrows, robust magnitude color, optional equipotential surface.
2. **Electric dipole** — same defaults; excellent test of dynamic range and directional structure.
3. **Gauss sphere / Gaussian surface** — point-charge field + translucent sphere + signed flux-density coloring + numerical total flux.
4. **Uniform field / parallel plates** — clean direction/magnitude comparison; useful before singular fields.
5. **Long straight current** — circular magnetic field arrows + selectable Amperian loop + line integral.
6. **Solenoid / approximately uniform interior B** — slice and streamline/streaklet comparison.
7. **Induction visualization** — time/slider-dependent field only after the static renderer is stable.

### AP Physics 2

The current AP Physics 2 framework includes Electric Force, Field, and Potential plus Magnetism and Electromagnetism. Keep the representations more qualitative:

1. Point charge.
2. Two like charges vs dipole.
3. Uniform electric field / plates.
4. Magnetic field around a straight wire.
5. Magnetic field through a loop/solenoid.
6. Flux visualization with geometry-first explanation; hide numerical-integration detail by default.

### Multivariable calculus / Calc 3

This is where the analysis layer becomes central:

1. Radial source field — divergence intuition.
2. Rotation field `(-y,x,0)` — curl and circulation.
3. Saddle/mixed field — compare arrows, divergence, curl.
4. Line integral along a user curve.
5. Flux through plane/sphere/parametric surface.
6. Divergence theorem paired view: volume divergence vs boundary flux.
7. Stokes paired view: surface curl flux vs boundary circulation.

The presets should configure the same field, slice, integral, and color controls users can create manually. No special hidden solver path.

---

## 12. Integration plan against the current Vector Tools architecture

### Phase A — solid 3D field overlay

1. Add a `VectorField3DRenderer` next to `ArrowRenderer`, not inside the 2D code path.
2. Reuse the established 3D camera snapshot from `grapher3d.redrawResult.camera` and redraw signal from `onRedraw3dResults`.
3. Extend expression/environment compilation so a field can expose three GLSL components `Fx,Fy,Fz` with the same user scalar/function dependencies used in 2D.
4. Generate stratified sample positions on CPU only when bounds/count/seed changes; upload as an instanced position buffer.
5. Evaluate the actual field in the vertex shader.
6. Use the 72-vertex procedural arrow and overlay depth buffer.
7. Add validity tracking and robust P60 magnitude scale. P60 can be estimated by a small GPU sample pass + readback when field/bounds change, not every frame.
8. Add `Solid / Flat / Lines` manual quality control; leave `Auto` thresholds configurable.

### Phase B — native snap and slices

1. Implement XY/XZ/YZ/movable plane placement.
2. Implement generated native `vector` output behind a button, not continuously synchronized at first.
3. Run `desmos3d_native_vector_bench.js` on the target laptop and set the cap from measured behavior.
4. Add color-list generation only after confirming vector-list style behavior on current Desmos 3D.

### Phase C — 3D flow

1. Extend particle state to `(x,y,z,age)`.
2. Reuse RK4 texture ping-pong.
3. Replace 2D screen trail persistence with world-space 8-sample history.
4. Render points and line streaklets first; add selected streamlines after.
5. Run `vector3d_webgl2_bench.html` on Iris Xe and tune counts/quality.

### Phase D — field analysis

1. Divergence and curl on slices using central differences.
2. Parametric curve line integral.
3. Parametric surface flux.
4. GPU integrand evaluation + readback + JS compensated sum.
5. Integrand coloring on geometry.
6. Later: implicit-surface mesh extraction and flux.

### Phase E — experimental selected-surface depth reproduction

Only after A–D are stable. Start with `z=f(x,y)` and parametric surfaces. Keep it labeled experimental because it is an approximation to Desmos geometry, not access to Desmos depth.

---

## 13. Performance targets and what is actually measured

The following are **acceptance targets**, not claims about current Iris Xe performance:

- camera-only orbit update should not regenerate sample buffers or relink shaders;
- ordinary 512–1000 solid-arrow field should stay visually interactive;
- 8k billboard stress case should remain usable;
- 16k particle + 8-sample streaklet mode should be the normal flow tier;
- 32k should be a high tier; 64k is a stress tier until measured.

The runnable standalone benchmark tests:

- 1,000 and 8,000 arrows;
- 2-vertex line, 9-vertex billboard, and 72-vertex solid glyphs;
- 16k and 64k RGBA32F ping-pong particle updates.

### NOT RUN / not trustworthy in this environment

I attempted to run the WebGL benchmark in the available Chromium environment. The environment did not provide a trustworthy hardware WebGL path; software/ANGLE initialization and browser execution restrictions prevented a valid timing run. I therefore **did not** report any fake “Iris Xe” milliseconds or FPS.

The HTML and JS were syntax-checked, and the numerical tests were actually run. GPU timings must be collected on the maintainer's real Intel Iris Xe machine.

---

## 14. Included runnable artifacts

### `vector3d_visual_prototype.html`

A no-dependency WebGL2 visual prototype implementing the main rendering recommendation:

- 8-sided cylinder + cone, 72 vertices/arrow;
- instanced 3D glyphs;
- point charge and dipole fields;
- deterministic stratified jitter;
- fixed arrow length;
- P60 exponential magnitude color mapping;
- invalid-pole hiding;
- overlay's own depth testing;
- camera orbit and zoom;
- optional camera-depth fade.

It is not a Desmos integration; it isolates the proposed rendering decisions so they can be judged visually.

### `vector3d_webgl2_bench.html`

Standalone benchmark for glyph geometry and float-texture particle update. It reports renderer/vendor/version/extensions and timing samples when opened in a real browser.

### `desmos3d_native_vector_bench.js`

DevTools benchmark intended for `desmos.com/3d`. It tests increasing native vector-list counts and reports first-redraw latency. This was **not run here**.

### `vector3d_analysis_validation.py`

Reproducible numerical checks for sphere flux and circle circulation.

### `vector3d_numeric_results.json`

Raw output from the deterministic sampling, point-charge/dipole dynamic-range test, flux convergence, and line-integral convergence.

---

## 15. Bottom line

The 3D version should not be a direct extrusion of the current 2D arrow grid. The most defensible design is:

**Sparse volume samples + shaded solid arrows + fixed direction length + robust magnitude color + honest X-ray surface semantics.**

Then add three specialized modes rather than overloading that view:

- **Native Desmos output** for shareability and true native occlusion;
- **World-space particle streaklets/streamlines** for flow;
- **Slice/surface analysis** for divergence, curl, flux, and line integrals.

The current camera solution makes this practical. The unsolved engineering risk is not projection; it is Desmos-surface occlusion. The correct first release is to label that limitation instead of reaching immediately for an invasive renderer hook.

The research also changes one assumption in the original brief: GLesmos is relevant as an integration precedent, but its present implementation is an auxiliary WebGL canvas composited back into Desmos 2D, not shared-context drawing. A 3D renderer hook would therefore be genuinely new and substantially more fragile.

---

## Sources consulted

1. ParaView 5.13.2 User Guide, “Filtering Data” — glyph modes, uniform spatial/surface/volume sampling: https://docs.paraview.org/en/v5.13.2/UsersGuide/filteringData.html
2. ParaView 5.13.1 CFD tutorial — slices, stream tracers, tubes, glyphs, divergence/vorticity: https://docs.paraview.org/en/v5.13.1/Tutorials/ClassroomTutorials/targetedComputationFluidDynamics.html
3. VisIt User Manual, Vector Plot — fixed-count/stride thinning: https://visit-sphinx-github-user-manual.readthedocs.io/en/develop/using_visit/Plots/PlotTypes/VectorPlot.html
4. VisIt Aneurysm tutorial — stride, magnitude color, cylinder arrow body, high geometry quality, flux workflow: https://visit-sphinx-github-user-manual.readthedocs.io/en/develop/tutorials/Aneurysm.html
5. Wolfram Language `VectorPlot3D` — fixed-length default, magnitude color, scaling, Arrow3D/Tube/Segment markers: https://reference.wolfram.com/language/ref/VectorPlot3D.html
6. Matplotlib `Axes3D.quiver` — length, head ratio, pivot, normalization: https://matplotlib.org/stable/api/_as_gen/mpl_toolkits.mplot3d.axes3d.Axes3D.quiver.html
7. McGuire & Bavoil, “Weighted Blended Order-Independent Transparency,” JCGT 2013: https://www.jcgt.org/published/0002/02/09/
8. MDN `EXT_color_buffer_float`: https://developer.mozilla.org/en-US/docs/Web/API/EXT_color_buffer_float
9. Desmos Help, Vectors and Point Operations: https://help.desmos.com/hc/en-us/articles/20846515614861-Vectors-and-Point-Operations
10. Desmos Help, Lists: https://help.desmos.com/hc/en-us/articles/4407889068557-Lists
11. Desmos Help, Custom Colors: https://help.desmos.com/hc/en-us/articles/4406795899533-Custom-Colors
12. College Board, AP Physics C: Electricity and Magnetism: https://apcentral.collegeboard.org/courses/ap-physics-c-electricity-and-magnetism
13. College Board, AP Physics 2: https://apcentral.collegeboard.org/courses/ap-physics-2
14. DesModder GLesmos source inspected through GitHub connector: `src/plugins/GLesmos/{glesmosCanvas.ts,drawGLesmosSketchToCtx.ts,shaders.ts,index.ts}` in https://github.com/DesModder/DesModder
