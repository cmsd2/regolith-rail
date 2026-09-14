import { describe, expect, it } from "vitest";
import type { WorkbenchState } from "../state/workbench.ts";
import type { LibraryItem } from "./library.ts";
import { decodeShare, encodeShare, lengthWarning, type ShareState, sameShare } from "./share.ts";

const state: ShareState = {
  apiVersion: 2,
  appVersion: "0.0.0",
  view: "batch",
  policy: { name: "naive.lua", source: "return { on_stop = function(ctx) end } -- é ✓" },
  policyB: { name: "b.lua", source: "return ops.policy { target = ops.balance {} }" },
  scenario: {
    kind: "script",
    source: "return classic.reorder {}",
    starterId: null,
    template: { name: "classic.reorder", params: { demand: 5 } },
  },
  seed: 42,
  saveReloadTest: true,
  batch: { seedCount: 50, baseSeed: 7, compare: true },
};

describe("share links", () => {
  it("round-trip the workbench state", async () => {
    const hash = await encodeShare(state);
    expect(hash).toMatch(/^#v1\.[A-Za-z0-9_-]+$/);
    const decoded = await decodeShare(hash);
    expect(decoded).toEqual({ ok: true, state, warnings: [] });
  });

  it("open links made before scenario scripts, with the scenario upgraded", async () => {
    const old = { ...state, scenario: { starterId: null, text: '{ "format": 2, "id": "x" }' } };
    const decoded = await decodeShare(await encodeShare(old as unknown as ShareState));
    expect(decoded.ok && decoded.state.scenario).toEqual({
      kind: "json",
      source: '{ "format": 2, "id": "x" }',
      starterId: null,
    });
  });

  it("report a damaged link", async () => {
    const hash = await encodeShare(state);
    const decoded = await decodeShare(hash.slice(0, hash.length - 10));
    expect(decoded.ok).toBe(false);
    expect(await decodeShare("#v1.not-base64!")).toMatchObject({ ok: false });
  });

  it("warn about a different Policy API version", async () => {
    const decoded = await decodeShare(await encodeShare({ ...state, apiVersion: 0 }));
    expect(decoded.ok && decoded.warnings[0]).toContain("Policy API version 0");
  });

  it("warn about very long links", () => {
    expect(lengthWarning("#v1.short")).toBeNull();
    expect(lengthWarning(`#v1.${"a".repeat(9000)}`)).toContain("9,004 characters");
  });

  it("stay the same when a scenario finishes evaluating, and change with an edit", () => {
    const items: Record<string, LibraryItem> = {
      "mine:scenario:s": {
        id: "mine:scenario:s",
        kind: "scenario",
        source: "mine",
        name: "Shop",
        content: state.scenario,
        createdAt: 1,
        updatedAt: 1,
      },
      "mine:policy:p": {
        id: "mine:policy:p",
        kind: "policy",
        source: "mine",
        name: "mine",
        content: state.policy.source,
        createdAt: 1,
        updatedAt: 1,
      },
    };
    const stateWith = (overrides: Record<string, unknown>) =>
      ({
        view: "run",
        slots: { scenario: "mine:scenario:s", policy: "mine:policy:p", compare: "mine:policy:p" },
        itemById: (id: string) => items[id],
        scenario: { ...state.scenario, status: "evaluating", scenario: null, errors: [] },
        seed: 1,
        saveReloadTest: false,
        batch: { seedCount: 100, baseSeed: 1, compare: false },
        ...overrides,
      }) as unknown as WorkbenchState;
    const evaluating = stateWith({});
    const ready = stateWith({
      scenario: { ...state.scenario, status: "ready", scenario: { id: "x" }, errors: [] },
    });
    expect(sameShare(evaluating, ready)).toBe(true);

    const edited = stateWith({
      itemById: (id: string) =>
        id === "mine:scenario:s"
          ? {
              ...items[id],
              content: { ...state.scenario, source: "return classic.reorder { demand = 6 }" },
            }
          : items[id],
    });
    expect(sameShare(ready, edited)).toBe(false);
    expect(sameShare(ready, stateWith({ seed: 2 }))).toBe(false);
  });
});
