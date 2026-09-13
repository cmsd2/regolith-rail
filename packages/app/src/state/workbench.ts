import {
  type RunOutput,
  type Scenario,
  starterScenarios,
  type ValidationError,
  validateScenario,
} from "@regolith-rail/engine";
import { BUILT_IN_POLICIES } from "@regolith-rail/policy-api";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { BatchPool, SimulationClient } from "../workers/client.ts";
import { CancelledError } from "../workers/client.ts";
import type { SeedResult } from "../workers/protocol.ts";

export const DEFAULT_SCENARIO = "two-station";

export type RunStatus = "idle" | "running" | "done" | "failed";

export interface PolicyDraft {
  /** Name shown to the player, such as a saved policy's name. */
  name: string;
  source: string;
}

export interface ScenarioDraft {
  /** Starter the text came from, while it is unedited. */
  starterId: string | null;
  text: string;
  scenario: Scenario | null;
  errors: ValidationError[];
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

export interface WorkbenchState {
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
  batch: BatchState;

  setView(view: WorkbenchState["view"]): void;
  setPolicySource(source: string): void;
  setPolicy(policy: PolicyDraft): void;
  setPolicyB(policy: PolicyDraft): void;
  selectStarter(id: string): void;
  setScenarioText(text: string): void;
  setSeed(seed: number): void;
  setSaveReloadTest(enabled: boolean): void;
  selectStop(stop: number | null): void;
  startRun(): Promise<void>;
  cancelRun(): void;
  setBatchOptions(options: Partial<Pick<BatchState, "seedCount" | "baseSeed" | "compare">>): void;
  startBatch(seeds: number[]): Promise<void>;
  cancelBatch(): void;
}

export interface WorkbenchDependencies {
  client: SimulationClient;
  pool: BatchPool;
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

export function starterText(id: string): string {
  const starter = starterScenarios.find((s) => s.id === id);
  if (!starter) throw new Error(`unknown starter scenario ${id}`);
  return `${JSON.stringify(starter.document, null, 2)}\n`;
}

function scenarioDraft(starterId: string | null, text: string): ScenarioDraft {
  return { starterId, text, ...parseScenarioText(text) };
}

export function createWorkbench(dependencies: WorkbenchDependencies): StoreApi<WorkbenchState> {
  return createStore<WorkbenchState>()((set, get) => ({
    view: "run",
    policy: { name: "naive.lua", source: BUILT_IN_POLICIES.naive },
    policyB: { name: "supply-to-demand.lua", source: BUILT_IN_POLICIES["supply-to-demand"] },
    scenario: scenarioDraft(DEFAULT_SCENARIO, starterText(DEFAULT_SCENARIO)),
    seed: 1,
    saveReloadTest: false,
    run: { status: "idle", progress: 0, output: null, error: null },
    selectedStop: null,
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

    setView: (view) => set({ view }),
    setPolicySource: (source) => set((s) => ({ policy: { ...s.policy, source } })),
    setPolicy: (policy) => set({ policy }),
    setPolicyB: (policyB) => set({ policyB }),
    selectStarter: (id) => set({ scenario: scenarioDraft(id, starterText(id)) }),
    setScenarioText: (text) =>
      set((s) => ({
        scenario: scenarioDraft(
          s.scenario.starterId !== null && text === starterText(s.scenario.starterId)
            ? s.scenario.starterId
            : null,
          text,
        ),
      })),
    setSeed: (seed) => set({ seed }),
    setSaveReloadTest: (saveReloadTest) => set({ saveReloadTest }),
    selectStop: (selectedStop) => set({ selectedStop }),

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
        set({ run: { status: "done", progress: 1, output, error: null }, selectedStop: null });
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
        const a = await dependencies.pool.run({ ...base, policy: policy.source }, seeds, progress);
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
        set((s) => ({ batch: { ...s.batch, status: "failed", error: (error as Error).message } }));
      }
    },

    cancelBatch() {
      dependencies.pool.cancel();
      set((s) => ({ batch: { ...s.batch, status: s.batch.results ? "done" : "idle", done: 0 } }));
    },
  }));
}
