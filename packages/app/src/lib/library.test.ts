import { describe, expect, it } from "vitest";
import {
  copyName,
  isEditable,
  itemId,
  newMineId,
  parseItemId,
  parsePartId,
  partId,
  uniqueName,
} from "./library.ts";

describe("library item ids", () => {
  it("round-trip, including keys that contain colons and slashes", () => {
    for (const [source, kind, key] of [
      ["builtin", "policy", "naive"],
      ["example", "policy", "docs/ops/min-max#2"],
      ["classic", "policy", "classic.newsvendor@a1:b2"],
      ["shared", "experiment", "0f3c"],
    ] as const) {
      expect(parseItemId(itemId(source, kind, key))).toEqual({ source, kind, key });
    }
  });

  it("reject ids with an unknown source or kind, or no key", () => {
    expect(parseItemId("server:policy:x")).toBeNull();
    expect(parseItemId("mine:folder:x")).toBeNull();
    expect(parseItemId("mine:policy:")).toBeNull();
    expect(parseItemId("naive")).toBeNull();
  });

  it("name experiment parts after their experiment", () => {
    const experiment = itemId("classic", "experiment", "classic.reorder");
    expect(parsePartId(partId(experiment, "compare"))).toEqual({ experiment, part: "compare" });
    expect(parsePartId(experiment)).toBeNull();
  });

  it("allow only Mine items to change in place", () => {
    expect(isEditable(newMineId("policy"))).toBe(true);
    expect(isEditable(itemId("builtin", "policy", "naive"))).toBe(false);
    expect(isEditable(itemId("shared", "experiment", "x"))).toBe(false);
    expect(isEditable(partId(itemId("mine", "experiment", "x"), "policy"))).toBe(false);
  });
});

describe("item names", () => {
  it("number copies from the original's name", () => {
    expect(copyName("naive", [])).toBe("naive (copy)");
    expect(copyName("naive", ["naive (copy)"])).toBe("naive (copy 2)");
    expect(copyName("naive (copy)", ["naive (copy)", "naive (copy 2)"])).toBe("naive (copy 3)");
  });

  it("keep a free name and number a taken one", () => {
    expect(uniqueName("buffer", ["other"])).toBe("buffer");
    expect(uniqueName("buffer", ["buffer", "buffer 2"])).toBe("buffer 3");
  });
});
