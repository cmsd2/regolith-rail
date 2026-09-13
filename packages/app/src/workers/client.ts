import type { RunOutput, Scenario } from "@regolith-rail/engine";
import type { Diagnostic, ScriptScenario } from "@regolith-rail/lua-runtime";
import type { ModReadiness } from "../lib/mod-ready.ts";
import type { RunRequest, SeedResult, SeedsRequest } from "./protocol.ts";

export class CancelledError extends Error {
  constructor() {
    super("cancelled");
    this.name = "CancelledError";
  }
}

/** A running worker: its API, plus a way to stop it immediately. */
export interface WorkerHandle {
  api: {
    run(request: RunRequest, progress?: (fraction: number) => void): Promise<RunOutput>;
    runSeeds(request: SeedsRequest, progress?: (done: number) => void): Promise<SeedResult[]>;
    check(source: string): Promise<Diagnostic[]>;
    loadScript(source: string): Promise<ScriptScenario>;
    modReady(policy: string, scenario: Scenario): Promise<ModReadiness>;
  };
  terminate(): void;
}

export type WorkerFactory = () => WorkerHandle;

/**
 * One worker for single runs and checks. Cancelling terminates the worker, so
 * even a policy stuck in a long computation stops at once; the next request
 * starts a fresh worker.
 */
export class SimulationClient {
  private handle: WorkerHandle | undefined;
  private pending = new Set<(error: Error) => void>();
  private readonly factory: WorkerFactory;

  constructor(factory: WorkerFactory) {
    this.factory = factory;
  }

  private worker(): WorkerHandle {
    this.handle ??= this.factory();
    return this.handle;
  }

  private track<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.add(reject);
      promise.then(resolve, reject).finally(() => this.pending.delete(reject));
    });
  }

  run(request: RunRequest, progress?: (fraction: number) => void): Promise<RunOutput> {
    return this.track(this.worker().api.run(request, progress));
  }

  check(source: string): Promise<Diagnostic[]> {
    return this.track(this.worker().api.check(source));
  }

  loadScript(source: string): Promise<ScriptScenario> {
    return this.track(this.worker().api.loadScript(source));
  }

  modReady(policy: string, scenario: Scenario): Promise<ModReadiness> {
    return this.track(this.worker().api.modReady(policy, scenario));
  }

  cancel(): void {
    this.handle?.terminate();
    this.handle = undefined;
    for (const reject of this.pending) reject(new CancelledError());
    this.pending.clear();
  }
}

/** Splits `items` into at most `parts` contiguous chunks of near-equal size. */
export function chunk<T>(items: T[], parts: number): T[][] {
  const count = Math.max(1, Math.min(parts, items.length));
  const size = Math.ceil(items.length / count);
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/**
 * Runs batches across several workers. Results are returned in seed order, so
 * they do not depend on how many workers ran them.
 */
export class BatchPool {
  private handles: WorkerHandle[] = [];
  private rejectRun: ((error: Error) => void) | undefined;
  private readonly factory: WorkerFactory;
  readonly size: number;

  constructor(factory: WorkerFactory, size: number) {
    this.factory = factory;
    this.size = Math.max(1, size);
  }

  async run(
    request: Omit<SeedsRequest, "seeds">,
    seeds: number[],
    progress?: (done: number, total: number) => void,
  ): Promise<SeedResult[]> {
    this.cancel();
    const chunks = chunk(seeds, this.size);
    const done = chunks.map(() => 0);
    this.handles = chunks.map(() => this.factory());
    // Results come back with each chunk's return value. Progress callbacks travel on
    // a separate channel and can arrive after the return, so they only drive the bar.
    const work = Promise.all(
      chunks.map((part, i) =>
        (this.handles[i] as WorkerHandle).api.runSeeds({ ...request, seeds: part }, (count) => {
          done[i] = Math.max(done[i] as number, count);
          progress?.(
            done.reduce((a, b) => a + b, 0),
            seeds.length,
          );
        }),
      ),
    );
    const cancelled = new Promise<never>((_, reject) => {
      this.rejectRun = reject;
    });
    let parts: SeedResult[][];
    try {
      parts = await Promise.race([work, cancelled]);
    } finally {
      this.rejectRun = undefined;
      for (const handle of this.handles) handle.terminate();
      this.handles = [];
    }
    const results = new Map(parts.flat().map((result) => [result.seed, result]));
    return seeds.map((seed) => {
      const result = results.get(seed);
      if (!result) throw new Error(`no result for seed ${seed}`);
      return result;
    });
  }

  cancel(): void {
    for (const handle of this.handles) handle.terminate();
    this.handles = [];
    this.rejectRun?.(new CancelledError());
    this.rejectRun = undefined;
  }
}
