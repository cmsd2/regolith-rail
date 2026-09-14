import type { PolicyHooks } from "@regolith-rail/lua-runtime";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { catalogue, lessonOf } from "../lib/catalogue.ts";
import { stableHash } from "../lib/content-hash.ts";
import {
  defaultExpanded,
  fitContext,
  LISTS,
  type ListName,
  policyTree,
  type Row,
  savedRunsTree,
  scenarioTree,
  type TreeNode,
  treeKey,
  unfitReason,
  visibleRows,
} from "../lib/explorer.ts";
import { exportFile, importFile } from "../lib/files.ts";
import { docsHref } from "../lib/format.ts";
import {
  type ItemKind,
  isEditable,
  type LibraryItem,
  parsePartId,
  SOURCES,
} from "../lib/library.ts";
import { checker, useLibrary, useWorkbench, workbench } from "../state/instance.ts";
import { type SlotName, storedItems } from "../state/workbench.ts";
import styles from "./LibraryExplorer.module.css";
import { TemplateForm } from "./TemplateForm.tsx";

const SLOT_LABELS: Record<SlotName, string> = {
  scenario: "Scenario",
  policy: "Policy",
  compare: "Compare",
};
const SLOT_LISTS: Record<SlotName, ListName> = {
  scenario: "scenario",
  policy: "policy",
  compare: "policy",
};
const SAVING_LABELS = {
  none: "",
  pending: "Saving…",
  saved: "Saved",
  failed: "Not saved",
} as const;

const sourceLabel = (item: LibraryItem) =>
  SOURCES.find((s) => s.source === item.source)?.label ?? "";

/** Where a slot's item comes from, such as "Built in" or "Mine, copied from naive". */
function useOrigin(item: LibraryItem | undefined): string {
  const origin = useWorkbench((s) => (item?.origin ? s.itemById(item.origin) : undefined));
  const experiment = useWorkbench((s) => {
    const part = item ? parsePartId(item.id) : null;
    return part ? s.itemById(part.experiment) : undefined;
  });
  if (!item) return "";
  if (parsePartId(item.id)) return `From the saved run ${experiment?.name ?? ""}`.trim();
  if (item.listed === false && item.source === "mine") return "Unsaved copy";
  const label = sourceLabel(item);
  return origin && item.source === "mine" ? `${label}, copied from ${origin.name}` : label;
}

