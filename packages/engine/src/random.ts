/**
 * Deterministic randomness using only 32-bit integer operations, so every
 * JavaScript engine produces the same sequence.
 */

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** FNV-1a over the UTF-16 code units of a string, as an unsigned 32-bit integer. */
export function hashString32(text: string, offset = FNV_OFFSET): number {
  let hash = offset;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/** splitmix32 step: returns the next state and an output word. */
function splitmix32(state: number): [next: number, output: number] {
  const next = (state + 0x9e3779b9) | 0;
  let z = next;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
  z ^= z >>> 16;
  return [next, z >>> 0];
}

const rotl = (x: number, k: number) => (x << k) | (x >>> (32 - k));

/** xoshiro128** generator. */
export class Random {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;

  constructor(s0: number, s1: number, s2: number, s3: number) {
    if ((s0 | s1 | s2 | s3) === 0) throw new Error("xoshiro128** state must not be all zero");
    this.s0 = s0 | 0;
    this.s1 = s1 | 0;
    this.s2 = s2 | 0;
    this.s3 = s3 | 0;
  }

  /** Builds a generator from a single 32-bit seed. */
  static fromSeed(seed: number): Random {
    let state = seed | 0;
    const words: number[] = [];
    for (let i = 0; i < 4; i++) {
      const [next, output] = splitmix32(state);
      state = next;
      words.push(output);
    }
    const [a = 1, b = 0, c = 0, d = 0] = words;
    return (a | b | c | d) === 0 ? new Random(1, 0, 0, 0) : new Random(a, b, c, d);
  }

  /** Next unsigned 32-bit integer. */
  nextU32(): number {
    const result = Math.imul(rotl(Math.imul(this.s1, 5), 7), 9);
    const t = this.s1 << 11;
    this.s2 ^= this.s0;
    this.s3 ^= this.s1;
    this.s1 ^= this.s2;
    this.s0 ^= this.s3;
    this.s2 ^= t;
    this.s3 = rotl(this.s3, 11);
    return result >>> 0;
  }

  /** Uniform integer in [lo, hi], inclusive, without modulo bias. */
  int(lo: number, hi: number): number {
    const range = hi - lo + 1;
    if (!Number.isInteger(lo) || !Number.isInteger(hi) || range < 1 || range > 0x1_0000_0000) {
      throw new Error(`invalid integer range [${lo}, ${hi}]`);
    }
    const limit = 0x1_0000_0000 - (0x1_0000_0000 % range);
    for (;;) {
      const r = this.nextU32();
      if (r < limit) return lo + (r % range);
    }
  }

  /** True with the given probability in parts per million. */
  chancePpm(ppm: number): boolean {
    return this.int(0, 999_999) < ppm;
  }

  /** Number in [0, 1) with 32 bits of resolution. */
  fraction(): number {
    return this.nextU32() / 0x1_0000_0000;
  }
}

/** Generator for a named stream, independent of every other stream name. */
export function streamFor(runSeed: number, name: string): Random {
  return Random.fromSeed(hashString32(`${runSeed}:${name}`));
}

/** Seeds for a batch, derived only from the base seed and position. */
export function batchSeeds(baseSeed: number, count: number): number[] {
  const seeds: number[] = [];
  for (let i = 0; i < count; i++) seeds.push(hashString32(`batch:${baseSeed}:${i}`));
  return seeds;
}
