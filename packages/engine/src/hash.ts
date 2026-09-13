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
  const text = JSON.stringify({
    apiVersion: output.apiVersion,
    scenarioId: output.scenarioId,
    seed: output.seed,
    events: output.events,
    records: output.records,
    samples: output.samples,
    flowTotals: output.flowTotals,
    metrics: output.metrics,
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