function download(item: LibraryItem) {
  const file = exportFile(item);
  const url = URL.createObjectURL(new Blob([file.text], { type: file.type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Puts an item in the slot for its kind, or opens a saved run. Nothing runs. */
function putInRun(item: LibraryItem) {
  const state = workbench.getState();
  if (item.kind === "experiment") state.openExperiment(item.id);
  else if (item.kind === "scenario") {
    state.fillSlot("scenario", item.id);
    state.setEditorTab("scenario");
  } else if (state.choosing === "compare") {
    state.fillSlot("compare", item.id);
  } else {
    state.fillSlot("policy", item.id);
    state.setEditorTab("policy");
  }
  state.chooseFor(null);
}

/** What the scenario in the Scenario slot teaches, and the policy that goes with it. */
function ScenarioLesson() {
  const lesson = useWorkbench((s) => lessonOf(s.itemById(s.slots.scenario), s.itemById));
  const template = useWorkbench((s) => s.scenario.template?.name);
  if (!lesson) return null;
  const starter = lesson.docs.startsWith("failure-modes/");
  return (
    <div className={styles.lesson}>
      {lesson.docs && (
        <a href={docsHref(lesson.docs)} data-docs={lesson.docs} data-testid="scenario-docs">
          {starter ? "Why it fails" : "About this problem"}
        </a>
      )}
      {lesson.fix && (
        <button
          type="button"
          onClick={() => workbench.getState().applySuggestedFix()}
          data-testid="slot-fix"
        >
          Try the suggested fix
        </button>
      )}
      {lesson.reference && template === lesson.reference && (
        <button
          type="button"
          onClick={() => workbench.getState().applyReferencePolicy()}
          data-testid="slot-reference"
        >
          Use the reference policy
        </button>
      )}
    </div>
  );
}

/** The template's parameters, folded away until the player opens them. */
function TemplateParameters() {
  const template = useWorkbench((s) => s.scenario.template?.name);
  if (!template) return null;
  return (
    <details className={styles.params}>
      <summary data-testid="template-params-toggle">Parameters</summary>
      <TemplateForm />
    </details>
  );
}

function Slot({ slot }: { slot: SlotName }) {
  const item = useWorkbench((s) => s.itemById(s.slots[slot]));
  const choosing = useWorkbench((s) => s.choosing === slot);
  const origin = useOrigin(item);
  return (
    <div className={styles.slot} data-testid={`slot-${slot}`} data-item-id={item?.id}>
      <div className={styles.slotRow}>
        <span className={styles.slotLabel}>{SLOT_LABELS[slot]}</span>
        <span className={styles.slotName} data-testid={`slot-${slot}-name`}>
          {item?.name}
        </span>
        <button
          type="button"
          aria-pressed={choosing}
          onClick={() => workbench.getState().chooseFor(choosing ? null : slot)}
          data-testid={`slot-choose-${slot}`}
        >
          {choosing ? "Cancel" : "Choose…"}
        </button>
      </div>
      <div className={styles.origin}>{origin}</div>
      {slot === "scenario" && (
        <>
          <ScenarioLesson />
          <TemplateParameters />
        </>
      )}
    </div>
  );
}

/** The run's slots, and saving the run as an experiment. */
function ThisRun() {
  const comparing = useWorkbench((s) => s.view === "batch" && s.batch.compare);
  const saving = useLibrary((s) => s.draft);
  const available = useLibrary((s) => s.available);
  const opened = useWorkbench((s) =>
    s.openedExperiment ? s.items[s.openedExperiment] : undefined,
  );
  const [naming, setNaming] = useState<string | null>(null);
  return (
    <section className={styles.thisRun} aria-label="This run" data-testid="this-run">
      <header className={styles.heading}>
        <h2>This run</h2>
        {available && (
          <span className={styles.muted} data-testid="saving-status">
            {SAVING_LABELS[saving]}
          </span>
        )}
      </header>
      <Slot slot="scenario" />
      <Slot slot="policy" />
      {comparing && <Slot slot="compare" />}
      <div className={styles.actions}>
        {naming === null ? (
          <button type="button" onClick={() => setNaming("")} data-testid="save-experiment">
            Save run…
          </button>
        ) : (
          <form
            className={styles.inline}
            onSubmit={(e) => {
              e.preventDefault();
              workbench.getState().saveExperiment(naming);
              setNaming(null);
            }}
          >
            <input
              value={naming}
              onChange={(e) => setNaming(e.target.value)}
              placeholder="Name for this run"
              aria-label="Name for this run"
              data-testid="experiment-name"
              // biome-ignore lint/a11y/noAutofocus: the field appears because the player asked to name the run.
              autoFocus
            />
            <button type="submit" data-testid="experiment-save">
              Save
            </button>
            <button type="button" onClick={() => setNaming(null)}>
              Cancel
            </button>
          </form>
        )}
        {opened?.kind === "experiment" && isEditable(opened.id) && (
          <button
            type="button"
            onClick={() => workbench.getState().updateExperiment(opened.id)}
            data-testid="update-experiment"
          >
            Update {opened.name}
          </button>
        )}
      </div>
    </section>
  );
}

function Details({ item, unfit }: { item: LibraryItem; unfit: string | null }) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const { renameItem, duplicateItem, deleteItem } = workbench.getState();
  const editable = isEditable(item.id);
  const summary =
    item.kind === "experiment"
      ? `${item.content.scenario.name} · ${item.content.policy.name}`
      : item.description || sourceLabel(item);
  return (
    <section className={styles.details} aria-label="Selected item" data-testid="item-details">
      {renaming === null ? (
        <strong data-testid="item-details-name">{item.name}</strong>
      ) : (
        <form
          className={styles.inline}
          onSubmit={(e) => {
            e.preventDefault();
            renameItem(item.id, renaming);
            setRenaming(null);
          }}
        >
          <input
            value={renaming}
            onChange={(e) => setRenaming(e.target.value)}
            aria-label="New name"
            data-testid="item-rename-input"
            // biome-ignore lint/a11y/noAutofocus: the field appears because the player asked to rename.
            autoFocus
          />
          <button type="submit">Rename</button>
        </form>
      )}
      <p className={styles.description} data-testid="item-description">
        {summary}
      </p>
      {unfit && (
        <p className={styles.unfit} data-testid="item-unfit">
          {unfit}
        </p>
      )}
      <div className={styles.actions}>
        <button type="button" onClick={() => putInRun(item)} data-testid="item-use">
          {item.kind === "experiment" ? "Open" : "Use"}
        </button>
        {editable && renaming === null && (
          <button type="button" onClick={() => setRenaming(item.name)} data-testid="item-rename">
            Rename
          </button>
        )}
        <button type="button" onClick={() => duplicateItem(item.id)} data-testid="item-duplicate">
          Duplicate
        </button>
        <button type="button" onClick={() => download(item)} data-testid="item-export">
          Export
        </button>
        {editable &&
          (confirming ? (
            <button
              type="button"
              className={styles.danger}
              onClick={() => deleteItem(item.id)}
              onBlur={() => setConfirming(false)}
              data-testid="item-delete-confirm"
            >
              Delete for good
            </button>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} data-testid="item-delete">
              Delete
            </button>
          ))}
      </div>
    </section>
  );
}

function ImportMenu() {
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<ItemKind>("policy");
  const choose = (next: ItemKind) => {
    setKind(next);
    if (input.current) {
      input.current.accept =
        next === "policy" ? ".lua" : next === "scenario" ? ".lua,.json" : ".json";
      input.current.click();
    }
  };
  return (
    <details className={styles.menu}>
      <summary data-testid="import">Import…</summary>
      <div className={styles.menuItems}>
        <button type="button" onClick={() => choose("policy")} data-testid="import-policy">
          Policy
        </button>
        <button type="button" onClick={() => choose("scenario")} data-testid="import-scenario">
          Scenario
        </button>
        <button type="button" onClick={() => choose("experiment")} data-testid="import-experiment">
          Saved run
        </button>
      </div>
      <input
        ref={input}
        type="file"
        hidden
        data-testid="import-file"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          const state = workbench.getState();
          const result = importFile(
            kind,
            { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) },
            storedItems(state),
            Date.now(),
          );
          if (result.ok) {
            state.addItem(result.item);
            state.notify("info", "import-done", `Imported ${result.item.name} into Mine.`);
          } else {
            state.notify("error", "import-rejected", result.message);
          }
          (e.target.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
        }}
      />
    </details>
  );
}

