import { BUILT_IN_POLICIES } from "@regolith-rail/policy-api";
import { describe, expect, it } from "vitest";
import { formerStarterText, starterSource } from "../lib/scenario-source.ts";
import { encodeShare, toShareState } from "../lib/share.ts";
import { memoryStorage, unavailableStorage, type WorkStorage } from "../lib/storage.ts";
import { BatchPool, SimulationClient, type WorkerHandle } from "../workers/client.ts";
import { createLibrary } from "./library.ts";
import { startSession } from "./session.ts";
import { createWorkbench } from "./workbench.ts";

const noWorker = (): WorkerHandle => {
  throw new Error("nothing should run");
};

function setup(storage: WorkStorage = memoryStorage()) {
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
      hash,
      clearHash: () => {
        hashCleared = true;
      },
      draftDelayMs: 0,
    });
  return { workbench, library, storage, start, hashCleared: () => hashCleared };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

describe("session", () => {
  it("opens a share link without running it", async () => {
    const source = setup();
    source.workbench.getState().setPolicy({ name: "mine.lua", source: "return {}" });
    source.workbench.getState().selectStarter("relay");
    source.workbench.getState().setView("batch");
    source.workbench.getState().setBatchOptions({ compare: true, seedCount: 30, baseSeed: 4 });
    const hash = await encodeShare(toShareState(source.workbench.getState(), "test"));

    const target = setup();
    await target.start(hash);
    const state = target.workbench.getState();
    expect(state.loaded).toBe(true);
    expect(state.policy).toEqual({ name: "mine.lua", source: "return {}" });
    expect(state.scenario.starterId).toBe("relay");
    expect(state.view).toBe("batch");
    expect(state.batch).toMatchObject({ compare: true, seedCount: 30, baseSeed: 4 });
    expect(state.run.status).toBe("idle");
    expect(state.notices.map((n) => n.topic)).toEqual(["share-loaded"]);
    expect(target.hashCleared()).toBe(true);
  });

  it("reports a damaged link and keeps the draft", async () => {
    const storage = memoryStorage();
    const draft = {
      policy: { name: "draft.lua", source: "return { on_stop = function() end }" },
      policyB: { name: "b.lua", source: BUILT_IN_POLICIES.naive },
      scenario: starterSource("relay"),
      seed: 9,
    };
    await storage.saveDraft(draft);
    const { workbench, start } = setup(storage);
    await start("#v1.AAAA");
    expect(workbench.getState().notices.map((n) => n.topic)).toEqual(["share-damaged"]);
    expect(workbench.getState().policy).toEqual(draft.policy);
    expect(await storage.loadDraft()).toEqual(draft);
  });

  it("saves edits as a draft and restores them next time", async () => {
    const storage = memoryStorage();
    const first = setup(storage);
    const stop = await first.start();
    first.workbench.getState().setPolicySource("-- edited\nreturn {}");
    first.workbench.getState().setSeed(12);
    await settle();
    expect(first.library.getState().draft).toBe("saved");
    stop();

    const second = setup(storage);
    await second.start();
    expect(second.workbench.getState().policy.source).toBe("-- edited\nreturn {}");
    expect(second.workbench.getState().seed).toBe(12);
  });

  it("restores a draft from before scenario scripts with its starter as a script", async () => {
    const storage = memoryStorage();
    await storage.saveDraft({
      policy: { name: "draft.lua", source: "return {}" },
      policyB: { name: "b.lua", source: "return {}" },
      scenario: { starterId: "relay", text: formerStarterText("relay") } as never,
      seed: 3,
    });
    const { workbench, start } = setup(storage);
    await start();
    expect(workbench.getState().scenario).toMatchObject({
      kind: "script",
      starterId: "relay",
      status: "ready",
    });
    expect(workbench.getState().scenario.scenario?.id).toBe("relay");
  });

  it("tells the player when storage is unavailable", async () => {
    const { workbench, library, start } = setup(unavailableStorage());
    await start();
    expect(library.getState().available).toBe(false);
    expect(workbench.getState().notices.map((n) => n.topic)).toEqual(["storage-unavailable"]);
    expect(workbench.getState().loaded).toBe(true);
  });

  it("saves, renames and deletes named work", async () => {
    const { library, start } = setup();
    await start();
    const { save, rename, remove } = library.getState();
    await save({ kind: "policy", name: "b", source: "return {}", savedAt: 1 });
    await save({ kind: "policy", name: "a", source: "return {}", savedAt: 2 });
    await save({ kind: "scenario", name: "a", text: "{}", savedAt: 3 });
    expect(library.getState().items.map((i) => `${i.kind}:${i.name}`)).toEqual([
      "policy:a",
      "policy:b",
      "scenario:a",
    ]);
    await rename("policy", "b", "c");
    await remove("scenario", "a");
    expect(library.getState().items.map((i) => `${i.kind}:${i.name}`)).toEqual([
      "policy:a",
      "policy:c",
    ]);
  });
});
