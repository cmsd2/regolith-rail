import { describe, expect, it } from "vitest";
import { pairedDifference, quantile, summarise, tCritical95 } from "./stats.ts";

describe("statistics", () => {
  it("interpolates quantiles", () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([1, 2, 3, 4, 5], 0.25)).toBe(2);
  });

  it("uses conservative t critical values", () => {
    expect(tCritical95(1)).toBe(12.706);
    expect(tCritical95(35)).toBe(2.042);
    expect(tCritical95(99)).toBe(1.99);
    expect(tCritical95(5000)).toBe(1.96);
  });

  it("summarises a known sample", () => {
    // Mean 5, sample standard deviation 2.13809, t(7) = 2.365.
    const s = summarise([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(s).toMatchObject({ n: 8, min: 2, median: 4.5, max: 9, mean: 5 });
    expect(s.sd).toBeCloseTo(2.13809, 4);
    expect(s.ciLow).toBeCloseTo(5 - (2.365 * 2.13809) / Math.sqrt(8), 4);
    expect(s.ciHigh).toBeCloseTo(5 + (2.365 * 2.13809) / Math.sqrt(8), 4);
  });

  it("calls identical policies within noise", () => {
    const values = [3, 1, 4, 1, 5, 9, 2, 6];
    const diff = pairedDifference(values, [...values], true);
    expect(diff.mean).toBe(0);
    expect(diff.verdict).toBe("within noise");
  });

  it("recognises a consistent improvement", () => {
    const a = [10, 12, 11, 13, 12, 10, 11];
    const b = a.map((v, i) => v - 5 - (i % 2));
    expect(pairedDifference(a, b, true).verdict).toBe("better");
    expect(pairedDifference(a, b, false).verdict).toBe("worse");
  });

  it("calls a noisy difference within noise", () => {
    const a = [10, 20, 10, 20, 10, 20];
    const b = [20, 10, 20, 10, 20, 11];
    expect(pairedDifference(a, b, true).verdict).toBe("within noise");
  });
});
