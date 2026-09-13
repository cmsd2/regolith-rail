import { z } from "zod";
import { ScenarioV2 } from "./format2.ts";
import { ScenarioV1 } from "./schema.ts";

export const SCENARIO_SCHEMA_ID =
  "https://cmsd2.github.io/regolith-rail/schema/scenario.schema.json";

/**
 * The scenario format as JSON Schema, for editors. Cross-field rules such as
 * unique ids and references are enforced only by the application's validator,
 * so a document the application accepts always satisfies this schema.
 */
export function scenarioJsonSchema(): Record<string, unknown> {
  // Format 2 is current; format 1 documents are still accepted and upgraded on load.
  const schema = z.toJSONSchema(z.union([ScenarioV2, ScenarioV1]), {
    io: "input",
    target: "draft-2020-12",
  });
  return { ...schema, $id: SCENARIO_SCHEMA_ID, title: "Regolith Rail scenario" };
}

export function scenarioJsonSchemaText(): string {
  return `${JSON.stringify(scenarioJsonSchema(), null, 2)}\n`;
}
