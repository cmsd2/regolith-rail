import { createStore, type StoreApi } from "zustand/vanilla";
import type { SavedItem, WorkStorage } from "../lib/storage.ts";

export type DraftStatus = "none" | "pending" | "saved" | "failed";

export interface LibraryState {
  /** Unknown until storage has been opened. */
  available: boolean | null;
  items: SavedItem[];
  draft: DraftStatus;

  attach(storage: WorkStorage): Promise<void>;
  setDraftStatus(draft: DraftStatus): void;
  save(item: SavedItem): Promise<void>;
  rename(kind: SavedItem["kind"], from: string, to: string): Promise<void>;
  remove(kind: SavedItem["kind"], name: string): Promise<void>;
}

/** Named policies and scenarios saved in the browser. */
export function createLibrary(): StoreApi<LibraryState> {
  let storage: WorkStorage | undefined;
  return createStore<LibraryState>()((set) => {
    const refresh = async () => {
      if (storage) set({ items: await storage.list() });
    };
    return {
      available: null,
      items: [],
      draft: "none",

      async attach(opened) {
        storage = opened;
        set({ available: opened.available });
        await refresh();
      },
      setDraftStatus: (draft) => set({ draft }),
      async save(item) {
        await storage?.save(item);
        await refresh();
      },
      async rename(kind, from, to) {
        await storage?.rename(kind, from, to);
        await refresh();
      },
      async remove(kind, name) {
        await storage?.remove(kind, name);
        await refresh();
      },
    };
  });
}
