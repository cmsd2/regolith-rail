import * as Comlink from "comlink";
import type { WorkerFactory } from "./client.ts";
import type { SimulationWorkerApi } from "./protocol.ts";

/** Starts a real simulation worker in the browser. */
export const browserWorkerFactory: WorkerFactory = () => {
  const worker = new Worker(new URL("./simulation.worker.ts", import.meta.url), { type: "module" });
  const remote = Comlink.wrap<SimulationWorkerApi>(worker);
  return {
    api: {
      run: (request, progress) =>
        remote.run(request, progress ? Comlink.proxy(progress) : undefined),
      runSeeds: (request, progress) =>
        remote.runSeeds(request, progress ? Comlink.proxy(progress) : undefined),
      check: (source) => remote.check(source),
      loadScript: (source) => remote.loadScript(source),
      modReady: (policy, scenario) => remote.modReady(policy, scenario),
    },
    terminate: () => {
      remote[Comlink.releaseProxy]();
      worker.terminate();
    },
  };
};

/** Workers to use for batches: one per core, at most eight. */
export function batchPoolSize(): number {
  const cores = typeof navigator === "undefined" ? 1 : navigator.hardwareConcurrency || 2;
  return Math.min(8, Math.max(1, cores));
}
