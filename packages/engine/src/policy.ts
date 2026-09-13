import type { InformationLevel } from "./scenario/schema.ts";
import type { ReviewSnapshot, StartSnapshot, StopSnapshot } from "./snapshot.generated.ts";

export type * from "./snapshot.generated.ts";
export { POLICY_API_VERSION } from "./snapshot.generated.ts";

export type Direction = "forward" | "backward";

export type Action =
  | { type: "load"; resource: string; amount: number }
  | { type: "unload"; resource: string; amount: number }
  | { type: "order"; resource: string; amount: number };

export interface Trace {
  block: string;
  station: string;
  resource?: string;
  inputs: Record<string, number | string | boolean>;
  result: number | string;
}

export type PolicyErrorKind = "load" | "runtime" | "budget" | "memory";

export interface PolicyError {
  kind: PolicyErrorKind;
  message: string;
  /** Line in the policy source, when known. */
  line?: number;
}

export interface PolicyOutcome {
  actions: Action[];
  logs: string[];
  records: { name: string; value: number }[];
  traces: Trace[];
  error?: PolicyError;
}

export interface RunContext {
  seed: number;
  informationLevel: InformationLevel;
  /** Hooks the scenario calls: `stop` when it has vehicles, `review` when it has reviews. */
  hooks: { stop: boolean; review: boolean };
}

/** Anything the engine can ask what to do at a stop or a review. */
export interface Policy {
  start(snapshot: StartSnapshot, run: RunContext): PolicyOutcome;
  stop(snapshot: StopSnapshot): PolicyOutcome;
  /** Decides what a stock point orders at a review. Without it, reviews place no orders. */
  review?(snapshot: ReviewSnapshot): PolicyOutcome;
}

export function emptyOutcome(): PolicyOutcome {
  return { actions: [], logs: [], records: [], traces: [] };
}
