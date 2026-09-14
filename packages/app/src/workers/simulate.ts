import { type RunOutput, runSimulation, type Scenario } from "@regolith-rail/engine";
import {
  checkPolicySource,
  type Diagnostic,
  type LuaRuntime,
  type ScriptScenario,
} from "@regolith-rail/lua-runtime";
import { type ModReadiness, modReadiness } from "../lib/mod-ready.ts";
import {
  BATCH_SAMPLE_POINTS,
  type RunRequest,
  type SeedResult,
  type SeedsRequest,
} from "./protocol.ts";

/** Keeps at most `points` evenly spaced samples, always including the last. */
export function downsample<T>(values: T[], points: number): T[] {
  if (values.length <= points) return values;
  const step = (values.length - 1) / (points - 1);
  return Array.from({ length: points }, (_, i) => values[Math.round(i * step)] as T);
}

export function summarise(output: RunOutput): SeedResult {
  const indices = downsample(
    output.samples.t.map((_, i) => i),
    BATCH_SAMPLE_POINTS,
  );
  const firstError = output.events.find((e) => e.kind === "error");
  return {
    seed: output.seed,
    metrics: output.metrics,
    samples: {
      t: indices.map((i) => output.samples.t[i] as number),
      stock: indices.map((i) => output.samples.stock[i] as number[]),
    },
    aborted: output.aborted,
    ...(firstError?.kind === "error"
      ? {
          firstError: {
            kind: firstError.errorKind,
            message: firstError.message,
            ...(firstError.line === undefined ? {} : { line: firstError.line }),
          },
        }
      : {}),
  };
}

/** The work a simulation worker does, independent of how it is hosted. */
export function simulationTasks(runtime: LuaRuntime) {
  return {
    run(request: RunRequest, progress?: (fraction: number) => void): RunOutput {
      const policy = runtime.createPolicy(request.policy, {
        saveReloadTest: request.saveReloadTest,
      });
      try {
        return runSimulation(request.scenario, policy, {
          seed: request.seed,
          detail: "full",
          ...(progress ? { progress } : {}),
        });
      } finally {
        policy.close();
      }
    },

    /**
     * Runs every seed and returns all results together. `progress` is only a
     * hint: across a worker boundary its calls may arrive after the return value.
     */
    runSeeds(request: SeedsRequest, progress?: (done: number) => void): SeedResult[] {
      const policy = runtime.createPolicy(request.policy, {
        saveReloadTest: request.saveReloadTest,
      });
      try {
        return request.seeds.map((seed, i) => {
          const result = summarise(
            runSimulation(request.scenario, policy, { seed, detail: "summary" }),
          );
          progress?.(i + 1);
          return result;
        });
      } finally {
        policy.close();
      }
    },

    check(source: string): Diagnostic[] {
      return checkPolicySource(source);
    },

    /** Evaluates and validates a scenario script. */
    loadScript(source: string): ScriptScenario {
      return runtime.loadScript(source);
    },

    /** Whether the pairing could run in the game, from the loaded policy's hooks. */
    modReady(policy: string, scenario: Scenario): ModReadiness {
      return modReadiness(runtime.hooksOf(policy), scenario);
    },
  };
}
