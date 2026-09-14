import { createStore, type StoreApi } from "zustand/vanilla";
import type { LibraryStorage } from "../lib/library-storage.ts";

export type DraftStatus = "none" | "pending" | "saved" | "failed";

export interface LibraryState {
  /** Unknown until storage has been opened. */
  available: boolean | null;
  /** Whether the latest changes to Mine items and slots have been saved. */
  draft: DraftStatus;

  attach(storage: LibraryStorage): Promise<void>;
  setDraftStatus(draft: DraftStatus): void;
}

/** Whether the player's library is kept in the browser, and how saving is going. */
export function createLibrary(): StoreApi<LibraryState> {
  return createStore<LibraryState>()((set) => ({
    available: null,
    draft: "none",
    attach: async (storage) => set({ available: storage.available }),
    setDraftStatus: (draft) => set({ draft }),
  }));
}
