import { type RunOutput, type Scenario, validateScenario } from "@regolith-rail/engine";
import { STARTER_SCRIPTS, type TemplateParams, templateCall } from "@regolith-rail/scenario-kit";
import { createStore, type StoreApi } from "zustand/vanilla";
import {
  catalogueItem,
  experimentParts,
  lessonOf,
  referenceOf,
  referencePolicyItem,
} from "../lib/catalogue.ts";
import { canonical } from "../lib/content-hash.ts";
import { experimentContentOf, experimentName } from "../lib/experiments.ts";
import {
  copyName,
  type ExperimentItem,
  type ItemId,
  isEditable,
  itemId,
  type LibraryItem,
  newMineId,
  type PolicyItem,
  parsePartId,
  type ScenarioItem,
  uniqueName,
} from "../lib/library.ts";
import { duplicated, renamed, takenNames } from "../lib/library-ops.ts";
import type { SessionRecord } from "../lib/library-storage.ts";
import {
  DEFAULT_SCENARIO,
  documentText,
  documentToScript,
  findTemplate,
  knownScenario,
  type ScenarioError,
  type ScenarioKind,
  type ScenarioSource,
} from "../lib/scenario-source.ts";
import type { BatchPool, SimulationClient } from "../workers/client.ts";
import { CancelledError } from "../workers/client.ts";
import type { SeedResult } from "../workers/protocol.ts";

export { DEFAULT_SCENARIO };

export type RunStatus = "idle" | "running" | "done" | "failed";

export interface PolicyDraft {
  /** Name of the library item the policy comes from. */
  name: string;
  source: string;
}

export interface ScenarioDraft extends ScenarioSource {
  /** Whether a script is still being evaluated; Run waits until it is ready. */
  status: "ready" | "evaluating";
  scenario: Scenario | null;
  errors: ScenarioError[];
}

export interface BatchState {
  seedCount: number;
  baseSeed: number;
  compare: boolean;
  status: RunStatus;
  done: number;
  total: number;
  results: { a: SeedResult[]; b?: SeedResult[] } | null;
  error: string | null;
}

export interface Notice {
  id: number;
  kind: "error" | "warning" | "info";
  message: string;
  /** Identifies the kind of notice, for tests and styling. */
  topic: string;
}

export type SlotName = "scenario" | "policy" | "compare";

/** The library items the run uses. */
export interface Slots {
  scenario: ItemId;
  policy: ItemId;
  compare: ItemId;
}

export const DEFAULT_SLOTS: Slots = {
  scenario: itemId("builtin", "scenario", DEFAULT_SCENARIO),
  policy: itemId("builtin", "policy", "naive"),
  compare: itemId("builtin", "policy", "supply-to-demand"),
};

export interface WorkbenchState {
  /** Whether the session has restored any shared or saved work. */
  loaded: boolean;
  notices: Notice[];
  view: "run" | "batch";
  /** Which library items fill the run. */
  slots: Slots;
  /** The experiment last opened or saved, which the run can update. */
  openedExperiment: ItemId | null;
  /** The slot the player is choosing an item for; the explorer shows only that kind meanwhile. */
  choosing: SlotName | null;
  /** Mine and shared items, and unlisted items a slot uses; shipped items come from the catalogue. */
  items: Record<ItemId, LibraryItem>;
  /** The Policy slot's item, as the editor and runs use it. */
  policy: PolicyDraft;
  /** The Compare slot's item. */
  policyB: PolicyDraft;
  /** The Scenario slot's item, with its evaluation. */
  scenario: ScenarioDraft;
  seed: number;
  saveReloadTest: boolean;
  run: {
    status: RunStatus;
    progress: number;
    output: RunOutput | null;
    error: string | null;
  };
  selectedStop: number | null;
  selectedReview: number | null;
  batch: BatchState;
  editorTab: "policy" | "scenario";
  /** Documentation pages opened in the panel, most recent last; empty when closed. */
  docs: string[];
  /** Asks the policy editor to scroll to and highlight a line. */
  reveal: { line: number; nonce: number } | null;

