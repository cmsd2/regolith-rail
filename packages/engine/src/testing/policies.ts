import {
  type Action,
  emptyOutcome,
  type Policy,
  type PolicyOutcome,
  type StopSnapshot,
} from "../policy.ts";
import type { Scenario, ScenarioV2Input } from "../scenario/format2.ts";
import type { ScenarioV1Input } from "../scenario/schema.ts";
import { validateScenario } from "../scenario/validate.ts";

/** A policy that never moves anything. */
export const idlePolicy: Policy = { start: () => emptyOutcome(), stop: () => emptyOutcome() };

/** A policy whose stops are decided by a test function returning actions or a full outcome. */
export function scriptedPolicy(
  decide: (snapshot: StopSnapshot) => Action[] | PolicyOutcome,
): Policy {
  return {
    start: () => emptyOutcome(),
    stop(snapshot) {
      const result = decide(snapshot);
      return Array.isArray(result) ? { ...emptyOutcome(), actions: result } : result;
    },
  };
}

/** Validates a test scenario, failing loudly with its errors. */
export function parse(input: ScenarioV1Input | ScenarioV2Input): Scenario {
  const result = validateScenario(input);
  if (!result.ok) {
    throw new Error(result.errors.map((e) => `${e.path}: ${e.message}`).join("\n"));
  }
  return result.scenario;
}
