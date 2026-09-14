import { describe, expect, it } from "vitest";
import { movedTarget } from "./moved.ts";

const moved = {
  "failure-modes/double-dispatch": "book/base-stock#case-study-double-dispatch",
  "classic/newsvendor": "book/newsvendor",
};

describe("moved pages", () => {
  it("send old targets to where the page lives now", () => {
    expect(movedTarget("failure-modes/double-dispatch", moved)).toBe(
      "book/base-stock#case-study-double-dispatch",
    );
    expect(movedTarget("/failure-modes/double-dispatch/#why", moved)).toBe(
      "book/base-stock#case-study-double-dispatch",
    );
    expect(movedTarget("classic/newsvendor#the-reference-result", moved)).toBe(
      "book/newsvendor#the-reference-result",
    );
  });

  it("leave other targets alone", () => {
    expect(movedTarget("ops/min-max#param-min", moved)).toBe("ops/min-max#param-min");
  });
});
