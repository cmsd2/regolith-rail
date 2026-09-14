import type { Metrics, PolicyError, RunOutput, Scenario } from "@regolith-rail/engine";
import type { Diagnostic, PolicyHooks, ScriptScenario } from "@regolith-rail/lua-runtime";
import type { ModReadiness } from "../lib/mod-ready.ts";

export interface RunRequest {
  scenario: Scenario;
  /** Lua policy source. */
  policy: string;
  seed: number;
  saveReloadTest: boolean;
}

export interface SeedsRequest {
  scenario: Scenario;
  policy: string;
  seeds: number[];
  saveReloadTest: boolean;
}

/** What a batch keeps from each run: metrics and a downsampled stock series. */
export interface SeedResult {
  seed: number;
  metrics: Metrics;
  samples: { t: number[]; stock: number[][] };
  aborted: boolean;
  /** First error the policy reported, if any. */
  firstError?: PolicyError;
}

export interface SimulationWorkerApi {
  run(request: RunRequest, progress?: (fraction: number) => void): Promise<RunOutput>;
  runSeeds(request: SeedsRequest, progress?: (done: number) => void): Promise<SeedResult[]>;
  check(source: string): Promise<Diagnostic[]>;
  loadScript(source: string): Promise<ScriptScenario>;
  modReady(policy: string, scenario: Scenario): Promise<ModReadiness>;
  hooks(policy: string): Promise<PolicyHooks>;
}

/** Most sample points a batch keeps per run. */
export const BATCH_SAMPLE_POINTS = 200;