  setLoaded(): void;
  notify(kind: Notice["kind"], topic: string, message: string): void;
  dismissNotice(id: number): void;
  /** The item with this id, stored, in use or shipped. */
  itemById(id: ItemId): LibraryItem | undefined;
  /** Puts stored items in the library and, when there is one, restores the session's slots. */
  loadLibrary(items: readonly LibraryItem[], session?: SessionRecord): void;
  /** Fills a slot with a library item of the matching kind. Nothing runs. */
  fillSlot(slot: SlotName, id: ItemId): void;
  /** Starts or cancels choosing an item for a slot. */
  chooseFor(slot: SlotName | null): void;
  /** Fills the Policy slot with the naive baseline that a starter's lesson is about. */
  applyBaseline(): void;
  /** Fills the Policy slot with the fix the Scenario slot's lesson suggests. */
  applySuggestedFix(): void;
  /** Sets up a batch comparing the suggested fix, as policy A, with the naive baseline. Nothing runs. */
  compareFixWithBaseline(): void;
  /** Fills the Policy slot with the reference policy for the Scenario slot's template parameters. */
  applyReferencePolicy(): void;
  /**
   * Opens a documentation example: its policy with the scenario it runs on, or its scenario
   * script, with its seed. Nothing runs.
   */
  openExample(id: ItemId): void;
  /** Fills every slot from an experiment and restores its seed, batch settings and view. Nothing runs. */
  openExperiment(id: ItemId): void;
  /** Saves the current run as a new Mine experiment and returns its id. */
  saveExperiment(name?: string): ItemId;
  /** Rewrites a Mine experiment from the current run. */
  updateExperiment(id: ItemId): void;
  /** Adds an experiment from a share link to the library, unless it is already there. */
  addSharedExperiment(item: ExperimentItem): void;
  /** Adds an imported item to Mine. */
  addItem(item: LibraryItem): void;
  renameItem(id: ItemId, name: string): void;
  /** Keeps a slot's item under Mine with a name: renames a Mine item, or copies anything else. */
  saveSlotAs(slot: SlotName, name: string): void;
  /** Copies any item into Mine and returns the copy's id. */
  duplicateItem(id: ItemId): ItemId | null;
  /** Deletes a Mine item; a slot that uses it keeps its contents as an unsaved copy. */
  deleteItem(id: ItemId): void;
  /** Opens a documentation page, such as `ops/min-max#param-low`, in the panel. */
  openDocs(target: string): void;
  docsBack(): void;
  closeDocs(): void;
  setView(view: WorkbenchState["view"]): void;
  setPolicySource(source: string): void;
  selectStarter(id: string): void;
  /** Picks a classic template with its default parameters and its reference policy. */
  selectTemplate(name: string): void;
  /** Changes parameters of the current template, rewriting its one-line script. */
  setTemplateParams(params: TemplateParams): void;
  /** Replaces the scenario source, keeping its kind. */
  setScenarioSource(source: string): void;
  /** Converts a valid scenario to a script or to JSON. */
  setScenarioKind(kind: ScenarioKind): void;
  setSeed(seed: number): void;
  setSaveReloadTest(enabled: boolean): void;
  selectStop(stop: number | null): void;
  selectReview(review: number | null): void;
  setEditorTab(tab: WorkbenchState["editorTab"]): void;
  revealPolicyLine(line: number): void;
  startRun(): Promise<void>;
  cancelRun(): void;
  setBatchOptions(options: Partial<Pick<BatchState, "seedCount" | "baseSeed" | "compare">>): void;
  startBatch(seeds: number[]): Promise<void>;
  cancelBatch(): void;
  /**
   * Opens one seed of a batch in the run view. Opening a seed of policy B swaps
   * the two policies, so the editor shows the policy that ran.
   */
  openSeed(which: "a" | "b", seed: number): Promise<void>;
}

export interface WorkbenchDependencies {
  client: SimulationClient;
  pool: BatchPool;
  /** Evaluates scenario scripts; runs use `client`, so cancelling a run leaves it alone. */
  evaluator?: SimulationClient;
  /** The time items are stamped with. */
  now?: () => number;
}

