import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { batchSeeds, hashString32, Random, streamFor } from "./random.ts";

describe("xoshiro128**", () => {
  it("matches the reference algorithm for state (1, 2, 3, 4)", () => {
    const rng = new Random(1, 2, 3, 4);
    expect([rng.nextU32(), rng.nextU32(), rng.nextU32()]).toEqual([11520, 0, 23621760]);
  });

  it("produces a recorded sequence from a seed", () => {
    const rng = Random.fromSeed(42);
    const values = Array.from({ length: 5 }, () => rng.nextU32());
    expect(values).toMatchInlineSnapshot(`
      [
        2837322924,
        544945897,
        2818343140,
        1596644824,
        1085751955,
      ]
    `);
  });
});

describe("hashString32", () => {
  it("matches FNV-1a reference values", () => {
    expect(hashString32("")).toBe(0x811c9dc5);
    expect(hashString32("a")).toBe(0xe40c292c);
    expect(hashString32("foobar")).toBe(0xbf9cf968);
  });
});

describe("integer ranges", () => {
  it("stays within bounds", () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer({ min: -1_000_000, max: 1_000_000 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        (seed, lo, width) => {
          const rng = Random.fromSeed(seed);
          for (let i = 0; i < 20; i++) {
            const v = rng.int(lo, lo + width);
            if (v < lo || v > lo + width || !Number.isInteger(v)) return false;
          }
          return true;
        },
      ),
    );
  });

  it("covers a small range evenly", () => {
    const rng = Random.fromSeed(7);
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 40_000; i++) {
      const bucket = rng.int(0, 3);
      counts[bucket] = (counts[bucket] ?? 0) + 1;
    }
    for (const count of counts) expect(Math.abs(count - 10_000)).toBeLessThan(400);
  });

  it("gives probabilities in parts per million", () => {
    const rng = Random.fromSeed(3);
    expect(Array.from({ length: 100 }, () => rng.chancePpm(0)).some(Boolean)).toBe(false);
    expect(Array.from({ length: 100 }, () => rng.chancePpm(1_000_000)).every(Boolean)).toBe(true);
  });

  it("gives fractions in [0, 1)", () => {
    const rng = Random.fromSeed(9);
    for (let i = 0; i < 1000; i++) {
      const f = rng.fraction();
      expect(f >= 0 && f < 1).toBe(true);
    }
  });
});

describe("streams and batches", () => {
  it("gives different streams different sequences and repeats a stream exactly", () => {
    const a = streamFor(1, "consumer:Dome:Metals:0");
    const b = streamFor(1, "consumer:Dome:Food:0");
    const again = streamFor(1, "consumer:Dome:Metals:0");
    const seqA = Array.from({ length: 4 }, () => a.nextU32());
    const seqB = Array.from({ length: 4 }, () => b.nextU32());
    const seqAgain = Array.from({ length: 4 }, () => again.nextU32());
    expect(seqA).toEqual(seqAgain);
    expect(seqA).not.toEqual(seqB);
  });

  it("derives batch seeds from base seed and count only", () => {
    expect(batchSeeds(42, 50)).toEqual(batchSeeds(42, 50));
    expect(batchSeeds(42, 60).slice(0, 50)).toEqual(batchSeeds(42, 50));
    expect(new Set(batchSeeds(42, 1000)).size).toBe(1000);
    expect(batchSeeds(42, 3)).toMatchInlineSnapshot(`
      [
        3747742679,
        3730965060,
        3781297917,
      ]
    `);
  });
});
