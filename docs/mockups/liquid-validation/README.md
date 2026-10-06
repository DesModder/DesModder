# Liquid validation

`liquid.cjs` is the CPU reference for the liquid in `../liquid-mockup.html`
(the page inlines the same solver beside its WebGL2 twin). Each script runs one
check against a real experiment or exact theory, in a 1 m tank of water. Run
them with `node`; settings come from environment variables.

| Script        | Checks                                                                             | Reference                                      |
| ------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------- |
| `dam.cjs`     | dam-break front, a = 15, 30, 45 cells (`TAU`, `GA`, argument a)                    | Martin & Moyce (1952)                          |
| `rise.cjs`    | a 6.3 cm air bubble rising (`NX`, `INSTANT`, `NOFILL`, `NOCLOSE`, `MINB`, `GAUGE`) | Collins (1965): V = 0.58 √(g d)                |
| `wave.cjs`    | standing wave, mode 2, 30 cm deep, 2 cm high (`SMAG`, `NX`, `TAU`)                 | linear theory: T = 0.819 s, damping negligible |
| `wall.cjs`    | a slab of water falling beside a wall (`SLIP`, `WIDTH`, `MID`)                     | free fall: the wall grips only √(νt) ≈ 0.5 mm  |
| `physics.cjs` | dam break and pour with old or new physics (`SCENE`, `OLD`, `SLIP`, `NX`)          | the above, plus kinetic energy and peak speed  |

What they showed (6 mm cells unless stated):

- **Front speed** late in the dam break: 1.31 √(gH) against 1.32 measured.
- **Standing wave**: period 0.831 s against 0.819. But it loses 13% of its
  height a period at 6 mm and 4.8% at 3 mm, where real water loses under 1%: the
  free surface is smeared over a few cells. Not the eddy viscosity, collision,
  bubbles or fill rule; only finer cells help.
- **Walls**: bounce-back stops the first cell, so a 1.5 cm film fell 38% as far
  as free fall (a 3 cm slab 74%). A slip wall with log-law friction
  (Malaspinas & Sagaut's idea, κ 0.41, B 5.2) gives 80% and 93%. In open air the
  same slabs fall 89% and 98%.
- **Air pockets**: held at one atmosphere, a 6 cm pocket under 30 cm of water
  imploded in 0.14 s and stirred the water at 0.3–0.5 m/s for seconds.
- **Ideal-gas bubbles** (Thürey, Körner, Anderl: each enclosed region keeps p·V,
  labelled and matched each step) stop the implosion. The fixes it needed:

  - p·V must not be rescaled by volume over gas cells, or it grows each step.
  - A pocket pinching off the open air starts at one atmosphere over its whole
    volume.
  - A splitting bubble shares p·V by volume, not cells. By cells, small parts
    were born at 0.57 atm and threw water at 10 m/s.
  - Flag consistency (Thürey: a surface cell with no gas beside it becomes
    liquid) instead of slow filling and pocket closing, which ate the gas.
  - Gauge pressure limited to ±0.15 atm: froth of a few gas cells swung to
    0.6–1.9 atm.

  With all of that the bubble keeps 74–106% of its gas, but it rises at 0.2 m/s
  against Collins' 0.46. More dissipation makes it rise faster (τ 0.51: 0.39
  m/s), so at water's viscosity 10-cell bubbles are too noisy to rise cleanly.

- **A local gas model** (gas mass per cell, diffusing to even out pressure)
  cannot stand in for per-bubble pressure. The liquid answers faster than gas
  diffuses, so the bubble stays stratified and does not rise (4 cm/s). The GPU
  needs per-region sums. EXT_float_blend, present on Iris Xe, allows them as a
  scatter-add to each region's root cell.
- **On the GPU** (`GpuLiquid.updateGas` in the mock-up) the regions are
  labelled in a shader and summed by that scatter. What it took:

  - **Gas in gas cells only.** Each region's gas is held only in its gas
    cells, shared evenly. Held in surface cells too, gas left whenever a
    surface cell lost its last gas neighbour (5% in five steps).
  - **Label by the top.** Regions take their highest cell index, the top. By
    the lowest, a rising bubble kept losing its label as it filled from below.
  - **Join, don't rename.** New gas cells join the region beside them. When
    each offered its own name, the growing top split off with no gas, and was
    given gas at one atmosphere, so the bubble grew sevenfold.
  - **Settle labels at the start.** Labels settle fully when a scene starts or
    walls change. Spread a cell per update, the open air took hundreds of steps
    to reach the floor. Meanwhile resharing gas between merging regions swung
    pressures ±15%, and 2% of an atmosphere outweighs 30 cells of water: the
    dam-break column was held back 18%.
  - **Update every fourth step.** The update cost as much as a whole step; the
    stiffest gas swing lasts about 80 steps.

  With these, the dam-break front is as without bubbles (X 4.10 against 4.02 at
  T 3.24, 6 mm), the still tank stays within 0.65% of ρgh, and mass holds
  to 1e-8. The 6.3 cm bubble keeps its gas for 0.4 s, rises at about 0.2 m/s,
  then breaks up. Five seconds into the pour, the water is no calmer with
  bubbles (3.2 J/m against 2.7 at 5 s). An apparent 30% calming went away once
  labels settled: it had been the label noise draining energy. Bubbles cost a
  quarter more GPU time, so Auto picks 8 mm cells instead of 6 mm.

- **Energy**: sliding walls leave the water livelier. Kinetic energy 2 s into
  the dam break is 11.5 J/m against 4.7 with gripping walls. Whether either
  matches real water needs measured energy decay; 2D also lacks the 3D
  turbulence that drains real water.
