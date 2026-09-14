import { useState } from "react";
import { upgradeScenarioRecord } from "../lib/scenario-source.ts";
import type { SavedItem } from "../lib/storage.ts";
import { library, useLibrary, useWorkbench, workbench } from "../state/instance.ts";
import styles from "./EditorPanel.module.css";

type Kind = SavedItem["kind"];

const DRAFT_LABELS = {
  none: "",
  pending: "Saving draft…",
  saved: "Draft saved",
  failed: "Draft not saved",
} as const;

function SavedRow({ item }: { item: SavedItem }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(item.name);
  const [confirming, setConfirming] = useState(false);
  const { rename, remove } = library.getState();

  function open() {
    const { setPolicy, openScenario } = workbench.getState();
    if (item.kind === "policy") {
      setPolicy({ name: item.name, source: item.source });
      return;
    }
    // Saves from before scenario scripts hold JSON text without a kind.
    const record = upgradeScenarioRecord(
      item.scenarioKind
        ? { kind: item.scenarioKind, source: item.text, starterId: null }
        : { starterId: null, text: item.text },
    );
    if (record) openScenario(record);
  }

  return (
    <li data-testid="saved-item">
      {renaming ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const next = name.trim();
            if (next) void rename(item.kind, item.name, next);
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
      <button type="button" onClick={open} data-testid="saved-open">
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
          onClick={() => void remove(item.kind, item.name)}
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

/** Saves and opens named policies or scenarios, matching the open editor tab. */
export function SavedWork({ kind }: { kind: Kind }) {
  const available = useLibrary((s) => s.available);
  const items = useLibrary((s) => s.items).filter((item) => item.kind === kind);
  const draft = useLibrary((s) => s.draft);
  const policyName = useWorkbench((s) => s.policy.name);
  const [name, setName] = useState<string | null>(null);

  if (available === false) return null;
  const defaultName =
    kind === "policy" ? policyName : (workbench.getState().scenario.scenario?.title ?? "scenario");
  const current = name ?? defaultName;

  async function save() {
    const trimmed = current.trim();
    if (!trimmed) return;
    const state = workbench.getState();
    const savedAt = Date.now();
    await library.getState().save(
      kind === "policy"
        ? { kind, name: trimmed, source: state.policy.source, savedAt }
        : {
            kind,
            name: trimmed,
            text: state.scenario.source,
            scenarioKind: state.scenario.kind,
            savedAt,
          },
    );
    if (kind === "policy") state.setPolicy({ ...state.policy, name: trimmed });
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
          void save();
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
            <SavedRow key={`${item.name}:${item.savedAt}`} item={item} />
          ))}
        </ul>
      )}
    </details>
  );
}
