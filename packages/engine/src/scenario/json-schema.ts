import { z } from "zod";
import { Scenario } from "./schema.ts";

export const SCENARIO_SCHEMA_ID =
  "https://cmsd2.github.io/regolith-rail/schema/scenario.schema.json";

/**
 * The scenario format as JSON Schema, for editors. Cross-field rules such as
 * unique ids and references are enforced only by the application's validator,
 * so a document the application accepts always satisfies this schema.
 */
export function scenarioJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(Scenario, { io: "input", target: "draft-2020-12" });
  return { ...schema, $id: SCENARIO_SCHEMA_ID, title: "Regolith Rail scenario" };
}

export function scenarioJsonSchemaText(): string {
  return `${JSON.stringify(scenarioJsonSchema(), null, 2)}\n`;
}
