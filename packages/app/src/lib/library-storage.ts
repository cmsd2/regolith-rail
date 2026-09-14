import { createStore, delMany, entries, get, set, setMany, type UseStore } from "idb-keyval";
import type { ItemId, LibraryItem } from "./library.ts";

/** What fills the run's slots, restored on the next visit. */
export interface SessionRecord {
  slots: { scenario: ItemId; policy: ItemId; compare: ItemId | null };
  /**
   * Unlisted items the slots refer to that are neither shipped nor stored, such as a reference
   * policy for changed template parameters or a shared experiment's parts.
   */
  items: LibraryItem[];
  seed: number;
  view: "run" | "batch";
  saveReloadTest: boolean;
  batch: { seedCount: number; baseSeed: number; compare: boolean };
}

/** The player's library items and session in the browser, or nothing when storage is unavailable. */
export interface LibraryStorage {
  available: boolean;
  /** Mine and shared items, including experiments. */
  listItems(): Promise<LibraryItem[]>;
  /** Stores and removes items in one transaction each. */
  writeItems(put: readonly LibraryItem[], remove?: readonly ItemId[]): Promise<void>;
  loadSession(): Promise<SessionRecord | undefined>;
  saveSession(session: SessionRecord): Promise<void>;
}

const ITEM_PREFIX = "item:";
const SESSION_KEY = "session";

const byUpdate = (a: LibraryItem, b: LibraryItem) =>
  b.updatedAt - a.updatedAt || a.name.localeCompare(b.name);

/** Keeps the library in memory, for tests and for browsers that refuse storage. */
export function memoryLibraryStorage(available = true): LibraryStorage {
  const items = new Map<ItemId, LibraryItem>();
  let session: SessionRecord | undefined;
  return {
    available,
    listItems: async () => [...items.values()].map((item) => structuredClone(item)).sort(byUpdate),
    async writeItems(put, remove = []) {
      for (const item of put) items.set(item.id, structuredClone(item));
      for (const id of remove) items.delete(id);
    },
    loadSession: async () => (session ? structuredClone(session) : undefined),
    saveSession: async (next) => {
      session = structuredClone(next);
    },
  };
}

/** Opens the library in IndexedDB, falling back to memory for the session when the browser refuses. */
export async function openLibraryStorage(): Promise<LibraryStorage> {
  let store: UseStore;
  try {
    if (typeof indexedDB === "undefined") return memoryLibraryStorage(false);
    store = createStore("regolith-rail-library", "records");
    // Opening can fail asynchronously, for example in some private windows.
    await get("probe", store);
  } catch {
    return memoryLibraryStorage(false);
  }
  return {
    available: true,
    async listItems() {
      const all = await entries<string, LibraryItem>(store);
      return all
        .filter(([key]) => key.startsWith(ITEM_PREFIX))
        .map(([, item]) => item)
        .sort(byUpdate);
    },
    async writeItems(put, remove = []) {
      if (put.length > 0)
        await setMany(
          put.map((item) => [ITEM_PREFIX + item.id, item]),
          store,
        );
      if (remove.length > 0)
        await delMany(
          remove.map((id) => ITEM_PREFIX + id),
          store,
        );
    },
    loadSession: () => get<SessionRecord>(SESSION_KEY, store),
    saveSession: (session) => set(SESSION_KEY, session, store),
  };
}
