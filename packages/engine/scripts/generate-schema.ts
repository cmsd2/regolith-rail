import { writeFileSync } from "node:fs";
import { scenarioJsonSchemaText } from "../src/scenario/json-schema.ts";

const target = new URL("../schema/scenario.schema.json", import.meta.url);
writeFileSync(target, scenarioJsonSchemaText());
console.log(`wrote ${target.pathname}`);
