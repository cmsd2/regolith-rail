import type { RunOutput } from "@regolith-rail/engine";
import type { Diagnostic } from "@regolith-rail/lua-runtime";
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
    runSeeds(request: SeedsRequest, onResult: (result: SeedResult) => void): Promise<void>;
    check(source: string): Promise<Diagnostic[]>;
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
    const results = new Map<number, SeedResult>();
    const chunks = chunk(seeds, this.size);
    this.handles = chunks.map(() => this.factory());
    const work = Promise.all(
      chunks.map((part, i) =>
        (this.handles[i] as WorkerHandle).api.runSeeds({ ...request, seeds: part }, (result) => {
          results.set(result.seed, result);
          progress?.(results.size, seeds.length);
        }),
      ),
    );
    const cancelled = new Promise<never>((_, reject) => {
      this.rejectRun = reject;
    });
    try {
      await Promise.race([work, cancelled]);
    } finally {
      this.rejectRun = undefined;
      for (const handle of this.handles) handle.terminate();
      this.handles = [];
    }
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
