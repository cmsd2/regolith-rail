import { describe, expect, it } from "vitest";
import { formatAmount, formatDuration, formatGameTime } from "./format.ts";

describe("formatting", () => {
  it("shows milli-units as units", () => {
    expect(formatAmount(30_000)).toBe("30");
    expect(formatAmount(12_345)).toBe("12.3");
  });

  it("shows game time as sol and clock time", () => {
    expect(formatGameTime(0)).toBe("Sol 1, 00:00");
    expect(formatGameTime(86_400_000 + 3_600_000 * 14 + 60_000 * 5)).toBe("Sol 2, 14:05");
  });

  it("shows durations in the largest sensible unit", () => {
    expect(formatDuration(1.5 * 86_400_000)).toBe("1.5 sols");
    expect(formatDuration(2 * 3_600_000)).toBe("2 h");
    expect(formatDuration(90_000)).toBe("2 min");
  });
});
