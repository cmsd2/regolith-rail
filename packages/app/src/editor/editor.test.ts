import { Text } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { completionsFor, entryFor, normalisePath } from "./api-data.ts";
import { pathSegments, rangeForPath } from "./json.ts";
import { positionOf, toLintDiagnostics } from "./lua.ts";

describe("API data for the editor", () => {
  it("normalises array indexes", () => {
    expect(normalisePath("ctx.line.stations[2].stock")).toBe("ctx.line.stations[i].stock");
  });

  it("finds entries for hover", () => {
    expect(entryFor("ops.min_max")?.params?.map((p) => p.name)).toEqual(["min", "max"]);
    expect(entryFor("ctx.line.stations[1].stock")?.level).toBe("line");
  });

  it("completes members of a path", () => {
    const names = completionsFor("ctx.train.ca").map((c) => c.entry.name);
    expect(names).toEqual(["capacity", "cargo"]);
    expect(completionsFor("ops.mi").map((c) => c.entry.name)).toEqual(["min_max"]);
  });
});

describe("Lua diagnostics", () => {
  it("places a checker diagnostic on the word at its line and column", () => {
    const doc = Text.of(["local a = 1", "goto done"]);
    const [diagnostic] = toLintDiagnostics(doc, [{ line: 2, column: 1, message: "no goto" }]);
    expect(diagnostic).toMatchObject({ from: 12, to: 16, message: "no goto", severity: "error" });
    expect(positionOf(doc, 99, 1)).toBe(12);
  });
});

describe("scenario JSON locations", () => {
  const text = JSON.stringify(
    { stations: [{ id: "A" }, { id: "B", producers: [{ rate: -1 }] }] },
    null,
    2,
  );

  it("splits validation paths", () => {
    expect(pathSegments("stations[1].producers[0].rate")).toEqual([
      "stations",
      1,
      "producers",
      0,
      "rate",
    ]);
    expect(pathSegments("(document)")).toEqual([]);
  });

  it("finds the property an error refers to", () => {
    const range = rangeForPath(text, "stations[1].producers[0].rate");
    expect(text.slice(range.from, range.to)).toBe('"rate"');
  });

  it("falls back to the nearest existing parent", () => {
    const range = rangeForPath(text, "stations[1].consumers[0].rate");
    expect(text.slice(range.from, range.from + 1)).toBe("{");
  });
});
