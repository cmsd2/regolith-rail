import type { StoreApi } from "zustand/vanilla";
import { upgradeScenarioRecord } from "../lib/scenario-source.ts";
import { decodeShare, isShareFragment, scenarioRecord } from "../lib/share.ts";
import type { Draft, WorkStorage } from "../lib/storage.ts";
import type { LibraryState } from "./library.ts";
import type { WorkbenchState } from "./workbench.ts";

export const DRAFT_DELAY_MS = 500;

export interface SessionOptions {
  workbench: StoreApi<WorkbenchState>;
  library: StoreApi<LibraryState>;
  storage: Promise<WorkStorage>;
  /** The URL fragment the page was opened with. */
  hash: string;
  /** Removes the share fragment, so later edits aren't mistaken for the shared work. */
  clearHash(): void;
  draftDelayMs?: number;
}

const draftOf = (s: WorkbenchState): Draft => ({
  policy: s.policy,
  policyB: s.policyB,
  scenario: scenarioRecord(s.scenario),
  seed: s.seed,
});

/**
 * Restores shared or draft work, then saves drafts as the player edits. Returns a
 * function that stops saving drafts.
 */
export async function startSession(options: SessionOptions): Promise<() => void> {
  const { workbench, library } = options;
  const storage = await options.storage;
  await library.getState().attach(storage);
  const { notify, restore, setLoaded } = workbench.getState();

  let shared = false;
  if (isShareFragment(options.hash)) {
    const decoded = await decodeShare(options.hash);
    options.clearHash();
    if (decoded.ok) {
      restore(decoded.state);
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
  if (!shared) {
    const draft = await storage.loadDraft().catch(() => undefined);
    const scenario = draft && upgradeScenarioRecord(draft.scenario);
    if (draft && scenario) restore({ ...draft, scenario });
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
  const delay = options.draftDelayMs ?? DRAFT_DELAY_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = draftOf(workbench.getState());
  const save = () => {
    timer = undefined;
    storage.saveDraft(last).then(
      () => library.getState().setDraftStatus(timer === undefined ? "saved" : "pending"),
      () => library.getState().setDraftStatus("failed"),
    );
  };
  const unsubscribe = workbench.subscribe((state) => {
    const next = draftOf(state);
    if (
      next.policy === last.policy &&
      next.policyB === last.policyB &&
      next.scenario.source === last.scenario.source &&
      next.scenario.kind === last.scenario.kind &&
      next.scenario.starterId === last.scenario.starterId &&
      next.scenario.template === last.scenario.template &&
      next.seed === last.seed
    ) {
      return;
    }
    last = next;
    library.getState().setDraftStatus("pending");
    clearTimeout(timer);
    timer = setTimeout(save, delay);
  });
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
