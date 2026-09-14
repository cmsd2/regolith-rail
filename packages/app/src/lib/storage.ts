import { clear, createStore, del, get, set, type UseStore, values } from "idb-keyval";
import type { ScenarioKind, ScenarioSource } from "./scenario-source.ts";

export interface SavedPolicy {
  kind: "policy";
  name: string;
  source: string;
  savedAt: number;
}

export interface SavedScenario {
  kind: "scenario";
  name: string;
  text: string;
  /** Whether the text is a script or JSON; saves from before scripts hold JSON. */
  scenarioKind?: ScenarioKind;
  savedAt: number;
}

export type SavedItem = SavedPolicy | SavedScenario;

export interface Draft {
  policy: { name: string; source: string };
  policyB: { name: string; source: string };
  /** A scenario record; drafts from before scenario scripts hold `{ starterId, text }`. */
  scenario: ScenarioSource;
  seed: number;
}

/** Saved work in the browser, or nothing when storage is unavailable. */
export interface WorkStorage {
  available: boolean;
  list(): Promise<SavedItem[]>;
  save(item: SavedItem): Promise<void>;
  remove(kind: SavedItem["kind"], name: string): Promise<void>;
  rename(kind: SavedItem["kind"], from: string, to: string): Promise<void>;
  loadDraft(): Promise<Draft | undefined>;
  saveDraft(draft: Draft): Promise<void>;
  /** Removes every saved item and the draft, once they have been moved into the library. */
  clear(): Promise<void>;
}

const key = (kind: SavedItem["kind"], name: string) => `${kind}:${name}`;

function unavailable(): WorkStorage {
  const nothing = async () => {};
  return {
    available: false,
    list: async () => [],
    save: nothing,
    remove: nothing,
    rename: nothing,
    loadDraft: async () => undefined,
    saveDraft: nothing,
    clear: nothing,
  };
}

/** Keeps work in memory only, for tests. */
export function memoryStorage(): WorkStorage {
  const items = new Map<string, SavedItem>();
  let draft: Draft | undefined;
  return {
    available: true,
    list: async () =>
      [...items.values()].sort(
        (a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name),
      ),
    save: async (item) => void items.set(key(item.kind, item.name), item),
    remove: async (kind, name) => void items.delete(key(kind, name)),
    async rename(kind, from, to) {
      const item = items.get(key(kind, from));
      if (!item || from === to) return;
      items.set(key(kind, to), { ...item, name: to });
      items.delete(key(kind, from));
    },
    loadDraft: async () => draft,
    saveDraft: async (next) => {
      draft = next;
    },
    clear: async () => {
      items.clear();
      draft = undefined;
    },
  };
}

export const unavailableStorage = unavailable;

/** Opens IndexedDB storage, falling back to no storage when the browser refuses. */
export async function openStorage(): Promise<WorkStorage> {
  let saved: UseStore;
  let drafts: UseStore;
  try {
    if (typeof indexedDB === "undefined") return unavailable();
    saved = createStore("regolith-rail-saved", "items");
    drafts = createStore("regolith-rail-drafts", "drafts");
    // Opening can fail asynchronously, for example in some private windows.
    await get("probe", drafts);
  } catch {
    return unavailable();
  }
  return {
    available: true,
    async list() {
      const items = await values<SavedItem>(saved);
      return items.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
    },
    save: (item) => set(key(item.kind, item.name), item, saved),
    remove: (kind, name) => del(key(kind, name), saved),
    async rename(kind, from, to) {
      const item = await get<SavedItem>(key(kind, from), saved);
      if (!item || from === to) return;
      await set(key(kind, to), { ...item, name: to }, saved);
      await del(key(kind, from), saved);
    },
    loadDraft: () => get<Draft>("current", drafts),
    saveDraft: (draft) => set("current", draft, drafts),
    async clear() {
      await clear(saved);
      await clear(drafts);
    },
  };
}
