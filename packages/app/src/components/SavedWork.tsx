import { useState } from "react";
import type { LibraryItem } from "../lib/library.ts";
import { useLibrary, useWorkbench, workbench } from "../state/instance.ts";
import styles from "./EditorPanel.module.css";

type Kind = "policy" | "scenario";

const DRAFT_LABELS = {
  none: "",
  pending: "Saving…",
  saved: "Draft saved",
  failed: "Draft not saved",
} as const;

function SavedRow({ item }: { item: LibraryItem }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(item.name);
  const [confirming, setConfirming] = useState(false);
  const { renameItem, deleteItem, fillSlot } = workbench.getState();

  return (
    <li data-testid="saved-item">
      {renaming ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const next = name.trim();
            if (next) renameItem(item.id, next);
            setRenaming(false);
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="New name"
            data-testid="saved-rename-input"
          />
          <button type="submit">Rename</button>
        </form>
      ) : (
        <span className={styles.savedName}>{item.name}</span>
      )}
      <button
        type="button"
        onClick={() => fillSlot(item.kind === "policy" ? "policy" : "scenario", item.id)}
        data-testid="saved-open"
      >
        Open
      </button>
      {!renaming && (
        <button type="button" onClick={() => setRenaming(true)} data-testid="saved-rename">
          Rename
        </button>
      )}
      {confirming ? (
        <button
          type="button"
          className={styles.danger}
          onClick={() => deleteItem(item.id)}
          onBlur={() => setConfirming(false)}
          data-testid="saved-delete-confirm"
        >
          Delete for good
        </button>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} data-testid="saved-delete">
          Delete
        </button>
      )}
    </li>
  );
}

/** Names and opens the player's own policies or scenarios, matching the open editor tab. */
export function SavedWork({ kind }: { kind: Kind }) {
  const available = useLibrary((s) => s.available);
  const draft = useLibrary((s) => s.draft);
  const allItems = useWorkbench((s) => s.items);
  const currentName = useWorkbench((s) =>
    kind === "policy" ? s.policy.name : (s.itemById(s.slots.scenario)?.name ?? "scenario"),
  );
  const [name, setName] = useState<string | null>(null);

  if (available === false) return null;
  const items = Object.values(allItems)
    .filter((item) => item.kind === kind && item.source === "mine" && item.listed !== false)
    .sort((a, b) => a.name.localeCompare(b.name));
  const current = name ?? currentName;

  function save() {
    const trimmed = current.trim();
    if (!trimmed) return;
    workbench.getState().saveSlotAs(kind === "policy" ? "policy" : "scenario", trimmed);
    setName(null);
  }

  return (
    <details className={styles.saved} data-testid={`saved-${kind}`}>
      <summary>
        Saved {kind === "policy" ? "policies" : "scenarios"} ({items.length})
        <span className={styles.draft} data-testid="draft-status">
          {DRAFT_LABELS[draft]}
        </span>
      </summary>
      <form
        className={styles.saveRow}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input
          value={current}
          onChange={(e) => setName(e.target.value)}
          aria-label={`Name for this ${kind}`}
          data-testid="save-name"
        />
        <button type="submit" data-testid="save">
          Save
        </button>
      </form>
      {items.length > 0 && (
        <ul className={styles.savedList}>
          {items.map((item) => (
            <SavedRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </details>
  );
}
