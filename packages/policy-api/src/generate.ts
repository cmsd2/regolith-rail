import { type ApiType, apiTypes, type Field, POLICY_API_VERSION } from "./spec.ts";

const HEADER = "Generated from packages/policy-api/src/spec.ts. Do not edit.";

const typeByName = new Map(apiTypes.map((t) => [t.name, t]));

/** TypeScript interfaces for the parts of the API the engine builds. */
export function snapshotTypesSource(): string {
  const lines = [
    `// ${HEADER}`,
    "",
    "/** The Policy API version every run output and share link records. */",
    `export const POLICY_API_VERSION = ${POLICY_API_VERSION};`,
    "",
    "/** Milli-units by resource id. */",
    "export type Quantities = Record<string, number>;",
    "",
  ];
  for (const type of apiTypes) {
    if (!type.ts) continue;
    const fields = type.fields.filter((f) => f.source === "snapshot");
    if (lines.some((line) => line.startsWith(`export interface ${type.ts} `))) continue;
    lines.push(`/** ${type.summary} */`, `export interface ${type.ts} {`);
    for (const field of fields) {
      lines.push(
        `  /** ${field.summary} */`,
        `  ${field.name}${field.optional ? "?" : ""}: ${field.ts};`,
      );
    }
    lines.push("}", "");
  }
  lines.push(
    "/** The stopped train's station, whose stock and capacity are always present. */",
    "export type CurrentStationSnapshot = StationSnapshot & { stock: Quantities; capacity: Quantities };",
    "",
  );
  return lines.join("\n");
}

/** Lua Language Server annotations for editors outside the application. */
export function luaAnnotationsSource(): string {
  const lines = [
    "---@meta",
    `-- ${HEADER}`,
    `-- Regolith Rail Policy API version ${POLICY_API_VERSION}.`,
    "",
  ];
  for (const type of apiTypes) {
    lines.push(`--- ${type.summary}`, `---@class ${type.name}`);
    for (const field of type.fields) {
      lines.push(
        `---@field ${field.name}${field.optional ? "?" : ""} ${field.lua} ${field.summary}`,
      );
    }
    lines.push("");
  }
  lines.push(
    "--- A policy module.",
    "---@class Policy",
    "---@field on_start? fun(ctx: StartContext) Called once at the start of each run.",
    "---@field on_stop fun(ctx: StopContext) Called every time a train stops.",
    "",
  );
  return lines.join("\n");
}

export interface EditorEntry {
  /** Dotted path as written in a policy, e.g. `ctx.train.cargo`. */
  path: string;
  name: string;
  type: string;
  summary: string;
  level: Field["level"];
  docs: string;
  kind: "field" | "function";
  params?: Field["params"];
  returns?: Field["returns"];
}

/** Completion and hover data, rooted at `ctx` for `on_stop`. */
export function editorEntries(): EditorEntry[] {
  const entries: EditorEntry[] = [];
  const visit = (type: ApiType, prefix: string, seen: Set<string>) => {
    for (const field of type.fields) {
      const path = `${prefix}.${field.name}`;
      entries.push({
        path,
        name: field.name,
        type: field.lua,
        summary: field.summary,
        level: field.level,
        docs: `${type.docs}#${field.name.replace(/_/g, "-")}`,
        kind: field.lua.startsWith("fun(") ? "function" : "field",
        ...(field.params ? { params: field.params } : {}),
        ...(field.returns ? { returns: field.returns } : {}),
      });
      const nested = typeByName.get(field.lua.replace(/\[\]$/, ""));
      if (nested && !seen.has(nested.name)) {
        const suffix = field.lua.endsWith("[]") ? "[i]" : "";
        visit(nested, `${path}${suffix}`, new Set([...seen, nested.name]));
      }
    }
  };
  const stop = typeByName.get("StopContext");
  if (stop) visit(stop, "ctx", new Set([stop.name]));
  return entries;
}

export function editorDataSource(): string {
  return `${JSON.stringify({ apiVersion: POLICY_API_VERSION, entries: editorEntries() }, null, 2)}\n`;
}

/** Lua sources as a TypeScript module, so bundlers and Node load them the same way. */
export function luaSourcesModule(
  description: string,
  name: string,
  sources: Record<string, string>,
): string {
  const entries = Object.keys(sources)
    .sort()
    .map((key) => {
      const name = /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
      return `  ${name}: ${JSON.stringify(sources[key])},`;
    });
  return [
    `// ${HEADER}`,
    "",
    `/** ${description} */`,
    `export const ${name} = {`,
    ...entries,
    "} as const;",
    "",
  ].join("\n");
}

/** Lua files the generator embeds, by directory relative to the repository root. */
export const LUA_SOURCE_DIRECTORIES = {
  policies: "packages/policy-api/policies",
} as const;

/**
 * Every generated file, by path relative to the repository root. `policies`
 * maps built-in policy names to their Lua source.
 */
export function generatedFiles(policies: Record<string, string>): Record<string, string> {
  return {
    "packages/engine/src/snapshot.generated.ts": snapshotTypesSource(),
    "packages/policy-api/generated/policy-api.lua": luaAnnotationsSource(),
    "packages/policy-api/generated/editor.json": editorDataSource(),
    "packages/policy-api/src/policies.generated.ts": luaSourcesModule(
      "Built-in policies shipped with the application, by name.",
      "BUILT_IN_POLICIES",
      policies,
    ),
  };
}