/** Parses and validates scenario text, reporting JSON syntax errors like validation errors. */
export function parseScenarioText(text: string): Pick<ScenarioDraft, "scenario" | "errors"> {
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch (error) {
    return { scenario: null, errors: [{ path: "(document)", message: (error as Error).message }] };
  }
  const result = validateScenario(document);
  return result.ok
    ? { scenario: result.scenario, errors: [] }
    : { scenario: null, errors: result.errors };
}

/** The file name a template's reference policy is shown under. */
export const referencePolicyName = (template: string) =>
  `${template.replace(/^classic\./, "").replace(/_/g, "-")}-reference.lua`;

const SLOT_KIND = { scenario: "scenario", policy: "policy", compare: "policy" } as const;

/** What the session keeps of the workbench between visits. */
export function toSessionRecord(state: WorkbenchState): SessionRecord {
  const used = [...new Set(Object.values(state.slots))];
  return {
    slots: { ...state.slots },
    items: used.flatMap((id) => {
      const item = state.items[id];
      return item && item.listed === false ? [item] : [];
    }),
    seed: state.seed,
    view: state.view,
    saveReloadTest: state.saveReloadTest,
    batch: {
      seedCount: state.batch.seedCount,
      baseSeed: state.batch.baseSeed,
      compare: state.batch.compare,
    },
  };
}

/** Items the player keeps: Mine and shared items that are listed in the library. */
export const storedItems = (state: WorkbenchState) =>
  Object.values(state.items).filter(
    (item) => item.listed !== false && (item.source === "mine" || item.source === "shared"),
  );

const policyDraft = (item: LibraryItem | undefined): PolicyDraft =>
  item?.kind === "policy" ? { name: item.name, source: item.content } : { name: "", source: "" };

