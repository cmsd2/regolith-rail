import { type Construct, constructAnchor, constructs } from "./constructs.ts";

const HEADER = "Generated from packages/scenario-kit. Do not edit.";

/** Directories of Lua sources, relative to the repository root. */
export const LUA_SOURCE_DIRECTORIES = {
  libraries: "packages/scenario-kit/lua",
  policies: "packages/scenario-kit/policies",
  starters: "packages/scenario-kit/starters",
} as const;

function luaModule(description: string, name: string, sources: Record<string, string>): string {
  const entries = Object.keys(sources)
    .sort()
    .map((key) => {
      const property = /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
      return `  ${property}: ${JSON.stringify(sources[key])},`;
    });
  return [
    `// ${HEADER}`,
    "",
    `/** ${description} */`,
    `export const ${name}: Record<string, string> = {`,
    ...entries,
    "};",
    "",
  ].join("\n");
}

/** Construct data for editor completion and hover help. */
export function constructDataSource(): string {
  const data = {
    header: HEADER,
    constructs: constructs.map((c) => ({
      ...c,
      href: `${c.docs}#${constructAnchor(c)}`,
    })),
  };
  return `${JSON.stringify(data, null, 2)}\n`;
}

const className = (c: Construct) =>
  `${c.name
    .split(/[._]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")}Params`;

/** Lua Language Server annotations for writing scenario scripts outside the application. */
export function luaAnnotationsSource(): string {
  const lines = ["---@meta", `-- ${HEADER}`, "", "mars = {}", "classic = {}", ""];
  for (const c of constructs) {
    if (c.kind === "helper") {
      lines.push(`--- ${c.summary}`);
      for (const p of c.params) lines.push(`---@param ${p.name} ${p.type} ${p.summary}`);
      lines.push(`---@return ${c.returns === "integer" ? "integer" : "table"}`);
      lines.push(`function ${c.name}(${c.params.map((p) => p.name).join(", ")}) end`, "");
      continue;
    }
    lines.push(`---@class ${className(c)}`);
    for (const p of c.params) {
      const unit = p.unit ? ` In ${p.unit}.` : "";
      const fallback = p.default ? ` Default ${p.default}.` : "";
      lines.push(
        `---@field ${p.name}${p.required ? "" : "?"} ${p.type} ${p.summary}${unit}${fallback}`,
      );
    }
    lines.push("", `--- ${c.summary}`, `---@param p ${className(c)}`, "---@return table");
    lines.push(`function ${c.name}(p) end`, "");
  }
  return lines.join("\n");
}

export function generatedFiles(lua: {
  libraries: Record<string, string>;
  policies: Record<string, string>;
  starters: Record<string, string>;
}): Record<string, string> {
  return {
    "packages/scenario-kit/src/libraries.generated.ts": luaModule(
      "Scenario construct libraries loaded into every scenario script, by library name.",
      "SCENARIO_LIBRARIES",
      lua.libraries,
    ),
    "packages/scenario-kit/src/policies.generated.ts": luaModule(
      "Reference policies for the classic problem templates, by name.",
      "CLASSIC_POLICIES",
      lua.policies,
    ),
    "packages/scenario-kit/src/starters.generated.ts": luaModule(
      "Starter scenarios as Mars pack scripts, by scenario id.",
      "STARTER_SCRIPTS",
      lua.starters,
    ),
    "packages/scenario-kit/generated/constructs.json": constructDataSource(),
    "packages/scenario-kit/generated/scenario-kit.lua": luaAnnotationsSource(),
  };
}
