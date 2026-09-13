import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeGolden, DEFAULT_GOLDEN_PATH } from "./golden.ts";

describe("golden result hashes", () => {
  it("match the committed file", () => {
    const committed = JSON.parse(readFileSync(DEFAULT_GOLDEN_PATH, "utf8"));
    expect(committed, "run `pnpm --filter @regolith-rail/cli start golden`").toEqual(
      computeGolden(),
    );
  });
});