export function createWorkbench(dependencies: WorkbenchDependencies): StoreApi<WorkbenchState> {
  let noticeId = 0;
  // Only the latest evaluation may update the scenario.
  let revision = 0;
  const evaluator = dependencies.evaluator ?? dependencies.client;
  const now = dependencies.now ?? Date.now;

  return createStore<WorkbenchState>()((set, get) => {
    /** A draft for a source: at once for JSON and unedited starters, later for other scripts. */
    const evaluate = (source: ScenarioSource): ScenarioDraft => {
      const current = ++revision;
      if (source.kind === "json") {
        return { ...source, status: "ready", ...parseScenarioText(source.source) };
      }
      const known = knownScenario(source);
      if (known) return { ...source, status: "ready", scenario: known, errors: [] };
      evaluator.loadScript(source.source).then(
        (result) => {
          if (current !== revision) return;
          set((s) => ({
            scenario: {
              ...s.scenario,
              status: "ready",
              scenario: result.ok ? result.scenario : null,
              errors: result.ok ? [] : result.errors,
            },
          }));
        },
        (error: unknown) => {
          if (current !== revision || error instanceof CancelledError) return;
          set((s) => ({
            scenario: {
              ...s.scenario,
              status: "ready",
              scenario: null,
              errors: [{ message: `The scenario could not be evaluated: ${error}` }],
            },
          }));
        },
      );
      return { ...source, status: "evaluating", scenario: null, errors: [] };
    };

    const lookup = (items: Record<ItemId, LibraryItem>, id: ItemId) =>
      items[id] ?? catalogueItem(id);

    /** The state for new slots and items, re-deriving only what changed. */
    const withSlots = (
      state: Pick<WorkbenchState, "slots" | "items">,
      slots: Slots,
      items: Record<ItemId, LibraryItem>,
      scenario?: ScenarioDraft,
    ): Partial<WorkbenchState> => {
      const scenarioItem = lookup(items, slots.scenario) as ScenarioItem | undefined;
      const previous = lookup(state.items, state.slots.scenario) as ScenarioItem | undefined;
      const changed =
        slots.scenario !== state.slots.scenario || scenarioItem?.content !== previous?.content;
      return {
        slots,
        items,
        policy: policyDraft(lookup(items, slots.policy)),
        policyB: policyDraft(lookup(items, slots.compare)),
        ...(scenario
          ? { scenario }
          : changed && scenarioItem
            ? { scenario: evaluate(scenarioItem.content) }
            : {}),
      };
    };

    /** Adds an unlisted item to the items in use, so a slot can refer to it. */
    const using = (items: Record<ItemId, LibraryItem>, item: LibraryItem) =>
      item.listed === false && !items[item.id] ? { ...items, [item.id]: item } : items;

    /** Items and slots after editing a slot: in place for Mine items, otherwise as a new copy. */
    const edited = (
      state: Pick<WorkbenchState, "slots" | "items">,
      slot: SlotName,
      content: string | ScenarioSource,
    ): { slots: Slots; items: Record<ItemId, LibraryItem> } => {
      const current = lookup(state.items, state.slots[slot]);
      if (!current) return state;
      const time = now();
      if (isEditable(current.id)) {
        const updated = { ...current, content, updatedAt: time } as LibraryItem;
        return { slots: state.slots, items: { ...state.items, [current.id]: updated } };
      }
      const kind = SLOT_KIND[slot];
      const copy = {
        id: newMineId(kind),
        kind,
        source: "mine",
        name: copyName(current.name, takenNames(Object.values(state.items), kind)),
        origin: current.id,
        content,
        createdAt: time,
        updatedAt: time,
      } as LibraryItem;
      return {
        slots: { ...state.slots, [slot]: copy.id },
        items: { ...state.items, [copy.id]: copy },
      };
    };

    const initialItems: Record<ItemId, LibraryItem> = {};
    const initialScenario = catalogueItem(DEFAULT_SLOTS.scenario) as ScenarioItem;

    return {
      loaded: false,
      notices: [],
      view: "run",
      slots: DEFAULT_SLOTS,
      openedExperiment: null,
      choosing: null,
      items: initialItems,
      policy: policyDraft(catalogueItem(DEFAULT_SLOTS.policy)),
      policyB: policyDraft(catalogueItem(DEFAULT_SLOTS.compare)),
      scenario: evaluate(initialScenario.content),
      seed: 1,
      saveReloadTest: false,
      run: { status: "idle", progress: 0, output: null, error: null },
      selectedStop: null,
      selectedReview: null,
      editorTab: "policy",
      docs: [],
      reveal: null,
      batch: {
        seedCount: 100,
        baseSeed: 1,
        compare: false,
        status: "idle",
        done: 0,
        total: 0,
        results: null,
        error: null,
      },

      setLoaded: () => set({ loaded: true }),
      notify: (kind, topic, message) =>
        set((s) => ({ notices: [...s.notices, { id: ++noticeId, kind, topic, message }] })),
      dismissNotice: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),

      itemById: (id) => lookup(get().items, id),

      loadLibrary(stored, session) {
        set((s) => {
          let items: Record<ItemId, LibraryItem> = {};
          for (const item of stored) items[item.id] = item;
          for (const item of session?.items ?? []) items = using(items, item);
          const valid = (id: ItemId | null | undefined, slot: SlotName) => {
            const item = id ? lookup(items, id) : undefined;
            return item?.kind === SLOT_KIND[slot] ? item.id : DEFAULT_SLOTS[slot];
          };
          const slots: Slots = session
            ? {
                scenario: valid(session.slots.scenario, "scenario"),
                policy: valid(session.slots.policy, "policy"),
                compare: valid(session.slots.compare, "compare"),
              }
            : s.slots;
          return {
            ...withSlots({ slots: s.slots, items: s.items }, slots, items),
            ...(session
              ? {
                  seed: session.seed,
                  view: session.view,
                  saveReloadTest: session.saveReloadTest,
                  batch: { ...s.batch, ...session.batch },
                }
              : {}),
          };
        });
      },

      chooseFor: (choosing) => set({ choosing }),

      applyBaseline: () => get().fillSlot("policy", DEFAULT_SLOTS.policy),

      compareFixWithBaseline() {
        const s = get();
        const fix = lessonOf(lookup(s.items, s.slots.scenario), (id) => lookup(s.items, id))?.fix;
        if (!fix) return;
        set(withSlots(s, { ...s.slots, policy: fix, compare: DEFAULT_SLOTS.policy }, s.items));
        set((next) => ({ view: "batch", batch: { ...next.batch, compare: true } }));
      },

      applySuggestedFix() {
        const s = get();
        const fix = lessonOf(lookup(s.items, s.slots.scenario), (id) => lookup(s.items, id))?.fix;
        if (fix) s.fillSlot("policy", fix);
      },

      applyReferencePolicy() {
        set((s) => {
          const template = s.scenario.template;
          if (!template || !findTemplate(template.name)) return {};
          const reference = referencePolicyItem(template.name, template.params);
          return withSlots(s, { ...s.slots, policy: reference.id }, using(s.items, reference));
        });
      },

      fillSlot(slot, id) {
        set((s) => {
          const item = lookup(s.items, id);
          if (item?.kind !== SLOT_KIND[slot]) return {};
          return withSlots(s, { ...s.slots, [slot]: id }, using(s.items, item));
        });
      },

      openExperiment(id) {
        dependencies.client.cancel();
        dependencies.pool.cancel();
        set((s) => {
          const experiment = lookup(s.items, id);
          if (experiment?.kind !== "experiment") return {};
          let items = s.items;
          const slots = { ...s.slots };
          for (const part of experimentParts(experiment)) {
            const name = parsePartId(part.id)?.part as SlotName;
            // A part still equal to the read-only item it came from fills its slot with that item,
            // so a classic reference policy keeps following its template.
            const origin = part.origin ? lookup(items, part.origin) : undefined;
            const same =
              origin !== undefined &&
              !isEditable(origin.id) &&
              origin.kind === part.kind &&
              canonical(origin.content) === canonical(part.content);
            if (same && origin) {
              items = using(items, origin);
              slots[name] = origin.id;
            } else {
              items = { ...items, [part.id]: part };
              slots[name] = part.id;
            }
          }
          const { content } = experiment;
          return {
            ...withSlots(s, slots, items),
            openedExperiment: id,
            seed: content.seed,
            view: content.view,
            saveReloadTest: content.saveReloadTest,
            run: { status: "idle", progress: 0, output: null, error: null },
            selectedStop: null,
            selectedReview: null,
            reveal: null,
            batch: {
              ...s.batch,
              ...content.batch,
              status: "idle",
              done: 0,
              total: 0,
              results: null,
              error: null,
            },
          };
        });
      },

      saveExperiment(name) {
        const s = get();
        const content = experimentContentOf(s);
        const time = now();
        const taken = takenNames(Object.values(s.items), "experiment");
        const item: ExperimentItem = {
          id: newMineId("experiment"),
          kind: "experiment",
          source: "mine",
          name: uniqueName(name?.trim() || experimentName(content), taken),
          content,
          createdAt: time,
          updatedAt: time,
        };
        set({ items: { ...s.items, [item.id]: item }, openedExperiment: item.id });
        return item.id;
      },

      updateExperiment(id) {
        set((s) => {
          const item = s.items[id];
          if (item?.kind !== "experiment" || !isEditable(id)) return {};
          const updated = { ...item, content: experimentContentOf(s), updatedAt: now() };
          return { items: { ...s.items, [id]: updated } };
        });
      },

      addItem(item) {
        set((s) => (isEditable(item.id) ? { items: { ...s.items, [item.id]: item } } : {}));
      },

      addSharedExperiment(item) {
        set((s) => (s.items[item.id] ? {} : { items: { ...s.items, [item.id]: item } }));
      },

      openExample(id) {
        dependencies.client.cancel();
        dependencies.pool.cancel();
        set((s) => {
          const item = lookup(s.items, id);
          if (!item?.example || item.kind === "experiment") return {};
          const script = item.kind === "scenario";
          const slots = script
            ? { ...s.slots, scenario: id }
            : { ...s.slots, scenario: item.example.scenario, policy: id };
          return {
            ...withSlots(s, slots, s.items),
            view: "run",
            seed: item.example.seed,
            editorTab: script ? "scenario" : "policy",
            run: { status: "idle", progress: 0, output: null, error: null },
            selectedStop: null,
            selectedReview: null,
            reveal: null,
          };
        });
      },

      renameItem(id, name) {
        set((s) => {
          const item = s.items[id];
          if (!item || !isEditable(id)) return {};
          const next = renamed(item, name, Object.values(s.items), now());
          return withSlots(s, s.slots, { ...s.items, [id]: next });
        });
      },

      saveSlotAs(slot, name) {
        set((s) => {
          const item = lookup(s.items, s.slots[slot]);
          if (!item) return {};
          const time = now();
          const base = isEditable(item.id)
            ? { ...item, listed: true }
            : duplicated(item, Object.values(s.items), time);
          const { listed: _listed, ...kept } = base;
          const next = renamed(kept as LibraryItem, name, Object.values(s.items), time);
          return withSlots(s, { ...s.slots, [slot]: next.id }, { ...s.items, [next.id]: next });
        });
      },

      duplicateItem(id) {
        const s = get();
        const item = lookup(s.items, id);
        if (!item) return null;
        const copy = duplicated(item, Object.values(s.items), now());
        set(withSlots(s, s.slots, { ...s.items, [copy.id]: copy }));
        return copy.id;
      },

      deleteItem(id) {
        set((s) => {
          const item = s.items[id];
          if (!item || !isEditable(id)) return {};
          const { [id]: _deleted, ...items } = s.items;
          const slots = { ...s.slots };
          for (const slot of Object.keys(slots) as SlotName[]) {
            if (slots[slot] !== id) continue;
            // The slot keeps its contents as an unsaved, unlisted copy.
            const copy = { ...item, id: newMineId(item.kind), listed: false };
            items[copy.id] = copy;
            slots[slot] = copy.id;
          }
          return {
            ...withSlots(s, slots, items),
            openedExperiment: s.openedExperiment === id ? null : s.openedExperiment,
          };
        });
      },

      openDocs: (target) =>
        set((s) => (s.docs.at(-1) === target ? {} : { docs: [...s.docs, target].slice(-50) })),
      docsBack: () => set((s) => ({ docs: s.docs.slice(0, -1) })),
      closeDocs: () => set({ docs: [] }),
      setView: (view) => set({ view }),

      setPolicySource(source) {
        set((s) => {
          if (source === s.policy.source) return {};
          const next = edited(s, "policy", source);
          return withSlots(s, next.slots, next.items);
        });
      },

      selectStarter: (id) => get().fillSlot("scenario", itemId("builtin", "scenario", id)),

      selectTemplate(name) {
        const { fillSlot } = get();
        fillSlot("scenario", itemId("classic", "scenario", name));
        fillSlot("policy", itemId("classic", "policy", name));
      },

      setTemplateParams(params) {
        set((s) => {
          const current = s.scenario;
          const template = current.template && findTemplate(current.template.name);
          if (!current.template || !template) return {};
          const next = { ...current.template.params, ...params };
          const scenario = edited(s, "scenario", {
            kind: "script",
            source: templateCall(template.name, next),
            starterId: null,
            template: { name: template.name, params: next },
          });
          // The reference policy follows the parameters while the player has not edited it.
          let { items, slots } = scenario;
          if (referenceOf(slots.policy) === template.name) {
            const reference: PolicyItem = referencePolicyItem(template.name, next);
            items = using(items, reference);
            slots = { ...slots, policy: reference.id };
          }
          return withSlots(s, slots, items);
        });
      },

      setScenarioSource(source) {
        set((s) => {
          if (source === s.scenario.source) return {};
          const { kind, starterId, template } = s.scenario;
          const keepsStarter =
            kind === "script" && starterId !== null && STARTER_SCRIPTS[starterId] === source;
          const keepsTemplate =
            kind === "script" &&
            template !== undefined &&
            templateCall(template.name, template.params) === source;
          const next = edited(s, "scenario", {
            kind,
            source,
            starterId: keepsStarter ? starterId : null,
            ...(keepsTemplate ? { template } : {}),
          });
          return withSlots(s, next.slots, next.items);
        });
      },

      setScenarioKind(kind) {
        set((s) => {
          const current = s.scenario;
          if (current.kind === kind || !current.scenario) return {};
          ++revision;
          // Both conversions give an equivalent document, so the scenario stays as it is.
          const content: ScenarioSource = {
            kind,
            source:
              kind === "json" ? documentText(current.scenario) : documentToScript(current.scenario),
            starterId: null,
          };
          const next = edited(s, "scenario", content);
          return withSlots(s, next.slots, next.items, {
            ...content,
            status: "ready",
            scenario: current.scenario,
            errors: [],
          });
        });
      },

      setSeed: (seed) => set({ seed }),
      setSaveReloadTest: (saveReloadTest) => set({ saveReloadTest }),
      selectStop: (selectedStop) => set({ selectedStop, selectedReview: null }),
      selectReview: (selectedReview) => set({ selectedReview, selectedStop: null }),
      setEditorTab: (editorTab) => set({ editorTab }),
      revealPolicyLine: (line) =>
        set((s) => ({ editorTab: "policy", reveal: { line, nonce: (s.reveal?.nonce ?? 0) + 1 } })),

      async startRun() {
        const { scenario, policy, seed, saveReloadTest } = get();
        if (!scenario.scenario) return;
        dependencies.client.cancel();
        set((s) => ({ run: { ...s.run, status: "running", progress: 0, error: null } }));
        try {
          const output = await dependencies.client.run(
            { scenario: scenario.scenario, policy: policy.source, seed, saveReloadTest },
            (progress) => set((s) => ({ run: { ...s.run, progress } })),
          );
          set({
            run: { status: "done", progress: 1, output, error: null },
            selectedStop: null,
            selectedReview: null,
          });
        } catch (error) {
          if (error instanceof CancelledError) return;
          set((s) => ({ run: { ...s.run, status: "failed", error: (error as Error).message } }));
        }
      },

      cancelRun() {
        dependencies.client.cancel();
        set((s) => ({
          run: { ...s.run, status: s.run.output ? "done" : "idle", progress: 0 },
        }));
      },

      setBatchOptions: (options) => set((s) => ({ batch: { ...s.batch, ...options } })),

      async startBatch(seeds) {
        const { scenario, policy, policyB, saveReloadTest, batch } = get();
        if (!scenario.scenario) return;
        const total = seeds.length * (batch.compare ? 2 : 1);
        set((s) => ({ batch: { ...s.batch, status: "running", done: 0, total, error: null } }));
        const base = { scenario: scenario.scenario, saveReloadTest };
        let finished = 0;
        const progress = (done: number) =>
          set((s) => ({ batch: { ...s.batch, done: finished + done } }));
        try {
          const a = await dependencies.pool.run(
            { ...base, policy: policy.source },
            seeds,
            progress,
          );
          finished = seeds.length;
          const b = batch.compare
            ? await dependencies.pool.run({ ...base, policy: policyB.source }, seeds, progress)
            : undefined;
          set((s) => ({
            batch: {
              ...s.batch,
              status: "done",
              done: total,
              results: b ? { a, b } : { a },
            },
          }));
        } catch (error) {
          if (error instanceof CancelledError) return;
          set((s) => ({
            batch: { ...s.batch, status: "failed", error: (error as Error).message },
          }));
        }
      },

      async openSeed(which, seed) {
        if (which === "b") {
          set((s) =>
            withSlots(s, { ...s.slots, policy: s.slots.compare, compare: s.slots.policy }, s.items),
          );
        }
        set({ seed, view: "run" });
        await get().startRun();
      },

      cancelBatch() {
        dependencies.pool.cancel();
        set((s) => ({ batch: { ...s.batch, status: s.batch.results ? "done" : "idle", done: 0 } }));
      },
    };
  });
}
