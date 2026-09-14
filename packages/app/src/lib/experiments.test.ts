import { BUILT_IN_POLICIES } from "@regolith-rail/policy-api";
import { STARTER_SCRIPTS } from "@regolith-rail/scenario-kit";
import { describe, expect, it } from "vitest";
import { catalogueItem } from "./catalogue.ts";
import {
  experimentContentOf,
  experimentFromShareState,
  experimentName,
  type RunSetup,
  sharedExperimentId,
  shareStateOf,
} from "./experiments.ts";
import type { LibraryItem } from "./library.ts";
import { decodeShare, encodeShare, type ShareState } from "./share.ts";

const mine: LibraryItem = {
  id: "mine:policy:buffer",
  kind: "policy",
  source: "mine",
  name: "buffer",
  content: "-- buffer\nreturn {}",
  origin: "builtin:policy:balance-stock",
  createdAt: 1,
  updatedAt: 1,
};

const setup = (overrides: Partial<RunSetup> = {}): RunSetup => ({
  slots: {
    scenario: "builtin:scenario:storm-shock",
    policy: mine.id,
    compare: "builtin:policy:balance-stock",
  },
  seed: 7,
  view: "batch",
  saveReloadTest: false,
  batch: { seedCount: 30, baseSeed: 4, compare: true },
  itemById: (id) => (id === mine.id ? mine : catalogueItem(id)),
  ...overrides,
});

describe("experiments", () => {
  it("snapshot the slots' contents with the items they came from", () => {
    const content = experimentContentOf(setup());
    expect(content.scenario).toMatchObject({
      name: "Storm shock",
      origin: "builtin:scenario:storm-shock",
      content: { kind: "script", source: STARTER_SCRIPTS["storm-shock"], starterId: "storm-shock" },
    });
    expect(content.policy).toEqual({ content: mine.content, name: "buffer", origin: mine.id });
    expect(content.compare).toMatchObject({
      name: "balance-stock",
      origin: "builtin:policy:balance-stock",
    });
    expect(content).toMatchObject({ seed: 7, view: "batch", batch: { seedCount: 30 } });
    expect(experimentName(content)).toBe("Storm shock · buffer");
  });

  it("leave out the comparison policy when the batch does not compare", () => {
    const content = experimentContentOf(
      setup({ batch: { seedCount: 30, baseSeed: 4, compare: false } }),
    );
    expect(content.compare).toBeUndefined();
  });

  it("record where an experiment's part came from, not the part itself", () => {
    const part: LibraryItem = {
      ...mine,
      id: "experiment:mine:experiment:e/policy",
      origin: "mine:policy:buffer",
      listed: false,
    };
    const content = experimentContentOf(
      setup({
        itemById: (id) => (id === part.id ? part : catalogueItem(id)),
        slots: { ...setup().slots, policy: part.id },
      }),
    );
    expect(content.policy.origin).toBe("mine:policy:buffer");
  });

  it("round-trip through a share link", async () => {
    const content = experimentContentOf(setup());
    const decoded = await decodeShare(await encodeShare(shareStateOf(content, "test")));
    if (!decoded.ok) throw new Error(decoded.error);
    const opened = experimentFromShareState(decoded.state);
    // Shipped parts are named after the items they match; others keep the link's names.
    expect(opened.scenario).toEqual(content.scenario);
    expect(opened.compare).toEqual(content.compare);
    expect(opened.policy).toEqual({ content: mine.content, name: "buffer" });
    expect(shareStateOf(opened, "test")).toEqual(shareStateOf(content, "test"));
  });

  it("give equal links the same shared id, whatever the app version", async () => {
    const link: ShareState = {
      apiVersion: 2,
      appVersion: "one",
      view: "run",
      policy: { name: "balance-stock.lua", source: BUILT_IN_POLICIES["balance-stock"] },
      scenario: { kind: "script", source: STARTER_SCRIPTS.relay as string, starterId: "relay" },
      seed: 3,
      saveReloadTest: false,
    };
    const a = await sharedExperimentId(experimentFromShareState(link));
    const b = await sharedExperimentId(experimentFromShareState({ ...link, appVersion: "two" }));
    const c = await sharedExperimentId(experimentFromShareState({ ...link, seed: 4 }));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^shared:experiment:[0-9a-f]{64}$/);
  });
});
