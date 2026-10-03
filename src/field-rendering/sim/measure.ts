/**
 * Turning a force history into the numbers a benchmark quotes.
 *
 * A shedding cylinder's lift swings between two values with a steady period.
 * The Strouhal number is that period's inverse, made dimensionless:
 * St = D / (U T). Drag swings at twice the frequency around its mean.
 *
 * GPT's third round set the acceptance rule this follows. A period counts only
 * after at least three full cycles, a lift that swings by more than a
 * threshold, and periods that agree to 2%. Below that, the signal is
 * transient or noise, and the tab says "settling" rather than quoting a
 * number. The period is the median of the rising zero crossings of the lift
 * about its own mean, each crossing placed by linear interpolation.
 */

export interface Sample {
  step: number;
  value: number;
}

export interface Shedding {
  /** Median period, in steps, of the accepted cycles. */
  period: number;
  /** Coefficient of variation of the periods. */
  periodVariation: number;
  cycles: number;
  /** Rising crossings, in steps, that bound the cycles. */
  crossings: number[];
}

/**
 * The shedding period of a lift history, or a reason it has none yet. Pass
 * only the part of the history after start-up.
 */
export function sheddingPeriod(
  lift: readonly Sample[],
  { minimumCycles = 3, minimumHalfRange = 0.005, maximumVariation = 0.02 } = {}
): Shedding | { reason: string } {
  if (lift.length < 4) return { reason: "Not enough samples yet." };
  let mean = 0;
  let low = Infinity;
  let high = -Infinity;
  for (const { value } of lift) {
    mean += value;
    low = Math.min(low, value);
    high = Math.max(high, value);
  }
  mean /= lift.length;
  if ((high - low) / 2 < minimumHalfRange)
    return { reason: "The lift is not swinging: the wake is steady." };
  const crossings: number[] = [];
  for (let n = 1; n < lift.length; n++) {
    const a = lift[n - 1].value - mean;
    const b = lift[n].value - mean;
    if (a < 0 && b >= 0) {
      const t = a / (a - b);
      crossings.push(lift[n - 1].step + t * (lift[n].step - lift[n - 1].step));
    }
  }
  const cycles = crossings.length - 1;
  if (cycles < minimumCycles)
    return { reason: `Only ${Math.max(0, cycles)} full cycles so far.` };
  const periods = crossings.slice(1).map((c, n) => c - crossings[n]);
  const sorted = [...periods].sort((x, y) => x - y);
  const median = sorted[Math.floor(sorted.length / 2)];
  const average = periods.reduce((s, p) => s + p, 0) / periods.length;
  const variance =
    periods.reduce((s, p) => s + (p - average) ** 2, 0) / periods.length;
  const periodVariation = Math.sqrt(variance) / average;
  if (periodVariation > maximumVariation)
    return { reason: "The cycles do not repeat steadily yet." };
  return { period: median, periodVariation, cycles, crossings };
}

/**
 * Extremes and means of a quantity over the last whole cycle, from the
 * second-to-last to the last crossing.
 */
export function lastCycle(
  series: readonly Sample[],
  crossings: readonly number[]
): { min: number; max: number; mean: number; peakToPeak: number } {
  const from = crossings[crossings.length - 2];
  const to = crossings[crossings.length - 1];
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let count = 0;
  for (const { step, value } of series) {
    if (step < from || step > to) continue;
    min = Math.min(min, value);
    max = Math.max(max, value);
    sum += value;
    count++;
  }
  return { min, max, mean: sum / count, peakToPeak: max - min };
}
