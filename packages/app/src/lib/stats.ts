/**
 * Summary statistics for batches. Confidence intervals use Student's t
 * distribution, with critical values from a table so only square roots are
 * needed.
 */

/** Two-sided 95% critical values of Student's t by degrees of freedom. */
const T_TABLE: [df: number, t: number][] = [
  [1, 12.706],
  [2, 4.303],
  [3, 3.182],
  [4, 2.776],
  [5, 2.571],
  [6, 2.447],
  [7, 2.365],
  [8, 2.306],
  [9, 2.262],
  [10, 2.228],
  [11, 2.201],
  [12, 2.179],
  [13, 2.16],
  [14, 2.145],
  [15, 2.131],
  [16, 2.12],
  [17, 2.11],
  [18, 2.101],
  [19, 2.093],
  [20, 2.086],
  [21, 2.08],
  [22, 2.074],
  [23, 2.069],
  [24, 2.064],
  [25, 2.06],
  [26, 2.056],
  [27, 2.052],
  [28, 2.048],
  [29, 2.045],
  [30, 2.042],
  [40, 2.021],
  [50, 2.009],
  [60, 2.0],
  [80, 1.99],
  [100, 1.984],
  [120, 1.98],
  [200, 1.972],
  [500, 1.965],
  [1000, 1.962],
];

/** Critical value for the largest tabulated degrees of freedom not above `df`, which errs wide. */
export function tCritical95(df: number): number {
  if (df < 1) return Number.POSITIVE_INFINITY;
  let value = 1.96;
  for (const [d, t] of T_TABLE) {
    if (d <= df) value = t;
    else break;
  }
  return df > 1000 ? 1.96 : value;
}

/** Linear interpolation between order statistics, as in most spreadsheet QUARTILE functions. */
export function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const a = sorted[lower] as number;
  const b = sorted[upper] as number;
  return a + (b - a) * (position - lower);
}

export interface Summary {
  n: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean: number;
  sd: number;
  /** 95% confidence interval for the mean. Equal to the mean when n is 1. */
  ciLow: number;
  ciHigh: number;
}

export function summarise(values: number[]): Summary {
  const n = values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const mean = n === 0 ? Number.NaN : values.reduce((a, b) => a + b, 0) / n;
  const variance =
    n > 1 ? values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / (n - 1) : 0;
  const sd = Math.sqrt(variance);
  const half = n > 1 ? tCritical95(n - 1) * (sd / Math.sqrt(n)) : 0;
  return {
    n,
    min: sorted[0] ?? Number.NaN,
    q1: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    q3: quantile(sorted, 0.75),
    max: sorted[n - 1] ?? Number.NaN,
    mean,
    sd,
    ciLow: mean - half,
    ciHigh: mean + half,
  };
}

export type Verdict = "better" | "worse" | "within noise";

export interface PairedDifference extends Summary {
  verdict: Verdict;
}

/**
 * Differences B − A, seed by seed. The difference is within noise when its
 * interval includes zero.
 */
export function pairedDifference(
  a: number[],
  b: number[],
  lowerIsBetter: boolean,
): PairedDifference {
  if (a.length !== b.length) throw new Error("paired samples must have the same length");
  const summary = summarise(b.map((value, i) => value - (a[i] as number)));
  const includesZero = summary.ciLow <= 0 && summary.ciHigh >= 0;
  const allZero = summary.min === 0 && summary.max === 0;
  const verdict: Verdict =
    includesZero || allZero
      ? "within noise"
      : summary.mean < 0 === lowerIsBetter
        ? "better"
        : "worse";
  return { ...summary, verdict };
}
