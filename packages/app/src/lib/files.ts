import {
  type ExperimentContent,
  type ItemKind,
  type LibraryItem,
  newMineId,
  uniqueName,
} from "./library.ts";
import { takenNames } from "./library-ops.ts";

/** The largest file the library imports. */
export const MAX_IMPORT_BYTES = 1024 * 1024;

const EXPERIMENT_FORMAT = { regolithRail: "experiment", version: 1 } as const;

export type ImportResult = { ok: true; item: LibraryItem } | { ok: false; message: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

const stem = (fileName: string) =>
  fileName.replace(/^.*[\\/]/, "").replace(/\.[^.]*$/, "") || "Imported";

function looksLikeExperiment(value: unknown): value is ExperimentContent {
  if (!isRecord(value)) return false;
  const part = (p: unknown, content: "string" | "object") =>
    isRecord(p) && typeof p.name === "string" && typeof p.content === content;
  return (
    part(value.scenario, "object") &&
    part(value.policy, "string") &&
    (value.compare === undefined || part(value.compare, "string")) &&
    Number.isSafeInteger(value.seed) &&
    (value.view === "run" || value.view === "batch") &&
    typeof value.saveReloadTest === "boolean" &&
    isRecord(value.batch)
  );
}

/**
 * A Mine item from a file the player chose to import as a policy, a scenario or an experiment.
 * Scenario errors are shown when the scenario is opened, not here.
 */
export function importFile(
  kind: ItemKind,
  file: { name: string; bytes: Uint8Array },
  items: readonly LibraryItem[],
  now: number,
): ImportResult {
  if (file.bytes.byteLength > MAX_IMPORT_BYTES) {
    return { ok: false, message: `${file.name} is larger than 1 MB, so it was not imported.` };
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(file.bytes);
  } catch {
    return { ok: false, message: `${file.name} is not a text file, so it was not imported.` };
  }
  const base = { source: "mine" as const, createdAt: now, updatedAt: now };
  const name = (wanted: string) => uniqueName(wanted, takenNames(items, kind));
  if (kind === "policy") {
    return {
      ok: true,
      item: { ...base, id: newMineId(kind), kind, name: name(stem(file.name)), content: text },
    };
  }
  if (kind === "scenario") {
    const json = /\.json$/i.test(file.name);
    return {
      ok: true,
      item: {
        ...base,
        id: newMineId(kind),
        kind,
        name: name(stem(file.name)),
        content: { kind: json ? "json" : "script", source: text, starterId: null },
      },
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  if (
    !isRecord(parsed) ||
    parsed.regolithRail !== EXPERIMENT_FORMAT.regolithRail ||
    parsed.version !== EXPERIMENT_FORMAT.version ||
    !looksLikeExperiment(parsed.content)
  ) {
    return {
      ok: false,
      message: `${file.name} is not an exported experiment, so it was not imported.`,
    };
  }
  const wanted =
    typeof parsed.name === "string" && parsed.name.trim() ? parsed.name : stem(file.name);
  return {
    ok: true,
    item: { ...base, id: newMineId(kind), kind, name: name(wanted), content: parsed.content },
  };
}

export interface ExportedFile {
  fileName: string;
  type: string;
  text: string;
}

/** A file name from an item name, without characters file systems refuse. */
const safe = (name: string) => name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "export";

/** The file an item is exported as: `.lua` for policies and scripts, `.json` otherwise. */
export function exportFile(item: LibraryItem): ExportedFile {
  if (item.kind === "policy") {
    return { fileName: `${safe(item.name)}.lua`, type: "text/x-lua", text: item.content };
  }
  if (item.kind === "scenario") {
    const script = item.content.kind === "script";
    return {
      fileName: `${safe(item.name)}.${script ? "lua" : "json"}`,
      type: script ? "text/x-lua" : "application/json",
      text: item.content.source,
    };
  }
  return {
    fileName: `${safe(item.name)}.json`,
    type: "application/json",
    text: `${JSON.stringify({ ...EXPERIMENT_FORMAT, name: item.name, content: item.content }, null, 2)}\n`,
  };
}
