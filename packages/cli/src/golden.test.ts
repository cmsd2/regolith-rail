import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { computeGoldens, DEFAULT_GOLDEN_PATH, FORMAT1_GOLDEN_PATH } from "./golden.ts";

const read = (path: URL) => JSON.parse(readFileSync(path, "utf8")) as Record<string, string>;

describe("golden result hashes", () => {
  let goldens: Awaited<ReturnType<typeof computeGoldens>>;
  beforeAll(async () => {
    goldens = await computeGoldens();
  }, 300_000);

  it("match the committed file", () => {
    expect(read(DEFAULT_GOLDEN_PATH), "run `pnpm golden`").toEqual(goldens.current);
  });

  it("match the results recorded before scenario format 2, over the fields that existed then", () => {
    expect(read(FORMAT1_GOLDEN_PATH)).toEqual(goldens.format1);
  });

  it("give the Lua baseline the same results as the reference", () => {
    for (const [key, hash] of Object.entries(goldens.current)) {
      if (!key.startsWith("lua:naive/")) continue;
      expect(hash, key).toBe(goldens.current[key.replace("lua:naive/", "reference:naive/")]);
    }
  });
});
