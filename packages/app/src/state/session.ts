import type { StoreApi } from "zustand/vanilla";
import { exampleFragment, scenarioFragment } from "../lib/examples.ts";
import {
  experimentFromShareState,
  experimentName,
  sharedExperimentId,
} from "../lib/experiments.ts";
import type { ItemId, LibraryItem } from "../lib/library.ts";
import type { LibraryStorage } from "../lib/library-storage.ts";
import { migrateStorage } from "../lib/migrate.ts";
import { decodeShare, isShareFragment } from "../lib/share.ts";
import type { WorkStorage } from "../lib/storage.ts";
import type { LibraryState } from "./library.ts";
import { storedItems, toSessionRecord, type WorkbenchState } from "./workbench.ts";

export const SAVE_DELAY_MS = 500;

export interface SessionOptions {
  workbench: StoreApi<WorkbenchState>;
  library: StoreApi<LibraryState>;
  storage: Promise<LibraryStorage>;
  /** Saved work and drafts from releases before the library, moved into it on first load. */
  formerStorage?: Promise<WorkStorage>;
  /** The URL fragment the page was opened with. */
  hash: string;
  /** Removes the share fragment, so later edits aren't mistaken for the shared work. */
  clearHash(): void;
  saveDelayMs?: number;
  now?: () => number;
}

/**
 * Restores the library and the run's slots, or opens a share link, then saves Mine items and
 * the slots shortly after each change. Returns a function that stops saving.
 */
export async function startSession(options: SessionOptions): Promise<() => void> {
  const { workbench, library } = options;
  const now = options.now ?? Date.now;
  const storage = await options.storage;
  await library.getState().attach(storage);
  const {
    notify,
    setLoaded,
    loadLibrary,
    addSharedExperiment,
    openExperiment,
    openExample,
    openLessonScenario,
  } = workbench.getState();

  if (options.formerStorage) {
    const former = await options.formerStorage;
    const migration = await migrateStorage(former, storage, now());
    if (migration.status === "failed" && storage.available) {
      notify(
        "warning",
        "migration-failed",
        "Work saved by an earlier version couldn't be moved into the library. It is still stored, and moving it will be tried again next time.",
      );
    }
  }
  const items = await storage.listItems().catch(() => []);
  const session = await storage.loadSession().catch(() => undefined);

  let shared = false;
  if (isShareFragment(options.hash)) {
    const decoded = await decodeShare(options.hash);
    options.clearHash();
    if (decoded.ok) {
      // The link becomes an experiment under Shared with me; opening it again reuses it.
      const content = experimentFromShareState(decoded.state);
      const time = now();
      const id = await sharedExperimentId(content);
      loadLibrary(items);
      addSharedExperiment({
        id,
        kind: "experiment",
        source: "shared",
        name: experimentName(content),
        content,
        createdAt: time,
        updatedAt: time,
      });
      openExperiment(id);
      shared = true;
      notify(
        "info",
        "share-loaded",
        "Opened a shared policy and scenario. Read the policy before pressing Run; nothing runs until you do.",
      );
      for (const warning of decoded.warnings) notify("warning", "share-version", warning);
    } else {
      notify("error", "share-damaged", decoded.error);
    }
  }
  if (!shared) loadLibrary(items, session);
  const example = exampleFragment(options.hash);
  if (example !== null) {
    options.clearHash();
    if (workbench.getState().itemById(example)?.example) openExample(example);
    else notify("warning", "example-unknown", "That documentation example no longer exists.");
  }
  const lesson = scenarioFragment(options.hash);
  if (lesson !== null) {
    options.clearHash();
    if (workbench.getState().itemById(lesson)?.kind === "scenario") openLessonScenario(lesson);
    else notify("warning", "scenario-unknown", "That scenario no longer exists.");
  }
  if (!storage.available) {
    notify(
      "warning",
      "storage-unavailable",
      "This browser isn't letting the site store data, so your work won't be kept after you leave. Running and share links still work.",
    );
  }
  setLoaded();

  if (!storage.available) return () => {};
  const delay = options.saveDelayMs ?? SAVE_DELAY_MS;
  const snapshot = (state: WorkbenchState) => ({
    items: new Map(storedItems(state).map((item) => [item.id, item])),
    session: JSON.stringify(toSessionRecord(state)),
  });
  // What storage holds now; anything the session added while starting, such as a shared
  // experiment, differs from it and is saved straight away.
  let written = {
    items: new Map(items.map((item) => [item.id, item])),
    session: session ? JSON.stringify(session) : "",
  };
  let latest = written;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const save = () => {
    timer = undefined;
    const target = latest;
    const put: LibraryItem[] = [];
    const remove: ItemId[] = [];
    for (const [id, item] of target.items) if (written.items.get(id) !== item) put.push(item);
    for (const id of written.items.keys()) if (!target.items.has(id)) remove.push(id);
    const sessionChanged = target.session !== written.session;
    written = target;
    storage
      .writeItems(put, remove)
      .then(() => (sessionChanged ? storage.saveSession(JSON.parse(target.session)) : undefined))
      .then(
        () => library.getState().setDraftStatus(timer === undefined ? "saved" : "pending"),
        () => library.getState().setDraftStatus("failed"),
      );
  };

  const changed = (state: WorkbenchState) => {
    const next = snapshot(state);
    const same =
      next.session === latest.session &&
      next.items.size === latest.items.size &&
      [...next.items].every(([id, item]) => latest.items.get(id) === item);
    if (same) return;
    latest = next;
    library.getState().setDraftStatus("pending");
    clearTimeout(timer);
    timer = setTimeout(save, delay);
  };
  changed(workbench.getState());
  const unsubscribe = workbench.subscribe(changed);
  const flush = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      save();
    }
  };
  globalThis.addEventListener?.("pagehide", flush);
  return () => {
    unsubscribe();
    clearTimeout(timer);
    globalThis.removeEventListener?.("pagehide", flush);
  };
}
