import { useStore } from "zustand";
import { batchPoolSize, browserWorkerFactory } from "../workers/browser.ts";
import { BatchPool, SimulationClient } from "../workers/client.ts";
import { createPlayhead, type PlayheadState } from "./playhead.ts";
import { createWorkbench, type WorkbenchState } from "./workbench.ts";

/** Checks policy source in its own worker, so checking never waits behind a run. */
export const checker = new SimulationClient(browserWorkerFactory);

export const workbench = createWorkbench({
  client: new SimulationClient(browserWorkerFactory),
  pool: new BatchPool(browserWorkerFactory, batchPoolSize()),
});

export const playhead = createPlayhead();

export function useWorkbench<T>(selector: (state: WorkbenchState) => T): T {
  return useStore(workbench, selector);
}

export function usePlayhead<T>(selector: (state: PlayheadState) => T): T {
  return useStore(playhead, selector);
}
