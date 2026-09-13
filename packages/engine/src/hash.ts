import type { RunOutput } from "./output.ts";
import { hashString32 } from "./random.ts";

function hashBytes32(bytes: Uint8Array, offset: number): number {
  let hash = offset;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const hex = (n: number) => n.toString(16).padStart(8, "0");

/**
 * Hash of everything a run produced: events, records, samples, flow totals,
 * metrics and, for full-detail runs, stock and cargo at every tick.
 */
export function hashRun(output: RunOutput): string {
  return hashWithMetrics(output, output.metrics);
}

/** Metrics that runs reported before scenario format 2 added new ones. */
export const FORMAT1_METRICS = [
  "unmetDemand",
  "unmetDemandWeighted",
  "stalledProduction",
  "demandMet",
  "distance",
  "emptyDistance",
  "emptyDistanceShare",
  "dwellMs",
  "oscillations",
  "stops",
  "transferred",
  "warnings",
  "policyErrors",
  "budgetOverruns",
  "byResource",
] as const;

/**
 * Hash of a run restricted to the output fields that existed before scenario format 2, so
 * results recorded then can still be compared after new fields are added.
 */
export function hashRunFormat1(output: RunOutput): string {
  const metrics = Object.fromEntries(FORMAT1_METRICS.map((key) => [key, output.metrics[key]]));
  return hashWithMetrics(output, metrics);
}

function hashWithMetrics(output: RunOutput, metrics: unknown): string {
  const text = JSON.stringify({
    apiVersion: output.apiVersion,
    scenarioId: output.scenarioId,
    seed: output.seed,
    events: output.events,
    records: output.records,
    samples: output.samples,
    flowTotals: output.flowTotals,
    metrics,
    aborted: output.aborted,
  });
  const secondOffset = 0x050c5d1f;
  let a = hashString32(text);
  let b = hashString32(text, secondOffset);
  for (const array of [output.stock, output.cargo]) {
    if (!array) continue;
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    a = hashBytes32(bytes, a);
    b = hashBytes32(bytes, b ^ secondOffset);
  }
  return hex(a) + hex(b);
}
