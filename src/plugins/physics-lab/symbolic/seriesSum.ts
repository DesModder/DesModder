/**
 * What the Integral tab falls back to when there is no elementary
 * antiderivative: every term integrated the best way it can be.
 *
 * `e^{x²} + x` used to get nothing. The integrator refuses it, rightly, because
 * one term has no elementary antiderivative — and the series reader refused it
 * too, because it reads one function of a monomial and this is a sum. But the
 * sum is two problems. `x` integrates in closed form and `e^{x²}` has a series
 * with a general term, and the antiderivative is the one plus the other.
 *
 * So each term goes to the best of three answers, in order:
 *
 * 1. **Closed form**, from the integrator.
 * 2. **A series with a general term**, from `series.ts` — exact, and the sum is
 *    the function.
 * 3. **A truncated series**, from `powerSeries.ts` — exact coefficients to a
 *    stated order, and said to be exactly that.
 *
 * and the report says which term got which, because they are three different
 * kinds of claim and a reader deserves to know which one each part is.
 */
import { fold, topLevelTerms, type Node } from "../../../symbolic";
import { integrate, IntegrationError, joinSums } from "./integrate";
import {
  seriesAntiderivative,
  SeriesError,
  type SeriesAntiderivative,
} from "./series";
import { PowerSeriesError, truncatedAntiderivative } from "./powerSeries";

export type PartKind = "closed" | "series" | "truncated";

export interface SeriesFallback {
  /** Every part added up, with finite sums, ready to plot. */
  sum: Node;
  /** Closed parts plus the first few terms of each series, for reading. */
  partial: Node;
  /** The general term, when there is exactly one series with one. */
  term?: Node;
  /** Each term of the integrand and how it was integrated. */
  parts: { integrand: Node; kind: PartKind }[];
  /** Where the series parts converge, in words. */
  interval: string;
  /**
   * Set when a truncated series is part of the answer: the sum is then exact
   * only below `x^order`, and nothing here claims more.
   */
  order?: number;
}

/**
 * The fallback antiderivative of `node`, or `undefined` when some term has
 * none of the three.
 *
 * Returns `undefined` rather than a closed form when every term integrates in
 * closed form, since then there was nothing to fall back from.
 */
export function seriesFallback(
  node: Node,
  variable: string,
  terms: number
): SeriesFallback | undefined {
  const signed = topLevelTerms(fold(node));
  const parts: SeriesFallback["parts"] = [];
  const sums: Node[] = [];
  const partials: Node[] = [];
  const general: SeriesAntiderivative[] = [];
  const intervals = new Set<string>();
  let order: number | undefined;

  for (const { term, negated } of signed) {
    const sign = (value: Node): Node =>
      negated ? { type: "Negative", arg: value } : value;

    const closed = tryClosed(term, variable);
    if (closed !== undefined) {
      parts.push({ integrand: term, kind: "closed" });
      sums.push(sign(closed));
      partials.push(sign(closed));
      continue;
    }
    const series = tryGeneral(term, variable, terms);
    if (series !== undefined) {
      parts.push({ integrand: term, kind: "series" });
      sums.push(sign(series.sum));
      partials.push(sign(series.partial));
      general.push(series);
      intervals.add(series.interval);
      continue;
    }
    const truncated = tryTruncated(term, variable, terms);
    if (truncated === undefined) return undefined;
    parts.push({ integrand: term, kind: "truncated" });
    sums.push(sign(truncated.polynomial));
    partials.push(sign(truncated.partial));
    order =
      order === undefined ? truncated.order : Math.min(order, truncated.order);
    intervals.add("x near 0 (the radius is not worked out here)");
  }

  if (parts.every((part) => part.kind === "closed")) return undefined;

  return {
    // Added rather than folded, so the parts stay in the order the integrand
    // was written in.
    sum: joinSums(sums),
    partial: joinSums(partials),
    term:
      general.length === 1 && order === undefined ? general[0].term : undefined,
    parts,
    interval: [...intervals].join("; "),
    order,
  };
}

function tryClosed(term: Node, variable: string): Node | undefined {
  try {
    return integrate(term, variable);
  } catch (error) {
    if (error instanceof IntegrationError) return undefined;
    throw error;
  }
}

function tryGeneral(
  term: Node,
  variable: string,
  terms: number
): SeriesAntiderivative | undefined {
  try {
    return seriesAntiderivative(term, variable, terms);
  } catch (error) {
    if (error instanceof SeriesError) return undefined;
    throw error;
  }
}

function tryTruncated(term: Node, variable: string, terms: number) {
  try {
    return truncatedAntiderivative(term, variable, terms);
  } catch (error) {
    if (error instanceof PowerSeriesError) return undefined;
    throw error;
  }
}
