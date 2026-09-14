import { BUILT_IN_POLICIES } from "@regolith-rail/policy-api";
import { describe, expect, it } from "vitest";
import relayV1 from "../../../engine/src/testing/format1/relay.json" with { type: "json" };
import { type LibraryStorage, memoryLibraryStorage } from "../lib/library-storage.ts";
import { encodeShare, toShareState } from "../lib/share.ts";
import { memoryStorage, type WorkStorage } from "../lib/storage.ts";
import { BatchPool, SimulationClient, type WorkerHandle } from "../workers/client.ts";
import { createLibrary } from "./library.ts";
import { startSession } from "./session.ts";
import { createWorkbench } from "./workbench.ts";

/** The relay starter as the first release showed it, in format 1 JSON. */
const formerRelayText = `${JSON.stringify(relayV1, null, 2)}\n`;

const noWorker = (): WorkerHandle => {
  throw new Error("nothing should run");
};

function setup(storage: LibraryStorage = memoryLibraryStorage(), former?: WorkStorage) {
  const workbench = createWorkbench({
    client: new SimulationClient(noWorker),
    pool: new BatchPool(noWorker, 1),
  });
  const library = createLibrary();
  let hashCleared = false;
  const start = (hash = "") =>
    startSession({
      workbench,
      library,
      storage: Promise.resolve(storage),
      ...(former ? { formerStorage: Promise.resolve(former) } : {}),
      hash,
      clearHash: () => {
        hashCleared = true;
      },
      saveDelayMs: 0,
    });
  return { workbench, library, storage, start, hashCleared: () => hashCleared };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

describe("session", () => {
  it("opens a share link without running it", async () => {
    const source = setup();
    source.workbench.getState().setPolicySource("return {}");
    source.workbench.getState().selectStarter("relay");
    source.workbench.getState().setView("batch");
    source.workbench.getState().setBatchOptions({ compare: true, seedCount: 30, baseSeed: 4 });
    const hash = await encodeShare(toShareState(source.workbench.getState(), "test"));

    const target = setup();
    await target.start(hash);
    const state = target.workbench.getState();
    expect(state.loaded).toBe(true);
    expect(state.policy.source).toBe("return {}");
    expect(state.slots.scenario).toBe("builtin:scenario:relay");
    expect(state.view).toBe("batch");
    expect(state.batch).toMatchObject({ compare: true, seedCount: 30, baseSeed: 4 });
    expect(state.run.status).toBe("idle");
    expect(state.notices.map((n) => n.topic)).toEqual(["share-loaded"]);
    expect(target.hashCleared()).toBe(true);
    const shared = Object.values(state.items).filter((i) => i.kind === "experiment");
    expect(shared).toHaveLength(1);
    expect(shared[0]).toMatchObject({
      source: "shared",
      name: "Relay station · balance-stock (copy)",
    });
  });

  it("keeps one shared experiment for a link opened on two visits", async () => {
    const source = setup();
    source.workbench.getState().setPolicySource("-- shared\nreturn {}");
    const hash = await encodeShare(toShareState(source.workbench.getState(), "test"));

    const storage = memoryLibraryStorage();
    const first = setup(storage);
    const stop = await first.start(hash);
    await settle();
    stop();
    const second = setup(storage);
    await second.start(hash);
    await settle();
    const experiments = (await storage.listItems()).filter((i) => i.kind === "experiment");
    expect(experiments).toHaveLength(1);
    expect(second.workbench.getState().policy.source).toBe("-- shared\nreturn {}");
  });

  it("opens a link from the first release with its format 1 scenario upgraded", async () => {
    const state = {
      apiVersion: 2,
      appVersion: "0.1.0",
      view: "run",
      policy: { name: "old.lua", source: "return { on_stop = function(ctx) end }\n" },
      scenario: { starterId: "relay", text: formerRelayText },
      seed: 3,
      saveReloadTest: false,
    };
    const hash = await encodeShare(state as never);
    const { workbench, start } = setup();
    await start(hash);
    const opened = workbench.getState();
    expect(opened.slots.scenario).toBe("builtin:scenario:relay");
    expect(opened.policy).toEqual({ name: "old", source: state.policy.source });
    expect(opened.seed).toBe(3);
  });

  it("opens a documentation example from its fragment, or says it no longer exists", async () => {
    const found = setup();
    await found.start("#example.book/safety-stock.3");
    expect(found.workbench.getState().slots).toMatchObject({
      scenario: "builtin:scenario:storm-shock",
      policy: "example:policy:docs/book/safety-stock#3",
    });
    expect(found.hashCleared()).toBe(true);

    const missing = setup();
    await missing.start("#example.nowhere.9");
    expect(missing.workbench.getState().notices.map((n) => n.topic)).toEqual(["example-unknown"]);
    expect(missing.workbench.getState().slots.policy).toBe("builtin:policy:balance-stock");
  });

  it("opens a chapter's scenario from its fragment, or says it no longer exists", async () => {
    const found = setup();
    await found.start("#scenario.builtin:scenario:relay");
    expect(found.workbench.getState().slots).toMatchObject({
      scenario: "builtin:scenario:relay",
      policy: "builtin:policy:balance-stock",
    });
    expect(found.hashCleared()).toBe(true);

    const missing = setup();
    await missing.start("#scenario.classic:scenario:classic.nothing");
    expect(missing.workbench.getState().notices.map((n) => n.topic)).toEqual(["scenario-unknown"]);
  });

  it("reports a damaged link and restores the saved slots", async () => {
    const first = setup();
    await first.start();
    first.workbench.getState().setPolicySource("return { on_stop = function() end }");
    await settle();

    const second = setup(first.storage);
    await second.start("#v1.AAAA");
    expect(second.workbench.getState().notices.map((n) => n.topic)).toEqual(["share-damaged"]);
    expect(second.workbench.getState().policy.source).toBe("return { on_stop = function() end }");
  });

  it("saves edits automatically and restores the slots and Mine items next time", async () => {
    const storage = memoryLibraryStorage();
    const first = setup(storage);
    const stop = await first.start();
    first.workbench.getState().setPolicySource("-- edited\nreturn {}");
    first.workbench.getState().selectStarter("relay");
    first.workbench.getState().setSeed(12);
    await settle();
    expect(first.library.getState().draft).toBe("saved");
    expect((await storage.listItems()).map((i) => i.name)).toEqual(["balance-stock (copy)"]);
    stop();

    const second = setup(storage);
    await second.start();
    const state = second.workbench.getState();
    expect(state.policy).toEqual({ name: "balance-stock (copy)", source: "-- edited\nreturn {}" });
    expect(state.slots.scenario).toBe("builtin:scenario:relay");
    expect(state.seed).toBe(12);
  });

  it("removes deleted items from storage, keeping a slot's contents as an unsaved copy", async () => {
    const storage = memoryLibraryStorage();
    const first = setup(storage);
    await first.start();
    first.workbench.getState().setPolicySource("-- mine\nreturn {}");
    const id = first.workbench.getState().slots.policy;
    first.workbench.getState().deleteItem(id);
    await settle();
    expect(await storage.listItems()).toEqual([]);
    const state = first.workbench.getState();
    expect(state.slots.policy).not.toBe(id);
    expect(state.policy.source).toBe("-- mine\nreturn {}");

    const second = setup(storage);
    await second.start();
    expect(second.workbench.getState().policy.source).toBe("-- mine\nreturn {}");
    expect(Object.values(second.workbench.getState().items).every((i) => i.listed === false)).toBe(
      true,
    );
  });

  it("falls back to the defaults when a saved slot's item is gone", async () => {
    const storage = memoryLibraryStorage();
    await storage.saveSession({
      slots: { scenario: "mine:scenario:gone", policy: "mine:policy:gone", compare: null },
      items: [],
      seed: 5,
      view: "run",
      saveReloadTest: false,
      batch: { seedCount: 100, baseSeed: 1, compare: false },
    });
    const { workbench, start } = setup(storage);
    await start();
    expect(workbench.getState().slots).toEqual({
      scenario: "builtin:scenario:two-station",
      policy: "builtin:policy:balance-stock",
      compare: "builtin:policy:supply-to-demand",
    });
    expect(workbench.getState().seed).toBe(5);
  });

  it("moves a draft from before scenario scripts into the library, with its starter shipped", async () => {
    const former = memoryStorage();
    await former.saveDraft({
      policy: { name: "draft.lua", source: "return {}" },
      policyB: { name: "b.lua", source: BUILT_IN_POLICIES["balance-stock"] },
      scenario: { starterId: "relay", text: formerRelayText } as never,
      seed: 3,
    });
    const { workbench, start, storage } = setup(memoryLibraryStorage(), former);
    await start();
    const state = workbench.getState();
    expect(state.slots.scenario).toBe("builtin:scenario:relay");
    expect(state.slots.compare).toBe("builtin:policy:balance-stock");
    expect(state.policy).toEqual({ name: "Draft policy", source: "return {}" });
    expect(state.scenario).toMatchObject({ kind: "script", status: "ready" });
    expect(state.scenario.scenario?.id).toBe("relay");
    expect(await former.loadDraft()).toBeUndefined();
    expect((await storage.listItems()).map((i) => i.name)).toEqual(["Draft policy"]);
  });

  it("tells the player when storage is unavailable and keeps working in memory", async () => {
    const { workbench, library, start } = setup(memoryLibraryStorage(false));
    await start();
    expect(library.getState().available).toBe(false);
    expect(workbench.getState().notices.map((n) => n.topic)).toEqual(["storage-unavailable"]);
    expect(workbench.getState().loaded).toBe(true);
    workbench.getState().setPolicySource("-- kept for now\nreturn {}");
    expect(workbench.getState().policy.name).toBe("balance-stock (copy)");
  });
});
