import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { minimalScenario } from "../testing/fixtures.ts";
import { scenarioJsonSchema } from "./json-schema.ts";
import { starterScenarios } from "./starters.ts";
import { validateScenario } from "./validate.ts";

describe("published scenario schema", () => {
  it("is up to date with the scenario definition", () => {
    const published = readFileSync(
      new URL("../../schema/scenario.schema.json", import.meta.url),
      "utf8",
    );
    // Compared as data: the committed file is formatted by the project formatter.
    expect(
      JSON.parse(published),
      "run `pnpm --filter @regolith-rail/engine generate:schema`",
    ).toEqual(scenarioJsonSchema());
  });

  it("accepts every scenario the application accepts", () => {
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    const check = ajv.compile(scenarioJsonSchema());
    const documents: unknown[] = [minimalScenario(), ...starterScenarios.map((s) => s.document)];
    for (const document of documents) {
      expect(validateScenario(document).ok).toBe(true);
      const valid = check(document);
      expect(check.errors ?? []).toEqual([]);
      expect(valid).toBe(true);
    }
  });
});
