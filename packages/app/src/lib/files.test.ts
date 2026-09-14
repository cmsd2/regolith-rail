import { describe, expect, it } from "vitest";
import { parseScenarioText } from "../state/workbench.ts";
import { catalogueItem } from "./catalogue.ts";
import { exportFile, importFile, MAX_IMPORT_BYTES } from "./files.ts";
import type { LibraryItem } from "./library.ts";
import { classicExperiment } from "./test-fixtures.ts";

const file = (name: string, text: string) => ({ name, bytes: new TextEncoder().encode(text) });

describe("importing files", () => {
  it("imports a policy into Mine, named after the file", () => {
    const existing: LibraryItem[] = [
      {
        id: "mine:policy:x",
        kind: "policy",
        source: "mine",
        name: "buffer",
        content: "",
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    const first = importFile("policy", file("buffer.lua", "return {}"), [], 5);
    expect(first).toMatchObject({
      ok: true,
      item: { kind: "policy", source: "mine", name: "buffer", content: "return {}" },
    });
    const second = importFile("policy", file("C:\\work\\buffer.lua", "return {}"), existing, 5);
    expect(second.ok && second.item.name).toBe("buffer 2");
  });

  it("imports scenarios as scripts or JSON by extension, keeping errors for when they open", () => {
    const script = importFile(
      "scenario",
      file("chain.lua", "return classic.serial_chain {}"),
      [],
      1,
    );
    expect(script.ok && script.item.kind === "scenario" && script.item.content.kind).toBe("script");
    const broken = importFile("scenario", file("broken.json", '{ "format": 2, "id": "x" }'), [], 1);
    if (!broken.ok || broken.item.kind !== "scenario") throw new Error("not imported");
    expect(broken.item.content).toEqual({
      kind: "json",
      source: '{ "format": 2, "id": "x" }',
      starterId: null,
    });
    expect(parseScenarioText(broken.item.content.source).errors.length).toBeGreaterThan(0);
  });

  it("rejects files that are too large or not text", () => {
    const large = { name: "big.lua", bytes: new Uint8Array(MAX_IMPORT_BYTES + 1) };
    expect(importFile("policy", large, [], 1)).toEqual({
      ok: false,
      message: "big.lua is larger than 1 MB, so it was not imported.",
    });
    const binary = { name: "image.lua", bytes: new Uint8Array([0xff, 0xfe, 0xfd]) };
    expect(importFile("policy", binary, [], 1)).toEqual({
      ok: false,
      message: "image.lua is not a text file, so it was not imported.",
    });
  });

  it("rejects an experiment file that isn't one", () => {
    expect(importFile("experiment", file("notes.json", '{ "hello": 1 }'), [], 1)).toMatchObject({
      ok: false,
    });
    expect(importFile("experiment", file("notes.json", "not json"), [], 1)).toMatchObject({
      ok: false,
    });
  });
});

describe("exporting files", () => {
  it("exports policies and scripts as Lua and JSON scenarios as JSON", () => {
    const naive = catalogueItem("builtin:policy:naive") as LibraryItem;
    expect(exportFile(naive)).toMatchObject({ fileName: "naive.lua", text: naive.content });
    const relay = catalogueItem("builtin:scenario:relay") as LibraryItem;
    expect(exportFile(relay).fileName).toBe("Relay station.lua");
    const json: LibraryItem = {
      id: "mine:scenario:j",
      kind: "scenario",
      source: "mine",
      name: "a/b: c",
      content: { kind: "json", source: "{}", starterId: null },
      createdAt: 1,
      updatedAt: 1,
    };
    expect(exportFile(json)).toMatchObject({ fileName: "a-b- c.json", type: "application/json" });
  });

  it("round-trips an experiment through an exported file", () => {
    const shipped = classicExperiment();
    const exported = exportFile(shipped);
    expect(exported.fileName).toBe("Reorder.json");
    const imported = importFile("experiment", file(exported.fileName, exported.text), [], 9);
    if (!imported.ok || imported.item.kind !== "experiment") throw new Error("not imported");
    expect(imported.item).toMatchObject({ source: "mine", name: "Reorder" });
    expect(imported.item.content).toEqual(shipped.content);
  });
});