/** The hooks of each policy, loaded in the checker worker and kept by a hash of the source. */
const hooksCache = new Map<string, PolicyHooks | Promise<void>>();

function usePolicyHooks(policies: readonly LibraryItem[]): (source: string) => PolicyHooks | null {
  const [, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    for (const item of policies) {
      if (item.kind !== "policy") continue;
      const key = stableHash(item.content);
      if (hooksCache.has(key)) continue;
      hooksCache.set(
        key,
        checker.hooks(item.content).then(
          (hooks) => {
            hooksCache.set(key, hooks);
            if (live) setVersion((v) => v + 1);
          },
          () => {
            hooksCache.delete(key);
          },
        ),
      );
    }
    return () => {
      live = false;
    };
  }, [policies]);
  return (source) => {
    const cached = hooksCache.get(stableHash(source));
    return cached && !(cached instanceof Promise) ? cached : null;
  };
}

/** The run's slots above three lists: scenarios, policies and saved runs. */
export function LibraryExplorer() {
  const items = useWorkbench((s) => s.items);
  const slots = useWorkbench((s) => s.slots);
  const choosing = useWorkbench((s) => s.choosing);
  const scenario = useWorkbench((s) => s.scenario.scenario);
  const scenarioItem = useWorkbench((s) => s.itemById(s.slots.scenario));
  const [list, setList] = useState<ListName>("scenario");
  const stored = useMemo(() => Object.values(items), [items]);
  const context = useMemo(
    () => fitContext(scenarioItem, (id) => workbench.getState().itemById(id)),
    [scenarioItem],
  );
  const trees = useMemo<Record<ListName, TreeNode[]>>(
    () => ({
      scenario: scenarioTree(catalogue, stored),
      policy: policyTree(catalogue, stored, context),
      experiment: savedRunsTree(stored),
    }),
    [stored, context],
  );
  const tree = trees[list];
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const rows = useMemo(() => visibleRows(tree, expanded), [tree, expanded]);
  const [focus, setFocus] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const focusKey = rows.some((r) => r.node.key === focus) ? focus : (rows[0]?.node.key ?? null);
  const focusedRow = rows.find((r) => r.node.key === focusKey);
  const focusedItem = focusedRow?.node.type === "item" ? focusedRow.node.item : undefined;
  const policies = useMemo(
    () =>
      list === "policy" ? rows.flatMap((r) => (r.node.type === "item" ? [r.node.item] : [])) : [],
    [list, rows],
  );
  const hooksOf = usePolicyHooks(policies);
  const unfit = (item: LibraryItem) => {
    if (item.kind !== "policy" || !scenario) return null;
    const hooks = hooksOf(item.content);
    return hooks ? unfitReason(hooks, scenario) : null;
  };
  const inSlots = new Map<string, SlotName[]>();
  for (const slot of ["scenario", "policy", "compare"] as const) {
    inSlots.set(slots[slot], [...(inSlots.get(slots[slot]) ?? []), slot]);
  }

  // Choosing a slot shows its list.
  useEffect(() => {
    if (choosing) setList(SLOT_LISTS[choosing]);
  }, [choosing]);

  // Each group starts open or collapsed, as its list intends, the first time it appears.
  useEffect(() => {
    setExpanded((current) => {
      const fresh = Object.values(trees)
        .flat()
        .filter((n) => n.type === "group" && !current.has(`seen:${n.key}`));
      if (fresh.length === 0) return current;
      const next = new Set(current);
      for (const key of defaultExpanded(fresh)) next.add(key);
      for (const node of fresh) next.add(`seen:${node.key}`);
      return next;
    });
  }, [trees]);

  useEffect(() => {
    if (!choosing) return;
    const cancel = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") workbench.getState().chooseFor(null);
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [choosing]);

  function toggle(row: Row) {
    setExpanded((current) => {
      const next = new Set(current);
      if (row.expanded) next.delete(row.node.key);
      else next.add(row.node.key);
      return next;
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const move = treeKey(rows, focusKey, event.key, expanded);
    if (!move) return;
    event.preventDefault();
    setExpanded(move.expanded);
    setFocus(move.focus);
    if (move.focus) rowRefs.current.get(move.focus)?.focus();
    const target = move.use ? rows.find((r) => r.node.key === move.use) : undefined;
    if (target?.node.type === "item") putInRun(target.node.item);
  }

  return (
    <aside className={styles.explorer} aria-label="Library" data-testid="library-explorer">
      <ThisRun />
      <div className={styles.toolbar}>
        <div role="tablist" aria-label="Library lists" className={styles.tabs}>
          {LISTS.map(({ list: name, label }) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={list === name}
              onClick={() => setList(name)}
              data-testid={`library-tab-${name}`}
            >
              {label}
            </button>
          ))}
        </div>
        <ImportMenu />
      </div>
      {choosing && (
        <p className={styles.choosing} data-testid="choosing">
          Choose for the {SLOT_LABELS[choosing]} slot: double-click an item, or select it and press
          Use.{" "}
          <button type="button" onClick={() => workbench.getState().chooseFor(null)}>
            Cancel
          </button>
        </p>
      )}
      <div
        className={styles.tree}
        role="tree"
        aria-label={LISTS.find((l) => l.list === list)?.label}
        onKeyDown={onKeyDown}
        data-testid="library-tree"
        data-list={list}
      >
        {rows.length === 0 && (
          <p className={styles.empty}>
            {list === "experiment"
              ? "Runs you save, and runs from share links, appear here."
              : "Nothing here yet."}
          </p>
        )}
        {rows.map((row) => {
          const { node } = row;
          const item = node.type === "item" ? node.item : undefined;
          const used = item ? inSlots.get(item.id) : undefined;
          const reason = item ? unfit(item) : null;
          return (
            // Keys are handled by the tree as a whole, following the ARIA tree view pattern.
            // biome-ignore lint/a11y/useKeyWithClickEvents: the tree's onKeyDown handles every row.
            <div
              key={node.key}
              ref={(el) => {
                if (el) rowRefs.current.set(node.key, el);
                else rowRefs.current.delete(node.key);
              }}
              role="treeitem"
              aria-level={row.depth}
              aria-expanded={node.children.length > 0 ? row.expanded : undefined}
              aria-selected={node.key === focusKey}
              aria-current={used ? "true" : undefined}
              tabIndex={node.key === focusKey ? 0 : -1}
              className={styles.row}
              data-type={node.type}
              data-item-id={item?.id}
              data-unfit={reason ? "true" : undefined}
              data-testid={item ? "library-item" : `library-group-${node.key}`}
              style={{ paddingLeft: `${(row.depth - 1) * 0.9 + 0.5}rem` }}
              title={reason ?? item?.description}
              onFocus={() => setFocus(node.key)}
              onClick={() => {
                setFocus(node.key);
                if (!item) toggle(row);
              }}
              onDoubleClick={() => {
                if (item) putInRun(item);
              }}
            >
              {node.children.length > 0 && (
                <span className={styles.twisty} aria-hidden="true">
                  {row.expanded ? "▾" : "▸"}
                </span>
              )}
              <span className={styles.label}>{item ? item.name : rowGroupLabel(node)}</span>
              {item?.kind === "experiment" && (
                <span className={styles.secondary}>{item.content.scenario.name}</span>
              )}
              {used && (
                <span className={styles.mark} data-testid="in-slot">
                  {used.map((slot) => SLOT_LABELS[slot]).join(", ")}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {/* Always present, so selecting a row never moves the rows under the pointer. */}
      {focusedItem ? (
        <Details key={focusedItem.id} item={focusedItem} unfit={unfit(focusedItem)} />
      ) : (
        <section className={styles.details} aria-label="Selected item" data-testid="item-details">
          <p className={styles.description}>
            Select an item to see what it is. Double-click it, or press Use, to put it in the run.
          </p>
        </section>
      )}
    </aside>
  );
}

const rowGroupLabel = (node: TreeNode) => (node.type === "group" ? node.label : "");
