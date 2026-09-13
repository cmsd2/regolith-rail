import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeGolden, DEFAULT_GOLDEN_PATH } from "./golden.ts";

describe("golden result hashes", () => {
  it("match the committed file", async () => {
    const committed = JSON.parse(readFileSync(DEFAULT_GOLDEN_PATH, "utf8"));
    expect(committed, "run `pnpm golden`").toEqual(await computeGolden());
  }, 300_000);

  it("give the Lua baseline the same results as the reference", async () => {
    const hashes = await computeGolden();
    for (const [key, hash] of Object.entries(hashes)) {
      if (!key.startsWith("lua:naive/")) continue;
      expect(hash, key).toBe(hashes[key.replace("lua:naive/", "reference:naive/")]);
    }
  }, 300_000);
});
