import { useStore } from "zustand";
import { openStorage } from "../lib/storage.ts";
import { batchPoolSize, browserWorkerFactory } from "../workers/browser.ts";
import { BatchPool, SimulationClient } from "../workers/client.ts";
import { createLibrary, type LibraryState } from "./library.ts";
import { createPlayhead, type PlayheadState } from "./playhead.ts";
import { startSession } from "./session.ts";
import { createWorkbench, type WorkbenchState } from "./workbench.ts";

/** Checks policy source in its own worker, so checking never waits behind a run. */
export const checker = new SimulationClient(browserWorkerFactory);

export const workbench = createWorkbench({
  client: new SimulationClient(browserWorkerFactory),
  pool: new BatchPool(browserWorkerFactory, batchPoolSize()),
});

export const playhead = createPlayhead();

export const library = createLibrary();

let sessionStarted = false;

/** Restores shared or draft work once per page load. */
export function startWorkbenchSession(): void {
  if (sessionStarted) return;
  sessionStarted = true;
  void startSession({
    workbench,
    library,
    storage: openStorage(),
    hash: window.location.hash,
    clearHash: () =>
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      ),
  }).catch((error: unknown) => {
    workbench.getState().notify("error", "session", `Could not restore your work: ${error}`);
    workbench.getState().setLoaded();
  });
}

export function useWorkbench<T>(selector: (state: WorkbenchState) => T): T {
  return useStore(workbench, selector);
}

export function usePlayhead<T>(selector: (state: PlayheadState) => T): T {
  return useStore(playhead, selector);
}

export function useLibrary<T>(selector: (state: LibraryState) => T): T {
  return useStore(library, selector);
}
