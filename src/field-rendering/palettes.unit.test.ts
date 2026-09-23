import {
  MAX_PALETTE_STOPS,
  NO_COLOR_ADJUST,
  adjustRGB,
  adjustedHSV,
  isNeutralAdjust,
  PALETTE_IDS,
  PALETTES,
  paletteCSSGradient,
  paletteLatex,
  paletteStops,
  paletteUniforms,
} from "./palettes";

/** Plain decimals, the way the generator writes numbers into a folder. */
const number = (value: number) => String(value);

/**
 * Evaluates one channel of the emitted LaTeX the way Desmos would.
 *
 * The expression is only sums, products, division and min/max, so translating
 * it to JavaScript is a search and replace — which is the point: if the emitted
 * form ever grows something else, this stops working and says so.
 */
function evaluateChannel(latex: string, t: number) {
  const js = latex
    .replace(/\\operatorname\{rgb\}/g, "")
    .replace(/\\left\(/g, "(")
    .replace(/\\right\)/g, ")")
    .replace(/\\min/g, "Math.min")
    .replace(/\\max/g, "Math.max")
    .replace(/\bt\b/g, `(${t})`)
    // Desmos multiplies by juxtaposition, `210\left(...`. JavaScript does not,
    // and would read it as a call.
    .replace(/(\d|\))\s*\(/g, "$1*(")
    .replace(/Math\.min\*\(/g, "Math.min(")
    .replace(/Math\.max\*\(/g, "Math.max(");
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return Function(`"use strict"; return [${js.slice(1, -1)}];`)() as number[];
}

describe("Vector Tools palettes", () => {
  test("every palette is a ramp the shader has room for", () => {
    for (const id of PALETTE_IDS) {
      const { stops } = PALETTES[id];
      if (stops === undefined) continue;
      expect(stops.length).toBeLessThanOrEqual(MAX_PALETTE_STOPS);
      expect(stops[0].at).toBe(0);
      expect(stops[stops.length - 1].at).toBe(1);
      // Ascending, so the clamped segments tile the range instead of overlapping.
      for (let i = 1; i < stops.length; i++) {
        expect(stops[i].at).toBeGreaterThan(stops[i - 1].at);
      }
      for (const stop of stops) {
        for (const channel of stop.rgb) {
          expect(channel).toBeGreaterThanOrEqual(0);
          expect(channel).toBeLessThanOrEqual(255);
        }
      }
    }
  });

  test("the emitted expression passes through every stop", () => {
    for (const id of PALETTE_IDS) {
      if (id === "direction-hue") continue;
      const latex = paletteLatex(id, "t", number);
      for (const stop of paletteStops(id)) {
        const rgb = evaluateChannel(latex, stop.at);
        expect({ id, at: stop.at, rgb: rgb.map(Math.round) }).toEqual({
          id,
          at: stop.at,
          rgb: [...stop.rgb],
        });
      }
    }
  });

  test("stays inside the channel range across the whole ramp", () => {
    for (const id of PALETTE_IDS) {
      if (id === "direction-hue") continue;
      const latex = paletteLatex(id, "t", number);
      for (let step = 0; step <= 40; step++) {
        for (const channel of evaluateChannel(latex, step / 40)) {
          expect(channel).toBeGreaterThanOrEqual(-0.001);
          expect(channel).toBeLessThanOrEqual(255.001);
        }
      }
    }
  });

  test("a sequential ramp never passes through gray", () => {
    // This is the bug these palettes replaced. A straight RGB line from dark
    // blue to yellow crosses the desaturated middle of the cube, so the old
    // ramps went through mud at t=0.5 and the arrows read as flat olive.
    for (const id of ["spectral", "sequential-a", "sequential-b"] as const) {
      const latex = paletteLatex(id, "t", number);
      let leastSaturated = 1;
      for (let step = 0; step <= 40; step++) {
        const [r, g, b] = evaluateChannel(latex, step / 40);
        const max = Math.max(r, g, b);
        leastSaturated = Math.min(
          leastSaturated,
          max === 0 ? 0 : (max - Math.min(r, g, b)) / max
        );
      }
      expect({ id, saturated: leastSaturated > 0.25 }).toEqual({
        id,
        saturated: true,
      });
    }
  });

  test("the diverging ramp goes pale in the middle, not dark", () => {
    // A diverging ramp *should* reach neutral at its midpoint — that is how the
    // value with no signal recedes. What it must not do is reach a dark
    // neutral, which reads as "something is here" rather than "nothing is".
    const latex = paletteLatex("blue-red", "t", number);
    const [r, g, b] = evaluateChannel(latex, 0.5);
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(8);
    expect(Math.min(r, g, b)).toBeGreaterThan(200);
  });

  test("hands the shader a full array whatever the palette's length", () => {
    for (const id of PALETTE_IDS) {
      const { positions, colors, count } = paletteUniforms(id);
      expect(positions).toHaveLength(MAX_PALETTE_STOPS);
      expect(colors).toHaveLength(MAX_PALETTE_STOPS * 3);
      expect(count).toBeLessThanOrEqual(MAX_PALETTE_STOPS);
      // Padding repeats the last stop, so a short palette cannot read garbage.
      expect(positions[MAX_PALETTE_STOPS - 1]).toBe(1);
    }
  });

  test("matches the stops it was built from, in shader units", () => {
    const { positions, colors, count } = paletteUniforms("spectral");
    const stops = paletteStops("spectral");
    expect(count).toBe(stops.length);
    for (let i = 0; i < stops.length; i++) {
      expect(positions[i]).toBeCloseTo(stops[i].at, 6);
      for (let channel = 0; channel < 3; channel++) {
        expect(colors[i * 3 + channel]).toBeCloseTo(
          stops[i].rgb[channel] / 255,
          5
        );
      }
    }
  });

  test("the swatch shows the ramp it selects", () => {
    // The picker draws the palette rather than naming it, which is only worth
    // doing while the drawing is the same ramp the field gets. This is the
    // third emission of the same stops, and the one a person looks at.
    for (const id of PALETTE_IDS) {
      const gradient = paletteCSSGradient(id);
      expect(gradient.startsWith("linear-gradient(to right, ")).toBe(true);
      if (PALETTES[id].stops === undefined) {
        // The hue wheel has no stops, so it is sampled; it still has to be a
        // ramp with something in the middle rather than two endpoints.
        expect(gradient.split("rgb(").length).toBeGreaterThan(4);
        continue;
      }
      for (const stop of paletteStops(id)) {
        expect(gradient).toContain(
          `rgb(${stop.rgb[0]},${stop.rgb[1]},${stop.rgb[2]}) ${Math.round(
            stop.at * 100
          )}%`
        );
      }
    }
  });

  test("a cyclic palette has no seam", () => {
    // `direction` colors an angle, and 359 degrees is next to 1 degree. A ramp
    // whose ends do not meet draws a hard edge across the field along whichever
    // ray happens to be zero, which reads as a feature of the field that is not
    // there. Claiming to be cyclic is therefore a claim about the two ends.
    const cyclic = PALETTE_IDS.filter((id) => PALETTES[id].cyclic);
    expect(cyclic.length).toBeGreaterThan(1);
    for (const id of cyclic) {
      const { stops } = PALETTES[id];
      if (stops === undefined) continue;
      expect({ id, ends: [...stops[0].rgb] }).toEqual({
        id,
        ends: [...stops[stops.length - 1].rgb],
      });
    }
  });
});

describe("saturation and contrast", () => {
  /** The piecewise-linear walk along a set of stops, on the CPU. */
  function walk(
    stops: readonly { at: number; rgb: readonly [number, number, number] }[],
    t: number
  ) {
    const rgb = [...stops[0].rgb] as number[];
    for (let i = 1; i < stops.length; i++) {
      const span = Math.max(stops[i].at - stops[i - 1].at, 1e-6);
      const along = Math.min(1, Math.max(0, (t - stops[i - 1].at) / span));
      for (let c = 0; c < 3; c++) {
        rgb[c] += (stops[i].rgb[c] - stops[i - 1].rgb[c]) * along;
      }
    }
    return rgb;
  }

  test("neutral leaves every colour exactly where it was", () => {
    // The default has to be the identity, or turning the feature on for the
    // first time would move a picture somebody had already settled.
    expect(isNeutralAdjust(NO_COLOR_ADJUST)).toBe(true);
    for (const id of PALETTE_IDS) {
      for (const stop of paletteStops(id)) {
        expect(adjustRGB(stop.rgb)).toEqual([...stop.rgb]);
      }
      expect(paletteLatex(id, "t", number, NO_COLOR_ADJUST)).toBe(
        paletteLatex(id, "t", number)
      );
    }
  });

  test("no saturation is grey, and grey is where the luminance is", () => {
    // Not the average of the channels: a green of 200 is much brighter than a
    // blue of 200, and averaging turns a ramp's hues into a flat band that
    // does not match its brightness.
    const grey = adjustRGB([200, 40, 10], { saturation: 0, contrast: 1 });
    expect(grey[0]).toBe(grey[1]);
    expect(grey[1]).toBe(grey[2]);
    expect(grey[0]).toBe(Math.round(200 * 0.2126 + 40 * 0.7152 + 10 * 0.0722));
  });

  test("contrast pushes away from mid-grey and leaves mid-grey alone", () => {
    expect(adjustRGB([128, 128, 128], { saturation: 1, contrast: 2 })).toEqual([
      129, 129, 129,
    ]);
    const [dark] = adjustRGB([60, 60, 60], { saturation: 1, contrast: 1.5 });
    expect(dark).toBeLessThan(60);
    const [light] = adjustRGB([200, 200, 200], {
      saturation: 1,
      contrast: 1.5,
    });
    expect(light).toBeGreaterThan(200);
  });

  test("nothing can be pushed outside a colour", () => {
    for (const saturation of [0, 1, 2]) {
      for (const contrast of [0.5, 1, 2]) {
        for (const id of PALETTE_IDS) {
          for (const stop of paletteStops(id)) {
            for (const channel of adjustRGB(stop.rgb, {
              saturation,
              contrast,
            })) {
              expect(channel).toBeGreaterThanOrEqual(0);
              expect(channel).toBeLessThanOrEqual(255);
            }
          }
        }
      }
    }
  });

  test("the generated expression is the ramp through the adjusted stops", () => {
    // Every emitter pushes the stops and then interpolates, including the
    // shader -- see `ColorAdjust`. So the LaTeX Desmos is handed has to be
    // exactly the ramp through `adjustRGB` of each stop, at settings strong
    // enough that several of them clamp. Evaluating it is the only way to know
    // that, since the emitted form is a sum of clamped segments rather than a
    // list of colours.
    const adjust = { saturation: 1.35, contrast: 1.2 };
    for (const id of ["spectral", "turbo", "coolwarm"] as const) {
      const latex = paletteLatex(id, "t", number, adjust);
      const pushed = paletteStops(id).map((stop) => ({
        at: stop.at,
        rgb: adjustRGB(stop.rgb, adjust),
      }));
      for (const t of [0, 0.17, 0.5, 0.83, 1]) {
        const emitted = evaluateChannel(latex, t);
        const expected = walk(pushed, t);
        for (let c = 0; c < 3; c++) {
          expect(emitted[c]).toBeCloseTo(expected[c], 6);
        }
      }
    }
  });

  test("adjusting before and after interpolating agree until something clamps", () => {
    // Why the order had to be settled rather than left to each emitter. The
    // adjustment is affine and interpolation is linear, so the two orders are
    // the same function -- right up to the clamp, which is not affine.
    const gentle = { saturation: 0.85, contrast: 0.9 };
    const strong = { saturation: 1.8, contrast: 1.6 };
    const before = (adjust: typeof gentle, t: number) =>
      walk(
        paletteStops("turbo").map((stop) => ({
          at: stop.at,
          rgb: adjustRGB(stop.rgb, adjust),
        })),
        t
      );
    const after = (adjust: typeof gentle, t: number) =>
      adjustRGB(
        walk(paletteStops("turbo"), t) as [number, number, number],
        adjust
      );

    for (const t of [0.1, 0.35, 0.5, 0.72, 0.95]) {
      for (let c = 0; c < 3; c++) {
        // One level, not zero: `adjustRGB` rounds each stop to a whole
        // channel, and adjusting first rounds before interpolating.
        const gap = Math.abs(before(gentle, t)[c] - after(gentle, t)[c]);
        expect({ t, c, within: gap <= 1 }).toEqual({ t, c, within: true });
      }
    }
    // And they really do diverge when it is pushed, which is what makes
    // picking one of the two orders a decision rather than a formality.
    const apart = [0.1, 0.35, 0.5, 0.72, 0.95].some((t) =>
      [0, 1, 2].some(
        (c) => Math.abs(before(strong, t)[c] - after(strong, t)[c]) > 8
      )
    );
    expect(apart).toBe(true);
  });

  test("the swatch is drawn at the settings the field is drawn at", () => {
    // A picker that showed the unadjusted ramp would be offering a choice
    // between pictures none of which is the one about to appear.
    const adjust = { saturation: 0, contrast: 1 };
    const gradient = paletteCSSGradient("spectral", adjust);
    for (const stop of paletteStops("spectral")) {
      const [r, g, b] = adjustRGB(stop.rgb, adjust);
      expect(r).toBe(g);
      expect(gradient).toContain(`rgb(${r},${g},${b})`);
    }
  });

  test("the hue wheel takes the approximation hsv can express", () => {
    // It has no stops to push. Saturation scales hsv's own, and contrast moves
    // its value; both clamp, so a strong setting cannot ask for a colour
    // outside the wheel.
    expect(adjustedHSV(0.82, 0.9, NO_COLOR_ADJUST)).toEqual({
      saturation: 0.82,
      value: 0.9,
    });
    expect(adjustedHSV(0.82, 0.9, { saturation: 0.5, contrast: 1 })).toEqual({
      saturation: 0.41,
      value: 0.9,
    });
    expect(adjustedHSV(0.82, 0.9, { saturation: 2, contrast: 2 })).toEqual({
      saturation: 1,
      value: 1,
    });
  });
});
