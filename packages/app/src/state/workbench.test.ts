import { batchSeeds } from "@regolith-rail/engine";
import { LuaRuntime } from "@regolith-rail/lua-runtime";
import { classicTemplates, STARTER_SCRIPTS, templateCall } from "@regolith-rail/scenario-kit";
import { beforeAll, describe, expect, it } from "vitest";
import { catalogueItem } from "../lib/catalogue.ts";
import {
  BatchPool,
  CancelledError,
  SimulationClient,
  type WorkerHandle,
} from "../workers/client.ts";
import { simulationTasks } from "../workers/simulate.ts";
import { createPlayhead } from "./playhead.ts";
import { createWorkbench, DEFAULT_SCENARIO } from "./workbench.ts";

let runtime: LuaRuntime;
beforeAll(async () => {
  runtime = await LuaRuntime.load();
});

/**
 * A worker that runs in-process, optionally never finishing. Like a real worker,
 * its progress callbacks are delivered asynchronously, after the call returns.
 */
function inProcess(options: { hang?: boolean } = {}): WorkerHandle {
  const tasks = simulationTasks(runtime);
  let terminated = false;
  const never = new Promise<never>(() => {});
  const later = (fn: () => void) => setTimeout(() => !terminated && fn(), 0);
  return {
    api: {
      run: async (request, progress) =>
        options.hang ? never : tasks.run(request, progress && ((f) => later(() => progress(f)))),
      runSeeds: async (request, progress) =>
        options.hang
          ? never
          : tasks.runSeeds(request, progress && ((n) => later(() => progress(n)))),
      check: async (source) => tasks.check(source),
      loadScript: async (source) => tasks.loadScript(source),
      modReady: async (policy, scenario) => tasks.modReady(policy, scenario),
    },
    terminate: () => {
      terminated = true;
    },
  };
}

