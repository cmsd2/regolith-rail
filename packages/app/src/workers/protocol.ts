import type { Metrics, PolicyError, RunOutput, Scenario } from "@regolith-rail/engine";
import type { Diagnostic } from "@regolith-rail/lua-runtime";

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
  runSeeds(request: SeedsRequest, onResult: (result: SeedResult) => void): Promise<void>;
  check(source: string): Promise<Diagnostic[]>;
}

/** Most sample points a batch keeps per run. */
export const BATCH_SAMPLE_POINTS = 200;
