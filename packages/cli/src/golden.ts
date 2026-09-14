import { writeFileSync } from "node:fs";
import { hashRun, hashRunFormat1, runGoldenMatrixWith } from "@regolith-rail/engine";
import { LuaRuntime } from "@regolith-rail/lua-runtime";
import { resolvePolicy } from "./run.ts";

export const DEFAULT_GOLDEN_PATH = new URL(
  "../../../tests/determinism/golden.json",
  import.meta.url,
);

/** Hashes recorded before scenario format 2, over the output fields that existed then. */
export const FORMAT1_GOLDEN_PATH = new URL(
  "../../../tests/determinism/golden-format1.json",
  import.meta.url,
);

/**
 * Result hashes for the determinism matrix, keyed `policy/scenario/seed`: over the whole
 * output, and over the fields that existed before scenario format 2.
 */
export async function computeGoldens(): Promise<{
  current: Record<string, string>;
  format1: Record<string, string>;
}> {
  const runtime = await LuaRuntime.load();
  return runGoldenMatrixWith((name) => resolvePolicy(name, runtime), {
    current: hashRun,
    format1: hashRunFormat1,
  });
}

export async function computeGolden(): Promise<Record<string, string>> {
  return (await computeGoldens()).current;
}

export async function writeGolden(out?: string): Promise<string> {
  const target = out ?? DEFAULT_GOLDEN_PATH;
  writeFileSync(target, `${JSON.stringify(await computeGolden(), null, 2)}\n`);
  return typeof target === "string" ? target : target.pathname;
}
