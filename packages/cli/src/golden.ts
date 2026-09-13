import { writeFileSync } from "node:fs";
import { runGoldenMatrix } from "@regolith-rail/engine";
import { LuaRuntime } from "@regolith-rail/lua-runtime";
import { resolvePolicy } from "./run.ts";

export const DEFAULT_GOLDEN_PATH = new URL(
  "../../../tests/determinism/golden.json",
  import.meta.url,
);

/** Result hashes for the determinism matrix, keyed `policy/scenario/seed`. */
export async function computeGolden(): Promise<Record<string, string>> {
  const runtime = await LuaRuntime.load();
  return runGoldenMatrix((name) => resolvePolicy(name, runtime));
}

export async function writeGolden(out?: string): Promise<string> {
  const target = out ?? DEFAULT_GOLDEN_PATH;
  writeFileSync(target, `${JSON.stringify(await computeGolden(), null, 2)}\n`);
  return typeof target === "string" ? target : target.pathname;
}
