import { batchSeeds } from "@regolith-rail/engine";
import { LuaRuntime } from "@regolith-rail/lua-runtime";
import { beforeAll, describe, expect, it } from "vitest";
import {
  BatchPool,
  CancelledError,
  SimulationClient,
  type WorkerHandle,
} from "../workers/client.ts";
import { simulationTasks } from "../workers/simulate.ts";
import { createPlayhead } from "./playhead.ts";
import { createWorkbench, DEFAULT_SCENARIO, starterText } from "./workbench.ts";

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
    },
    terminate: () => {
      terminated = true;
    },
  };
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
    expect(state.policy.name).toBe("naive.lua");
  });

  it("reports invalid scenario text and clears the parsed scenario", () => {
    const store = workbench();
    store.getState().setScenarioText('{ "format": 1 }');
    expect(store.getState().scenario.scenario).toBeNull();
    expect(store.getState().scenario.errors.length).toBeGreaterThan(0);
    store.getState().setScenarioText("{ nope");
    expect(store.getState().scenario.errors[0]?.path).toBe("(document)");
  });

  it("remembers the starter only while its text is unedited", () => {
    const store = workbench();
    store.getState().selectStarter("relay");
    expect(store.getState().scenario.starterId).toBe("relay");
    store.getState().setScenarioText(starterText("relay").replace('"seed": 1', '"seed": 2'));
    expect(store.getState().scenario.starterId).toBeNull();
    expect(store.getState().scenario.scenario?.seed).toBe(2);
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