/** Waits for a scenario script to finish evaluating. */
async function settled(store: ReturnType<typeof workbench>) {
  for (let i = 0; i < 200 && store.getState().scenario.status === "evaluating"; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function workbench(options: { hang?: boolean } = {}) {
  return createWorkbench({
    client: new SimulationClient(() => inProcess(options)),
    pool: new BatchPool(() => inProcess(options), 3),
  });
}

describe("workbench store", () => {
  it("starts with two-station and the naive baseline", () => {
    const state = workbench().getState();
    expect(state.scenario.starterId).toBe(DEFAULT_SCENARIO);
    expect(state.scenario.scenario?.id).toBe("two-station");
    expect(state.policy.name).toBe("naive");
    expect(state.slots).toEqual({
      scenario: "builtin:scenario:two-station",
      policy: "builtin:policy:naive",
      compare: "builtin:policy:supply-to-demand",
    });
  });

  it("reports invalid JSON and clears the parsed scenario", () => {
    const store = workbench();
    store.getState().setScenarioKind("json");
    expect(store.getState().scenario.kind).toBe("json");
    store.getState().setScenarioSource('{ "format": 1 }');
    expect(store.getState().scenario.scenario).toBeNull();
    expect(store.getState().scenario.errors.length).toBeGreaterThan(0);
    store.getState().setScenarioSource("{ nope");
    expect(store.getState().scenario.errors[0]?.path).toBe("(document)");
  });

  it("remembers the starter only while its script is unedited", async () => {
    const store = workbench();
    store.getState().selectStarter("relay");
    expect(store.getState().scenario).toMatchObject({ starterId: "relay", status: "ready" });
    store
      .getState()
      .setScenarioSource(
        (STARTER_SCRIPTS.relay as string).replace("duration = sols(10)", "duration = sols(4)"),
      );
    expect(store.getState().scenario).toMatchObject({ starterId: null, status: "evaluating" });
    expect(store.getState().scenario.scenario).toBeNull();
    await settled(store);
    expect(store.getState().scenario.scenario?.durationMs).toBe(4 * 86_400_000);
  });

  it("reports script errors at their lines and keeps only the latest evaluation", async () => {
    const store = workbench();
    store.getState().setScenarioSource("return scenario { id = 5 }");
    store.getState().setScenarioSource('-- a shop\nreturn scenario { id = "x", colour = 1 }');
    await settled(store);
    expect(store.getState().scenario.errors).toEqual([
      { line: 2, message: "scenario: has no parameter named colour" },
    ]);
  });

  it("converts between a script and JSON without changing the scenario", async () => {
    const store = workbench();
    const before = store.getState().scenario.scenario;
    store.getState().setScenarioKind("json");
    expect(store.getState().scenario.scenario).toEqual(before);
    store.getState().setScenarioKind("script");
    expect(store.getState().scenario.source).toContain("return scenario {");
    store.getState().setScenarioSource(`${store.getState().scenario.source}\n`);
    await settled(store);
    expect(store.getState().scenario.scenario).toEqual(before);
  });

  it("picks a template with its reference policy and rewrites it from parameters", async () => {
    const store = workbench();
    store.getState().selectTemplate("classic.serial_chain");
    expect(store.getState().slots.policy).toBe("classic:policy:classic.serial_chain");
    await settled(store);
    expect(store.getState().scenario.scenario?.stations).toHaveLength(4);
    store.getState().setTemplateParams({ stages: 3 });
    const { scenario } = store.getState();
    expect(scenario.source).toBe(
      templateCall("classic.serial_chain", { ...scenario.template?.params, stages: 3 }),
    );
    await settled(store);
    expect(store.getState().scenario.scenario?.stations.map((s) => s.id)).toEqual([
      "Stage1",
      "Stage2",
      "Stage3",
    ]);
    store.getState().setScenarioSource(`-- mine\n${store.getState().scenario.source}`);
    expect(store.getState().scenario.template).toBeUndefined();
  });

  it("copies a built-in policy on its first edit and edits the copy after that", () => {
    const store = workbench();
    const naive = catalogueItem("builtin:policy:naive");
    store.getState().setPolicySource("-- one\nreturn {}");
    const first = store.getState();
    expect(first.slots.policy).toMatch(/^mine:policy:/);
    expect(first.items[first.slots.policy]).toMatchObject({
      name: "naive (copy)",
      source: "mine",
      origin: "builtin:policy:naive",
      content: "-- one\nreturn {}",
    });
    expect(first.policy).toEqual({ name: "naive (copy)", source: "-- one\nreturn {}" });

    store.getState().setPolicySource("-- two\nreturn {}");
    const second = store.getState();
    expect(second.slots.policy).toBe(first.slots.policy);
    expect(Object.keys(second.items)).toHaveLength(1);
    expect(second.policy.source).toBe("-- two\nreturn {}");
    expect(catalogueItem("builtin:policy:naive")).toBe(naive);
    expect(naive?.content).not.toContain("-- two");

    // A second copy of the built-in gets the next free name.
    store.getState().fillSlot("policy", "builtin:policy:naive");
    store.getState().setPolicySource("-- three\nreturn {}");
    expect(store.getState().policy.name).toBe("naive (copy 2)");
  });

  it("fills slots only with items of their kind, and runs nothing", () => {
    const store = workbench();
    store.getState().fillSlot("policy", "builtin:scenario:relay");
    expect(store.getState().slots.policy).toBe("builtin:policy:naive");
    store.getState().fillSlot("compare", "builtin:policy:naive");
    expect(store.getState().policyB.name).toBe("naive");
    expect(store.getState().run.status).toBe("idle");
  });

  it("counts template parameter changes as an edit and lets the reference policy follow", async () => {
    const store = workbench();
    const newsvendor = classicTemplates.find((t) => t.name === "classic.newsvendor");
    if (!newsvendor) throw new Error("newsvendor missing");
    store.getState().selectTemplate("classic.newsvendor");
    store.getState().setTemplateParams({ lost_cost: 9 });
    const state = store.getState();
    expect(state.slots.scenario).toMatch(/^mine:scenario:/);
    expect(state.items[state.slots.scenario]?.name).toBe("Newsvendor (copy)");
    expect(state.scenario.template?.params.lost_cost).toBe(9);
    expect(state.slots.policy).toMatch(/^classic:policy:classic\.newsvendor@/);
    const params = { ...newsvendor.defaults, lost_cost: 9 };
    expect(state.policy.source).toBe(newsvendor.reference(params).policy);
    expect(catalogueItem("classic:scenario:classic.newsvendor")?.content).toMatchObject({
      template: { params: newsvendor.defaults },
    });

    // Once edited, the reference policy is the player's and stays put.
    store.getState().setPolicySource(`-- tuned\n${state.policy.source}`);
    store.getState().setTemplateParams({ lost_cost: 12 });
    expect(store.getState().policy.source).toMatch(/^-- tuned/);
    expect(store.getState().scenario.template?.params.lost_cost).toBe(12);
    await settled(store);
  });

  it("renames, duplicates, saves and deletes Mine items", () => {
    const store = workbench();
    store.getState().setPolicySource("-- a\nreturn {}");
    const id = store.getState().slots.policy;
    store.getState().renameItem(id, "buffer");
    expect(store.getState().policy.name).toBe("buffer");
    store.getState().renameItem("builtin:policy:naive", "nope");
    expect(catalogueItem("builtin:policy:naive")?.name).toBe("naive");

    const copy = store.getState().duplicateItem(id);
    expect(copy && store.getState().items[copy]?.name).toBe("buffer (copy)");

    store.getState().fillSlot("scenario", "builtin:scenario:relay");
    store.getState().saveSlotAs("scenario", "my relay");
    const scenarioId = store.getState().slots.scenario;
    expect(store.getState().items[scenarioId]).toMatchObject({ name: "my relay", source: "mine" });

    store.getState().deleteItem(id);
    const after = store.getState();
    expect(after.items[id]).toBeUndefined();
    expect(after.items[after.slots.policy]).toMatchObject({
      listed: false,
      content: "-- a\nreturn {}",
    });
    store.getState().saveSlotAs("policy", "rescued");
    const rescued = store.getState().items[store.getState().slots.policy];
    expect(rescued).toMatchObject({ name: "rescued" });
    expect(rescued?.listed).toBeUndefined();
  });

  it("saves the run as an experiment and restores it later without running", () => {
    const store = workbench();
    store.getState().selectStarter("storm-shock");
    store
      .getState()
      .setPolicySource("return ops.policy { target = ops.min_max { min = 1, max = 2 } }");
    store.getState().setSeed(7);
    const id = store.getState().saveExperiment("Storm buffer");
    const policyId = store.getState().slots.policy;
    expect(store.getState().items[id]).toMatchObject({ kind: "experiment", name: "Storm buffer" });

    store.getState().selectStarter("relay");
    store.getState().setSeed(2);
    store.getState().setPolicySource("-- changed after saving\nreturn {}");
    store.getState().openExperiment(id);
    const opened = store.getState();
    expect(opened.slots.scenario).toBe("builtin:scenario:storm-shock");
    expect(opened.policy.source).toContain("ops.min_max");
    expect(opened.seed).toBe(7);
    expect(opened.run.status).toBe("idle");
    // The Mine policy was edited since, so the experiment's own copy fills the slot.
    expect(opened.slots.policy).toBe(`experiment:${id}/policy`);

    // Editing that part copies it to Mine and leaves the experiment as it was.
    store.getState().setPolicySource("-- tweaked\nreturn {}");
    const after = store.getState();
    expect(after.slots.policy).toMatch(/^mine:policy:/);
    expect(after.slots.policy).not.toBe(policyId);
    const experiment = after.items[id];
    expect(experiment?.kind === "experiment" && experiment.content.policy.content).toContain(
      "ops.min_max",
    );

    store.getState().updateExperiment(id);
    const updated = store.getState().items[id];
    expect(updated?.kind === "experiment" && updated.content.policy.content).toBe(
      "-- tweaked\nreturn {}",
    );
  });

  it("opens a classic experiment with shipped items whose reference policy follows the template", () => {
    const store = workbench();
    const newsvendor = classicTemplates.find((t) => t.name === "classic.newsvendor");
    if (!newsvendor) throw new Error("newsvendor missing");
    store.getState().openExperiment("classic:experiment:classic.newsvendor");
    expect(store.getState().slots).toMatchObject({
      scenario: "classic:scenario:classic.newsvendor",
      policy: "classic:policy:classic.newsvendor",
    });
    store.getState().setTemplateParams({ lost_cost: 9 });
    expect(store.getState().policy.source).toBe(
      newsvendor.reference({ ...newsvendor.defaults, lost_cost: 9 }).policy,
    );
  });

  it("opens a documentation example without changing the player's work", () => {
    const store = workbench();
    store.getState().setPolicySource("-- mine\nreturn {}");
    const mineId = store.getState().slots.policy;
    store.getState().openExample("example:policy:docs/failure-modes/disruption-recovery#1");
    const state = store.getState();
    expect(state.slots).toMatchObject({
      scenario: "builtin:scenario:storm-shock",
      policy: "example:policy:docs/failure-modes/disruption-recovery#1",
    });
    expect(state.items[mineId]?.content).toBe("-- mine\nreturn {}");
    store.getState().setPolicySource("-- edited example\nreturn {}");
    const copy = store.getState().slots.policy;
    expect(copy).toMatch(/^mine:policy:/);
    expect(copy).not.toBe(mineId);
    expect(store.getState().items[mineId]?.content).toBe("-- mine\nreturn {}");
  });

  it("runs the current policy and scenario", async () => {
    const store = workbench();
    await store.getState().startRun();
    const { run } = store.getState();
    expect(run.status).toBe("done");
    expect(run.output?.scenarioId).toBe("two-station");
    expect(run.output?.metrics.stops).toBeGreaterThan(0);
  });

  it("keeps the previous result when a run is cancelled", async () => {
    const store = workbench();
    await store.getState().startRun();
    const previous = store.getState().run.output;

    const hanging = createWorkbench({
      client: new SimulationClient(() => inProcess({ hang: true })),
      pool: new BatchPool(() => inProcess({ hang: true }), 1),
    });
    hanging.setState({ run: { status: "done", progress: 1, output: previous, error: null } });
    const running = hanging.getState().startRun();
    expect(hanging.getState().run.status).toBe("running");
    hanging.getState().cancelRun();
    await running;
    expect(hanging.getState().run.status).toBe("done");
    expect(hanging.getState().run.output).toBe(previous);
  });

  it("rejects pending requests with a cancellation error", async () => {
    const client = new SimulationClient(() => inProcess({ hang: true }));
    const store = workbench().getState();
    const pending = client.run({
      scenario: store.scenario.scenario as never,
      policy: store.policy.source,
      seed: 1,
      saveReloadTest: false,
    });
    client.cancel();
    await expect(pending).rejects.toBeInstanceOf(CancelledError);
  });

  it("runs batches in seed order whatever the number of workers", async () => {
    const store = workbench();
    const scenario = store.getState().scenario.scenario;
    if (!scenario) throw new Error("no scenario");
    const request = { scenario, policy: store.getState().policy.source, saveReloadTest: false };
    const seeds = batchSeeds(42, 7);
    const one = await new BatchPool(() => inProcess(), 1).run(request, seeds);
    const four = await new BatchPool(() => inProcess(), 4).run(request, seeds);
    expect(four.map((r) => r.seed)).toEqual(seeds);
    expect(four).toEqual(one);
  }, 120_000);

  it("compares two policies on the same seeds", async () => {
    const store = workbench();
    store.getState().setBatchOptions({ compare: true });
    const seeds = batchSeeds(42, 3);
    await store.getState().startBatch(seeds);
    const { batch } = store.getState();
    expect(batch.status).toBe("done");
    expect(batch.results?.a.map((r) => r.seed)).toEqual(seeds);
    expect(batch.results?.b?.map((r) => r.seed)).toEqual(seeds);
  }, 120_000);
});

describe("playhead", () => {
  it("advances during playback and stops at the end", () => {
    const playhead = createPlayhead();
    playhead.getState().setDuration(10_000_000);
    playhead.getState().setSpeed(1_000_000);
    playhead.getState().play();
    playhead.getState().advance(4_000);
    expect(playhead.getState().t).toBe(4_000_000);
    playhead.getState().advance(10_000);
    expect(playhead.getState().t).toBe(10_000_000);
    expect(playhead.getState().playing).toBe(false);
  });

  it("clamps the time to the run", () => {
    const playhead = createPlayhead();
    playhead.getState().setDuration(1000);
    playhead.getState().setTime(5000);
    expect(playhead.getState().t).toBe(1000);
  });
});
