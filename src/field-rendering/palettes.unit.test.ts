import {
  MAX_PALETTE_STOPS,
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
