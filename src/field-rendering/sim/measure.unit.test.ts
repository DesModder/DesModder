import { lastCycle, sheddingPeriod, type Sample } from "./measure";

const wave = (period: number, amplitude: number, steps: number, offset = 0) =>
  Array.from(
    { length: steps / 10 },
    (_, n): Sample => ({
      step: n * 10,
      value: offset + amplitude * Math.sin((2 * Math.PI * n * 10) / period),
    })
  );

describe("shedding statistics", () => {
  test("a clean sine gives its own period", () => {
    const result = sheddingPeriod(wave(1327, 0.5, 20000, 0.01));
    expect("period" in result).toBe(true);
    if (!("period" in result)) return;
    expect(result.period).toBeCloseTo(1327, 0);
    expect(result.periodVariation).toBeLessThan(1e-3);
    expect(result.cycles).toBeGreaterThanOrEqual(13);
  });

  test("a steady wake, too few cycles, or an irregular one, gives a reason", () => {
    expect(sheddingPeriod(wave(1000, 0.001, 20000))).toEqual({
      reason: "The lift is not swinging: the wake is steady.",
    });
    expect("reason" in sheddingPeriod(wave(1000, 0.5, 2500))).toBe(true);
    const irregular = wave(1000, 0.5, 20000).map((s) => ({
      step: s.step,
      value: s.value + 0.4 * Math.sin(s.step / 97),
    }));
    expect("reason" in sheddingPeriod(irregular)).toBe(true);
  });

  test("the last cycle's extremes and peak-to-peak", () => {
    const series = wave(1000, 2, 10000, 3);
    const result = sheddingPeriod(series);
    if (!("period" in result)) throw new Error(result.reason);
    const cycle = lastCycle(series, result.crossings);
    expect(cycle.max).toBeCloseTo(5, 3);
    expect(cycle.min).toBeCloseTo(1, 3);
    expect(cycle.peakToPeak).toBeCloseTo(4, 3);
    expect(cycle.mean).toBeCloseTo(3, 2);
  });
});
