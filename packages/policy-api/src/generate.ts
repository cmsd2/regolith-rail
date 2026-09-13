import { opsBlocks } from "./ops-spec.ts";
import { type ApiType, apiTypes, type Field, fieldAnchor, POLICY_API_VERSION } from "./spec.ts";

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
    "---@field on_stop? fun(ctx: StopContext) Called every time a vehicle stops.",
    "---@field on_review? fun(ctx: ReviewContext) Called at every review of a stock point.",
    "",
  );
  return lines.join("\n");
}

export interface EditorEntry {
  /** Dotted path as written in a policy, e.g. `ctx.vehicle.cargo`. */
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

/** Completion and hover data: members of `ctx` in every hook, and the ops library. */
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
        docs: `${type.docs}#${fieldAnchor(type, field)}`,
        kind: field.lua.startsWith("fun(") ? "function" : "field",
        ...(field.params ? { params: field.params } : {}),
        ...(field.returns ? { returns: field.returns } : {}),
      });
      // Lists and tables keyed by id are both indexed with `[i]` in editor paths.
      const keyed = /^table<string, (\w+)>$/.exec(field.lua)?.[1];
      const nested = typeByName.get(keyed ?? field.lua.replace(/\[\]$/, ""));
      if (nested && !seen.has(nested.name)) {
        const suffix = keyed || field.lua.endsWith("[]") ? "[i]" : "";
        visit(nested, `${path}${suffix}`, new Set([...seen, nested.name]));
      }
    }
  };
  // `ctx` differs between hooks; offer every hook's members once, stop context first.
  for (const name of ["StopContext", "ReviewContext", "StartContext"]) {
    const context = typeByName.get(name);
    if (!context) continue;
    const known = new Set(entries.map((e) => e.path));
    const before = entries.length;
    visit(context, "ctx", new Set([context.name]));
    const added = entries.splice(before).filter((e) => !known.has(e.path));
    entries.push(...added);
  }
  for (const block of opsBlocks) {
    const params = block.params
      .map((p) => `${p.name}${p.required ? "" : "?"}: ${p.lua}`)
      .join(", ");
    entries.push({
      path: `ops.${block.name}`,
      name: block.name,
      type: block.stage === "helper" ? `fun(${params})` : `fun({ ${params} })`,
      summary: block.summary,
      level: block.level,
      docs: block.docs,
      kind: "function",
      params: block.params.map((p) => ({ name: p.name, lua: p.lua, summary: p.summary })),
    });
  }
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
  ops: "packages/policy-api/ops",
} as const;

/**
 * Every generated file, by path relative to the repository root. `lua` holds
 * the Lua sources read from each of `LUA_SOURCE_DIRECTORIES`, by file name.
 */
export function generatedFiles(lua: {
  policies: Record<string, string>;
  ops: Record<string, string>;
}): Record<string, string> {
  return {
    "packages/engine/src/snapshot.generated.ts": snapshotTypesSource(),
    "packages/policy-api/generated/policy-api.lua": luaAnnotationsSource(),
    "packages/policy-api/generated/editor.json": editorDataSource(),
    "packages/policy-api/src/policies.generated.ts": luaSourcesModule(
      "Built-in policies shipped with the application, by name.",
      "BUILT_IN_POLICIES",
      lua.policies,
    ),
    "packages/policy-api/src/ops.generated.ts": luaSourcesModule(
      "The ops building-block library, loaded into every policy's sandbox.",
      "OPS_LIBRARY",
      lua.ops,
    ),
  };
}
