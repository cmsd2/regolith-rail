import { type RunOutput, type Scenario, validateScenario } from "@regolith-rail/engine";
import { BUILT_IN_POLICIES } from "@regolith-rail/policy-api";
import { STARTER_SCRIPTS, type TemplateParams, templateCall } from "@regolith-rail/scenario-kit";
import { createStore, type StoreApi } from "zustand/vanilla";
import {
  DEFAULT_SCENARIO,
  documentText,
  documentToScript,
  findTemplate,
  knownScenario,
  type ScenarioError,
  type ScenarioKind,
  type ScenarioSource,
  starterSource,
  templateSource,
} from "../lib/scenario-source.ts";
import type { BatchPool, SimulationClient } from "../workers/client.ts";
import { CancelledError } from "../workers/client.ts";
import type { SeedResult } from "../workers/protocol.ts";

export { DEFAULT_SCENARIO };

export type RunStatus = "idle" | "running" | "done" | "failed";

export interface PolicyDraft {
  /** Name shown to the player, such as a saved policy's name. */
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

/** Work that can be restored from a share link, a draft or a save. */
export interface WorkContent {
  view?: WorkbenchState["view"];
  policy: PolicyDraft;
  policyB?: PolicyDraft;
  scenario: ScenarioSource;
  seed: number;
  saveReloadTest?: boolean;
  batch?: Pick<BatchState, "seedCount" | "baseSeed" | "compare">;
}

export interface WorkbenchState {
  /** Whether the session has restored any shared or draft work. */
  loaded: boolean;
  notices: Notice[];
  view: "run" | "batch";
  policy: PolicyDraft;
  policyB: PolicyDraft;
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
  /** Replaces the work in progress, clearing results. Nothing runs. */
  restore(content: WorkContent): void;
  /** Opens a documentation page, such as `ops/min-max#param-low`, in the panel. */
  openDocs(target: string): void;
  docsBack(): void;
  closeDocs(): void;
  setView(view: WorkbenchState["view"]): void;
  setPolicySource(source: string): void;
  setPolicy(policy: PolicyDraft): void;
  setPolicyB(policy: PolicyDraft): void;
  selectStarter(id: string): void;
  /** Picks a classic template with its default parameters and its reference policy. */
  selectTemplate(name: string): void;
  /** Changes parameters of the current template, rewriting its one-line script. */
  setTemplateParams(params: TemplateParams): void;
  /** Replaces the scenario source, keeping its kind. */
  setScenarioSource(source: string): void;
  /** Opens a scenario from a save or another record. */
  openScenario(source: ScenarioSource): void;
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

export function createWorkbench(dependencies: WorkbenchDependencies): StoreApi<WorkbenchState> {
  let noticeId = 0;
  // Only the latest evaluation may update the scenario.
  let revision = 0;
  const evaluator = dependencies.evaluator ?? dependencies.client;

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

    return {
      loaded: false,
      notices: [],
      view: "run",
      policy: { name: "naive.lua", source: BUILT_IN_POLICIES.naive },
      policyB: { name: "supply-to-demand.lua", source: BUILT_IN_POLICIES["supply-to-demand"] },
      scenario: evaluate(starterSource(DEFAULT_SCENARIO)),
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

      restore(content) {
        dependencies.client.cancel();
        dependencies.pool.cancel();
        set((s) => ({
          view: content.view ?? s.view,
          policy: content.policy,
          policyB: content.policyB ?? s.policyB,
          scenario: evaluate(content.scenario),
          seed: content.seed,
          saveReloadTest: content.saveReloadTest ?? s.saveReloadTest,
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
        }));
      },

      openDocs: (target) =>
        set((s) => (s.docs.at(-1) === target ? {} : { docs: [...s.docs, target].slice(-50) })),
      docsBack: () => set((s) => ({ docs: s.docs.slice(0, -1) })),
      closeDocs: () => set({ docs: [] }),
      setView: (view) => set({ view }),
      setPolicySource: (source) => set((s) => ({ policy: { ...s.policy, source } })),
      setPolicy: (policy) => set({ policy }),
      setPolicyB: (policyB) => set({ policyB }),
      selectStarter: (id) => set({ scenario: evaluate(starterSource(id)) }),
      selectTemplate(name) {
        const template = findTemplate(name);
        if (!template) return;
        set({
          scenario: evaluate(templateSource(name, template.defaults)),
          policy: {
            name: referencePolicyName(name),
            source: template.reference(template.defaults).policy,
          },
        });
      },
      setTemplateParams(params) {
        const { scenario, policy } = get();
        const template = scenario.template && findTemplate(scenario.template.name);
        if (!scenario.template || !template) return;
        const next = { ...scenario.template.params, ...params };
        // The reference policy follows the parameters while the player has not edited it.
        const unedited = policy.source === template.reference(scenario.template.params).policy;
        set({
          scenario: evaluate(templateSource(template.name, next)),
          ...(unedited
            ? { policy: { name: policy.name, source: template.reference(next).policy } }
            : {}),
        });
      },
      setScenarioSource(source) {
        const { kind, starterId, template } = get().scenario;
        const keepsStarter =
          kind === "script" && starterId !== null && STARTER_SCRIPTS[starterId] === source;
        const keepsTemplate =
          kind === "script" &&
          template !== undefined &&
          templateCall(template.name, template.params) === source;
        set({
          scenario: evaluate({
            kind,
            source,
            starterId: keepsStarter ? starterId : null,
            ...(keepsTemplate ? { template } : {}),
          }),
        });
      },
      openScenario: (source) => set({ scenario: evaluate(source) }),
      setScenarioKind(kind) {
        const current = get().scenario;
        if (current.kind === kind || !current.scenario) return;
        ++revision;
        // Both conversions give an equivalent document, so the scenario stays as it is.
        set({
          scenario: {
            kind,
            source:
              kind === "json" ? documentText(current.scenario) : documentToScript(current.scenario),
            starterId: null,
            status: "ready",
            scenario: current.scenario,
            errors: [],
          },
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
        if (which === "b") set((s) => ({ policy: s.policyB, policyB: s.policy }));
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
