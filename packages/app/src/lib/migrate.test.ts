import { BUILT_IN_POLICIES } from "@regolith-rail/policy-api";
import { classicTemplates, STARTER_SCRIPTS, templateCall } from "@regolith-rail/scenario-kit";
import { describe, expect, it } from "vitest";
import relayV1 from "../../../engine/src/testing/format1/relay.json" with { type: "json" };
import type { ScenarioItem } from "./library.ts";
import { type LibraryStorage, memoryLibraryStorage } from "./library-storage.ts";
import { migrateStorage, migrateV1 } from "./migrate.ts";
import { type Draft, memoryStorage, type SavedItem } from "./storage.ts";

const formerRelayText = `${JSON.stringify(relayV1, null, 2)}\n`;

const saved: SavedItem[] = [
  { kind: "policy", name: "buffer", source: "return { on_stop = function(ctx) end }", savedAt: 10 },
  {
    kind: "scenario",
    name: "my chain",
    text: "return classic.serial_chain { stages = 3 }",
    scenarioKind: "script",
    savedAt: 11,
  },
  // A save from before scenario scripts: format 1 JSON text and no kind.
  { kind: "scenario", name: "old relay", text: formerRelayText, savedAt: 12 },
];

const draft = (overrides: Partial<Draft> = {}): Draft => ({
  policy: { name: "balance-stock.lua", source: BUILT_IN_POLICIES["balance-stock"] },
  policyB: { name: "supply-to-demand.lua", source: BUILT_IN_POLICIES["supply-to-demand"] },
  scenario: { kind: "script", source: STARTER_SCRIPTS.relay as string, starterId: "relay" },
  seed: 3,
  ...overrides,
});

describe("migration from saved work and drafts", () => {
  it("moves each shape of saved item into Mine with the same name and contents", () => {
    const { items, session } = migrateV1(saved, undefined, 100);
    expect(session).toBeUndefined();
    expect(items.map((i) => [i.kind, i.source, i.name, i.createdAt])).toEqual([
      ["policy", "mine", "buffer", 10],
      ["scenario", "mine", "my chain", 11],
      ["scenario", "mine", "old relay", 12],
    ]);
    expect(items[0]?.content).toBe(saved[0]?.kind === "policy" && saved[0].source);
    expect((items[1] as ScenarioItem).content).toEqual({
      kind: "script",
      source: "return classic.serial_chain { stages = 3 }",
      starterId: null,
    });
    // The old JSON is upgraded to format 2 on the way in.
    const old = (items[2] as ScenarioItem).content;
    expect(old.kind).toBe("json");
    expect(JSON.parse(old.source)).toMatchObject({ format: 2, id: "relay" });
  });

  it("points slots at shipped items for an unedited starter and built-in policies", () => {
    const { items, session } = migrateV1([], draft(), 100);
    expect(items).toEqual([]);
    expect(session).toMatchObject({
      slots: {
        scenario: "builtin:scenario:relay",
        policy: "builtin:policy:balance-stock",
        compare: "builtin:policy:supply-to-demand",
      },
      seed: 3,
    });
  });

  it("recognises an unedited starter in a draft from before scenario scripts", () => {
    const { session } = migrateV1(
      [],
      draft({ scenario: { starterId: "relay", text: formerRelayText } as never }),
      1,
    );
    expect(session?.slots.scenario).toBe("builtin:scenario:relay");
  });

  it("makes Mine items for edited parts of the draft, reusing saved items with the same content", () => {
    const edited = draft({
      policy: { name: "buffer", source: "return { on_stop = function(ctx) end }" },
      policyB: { name: "b.lua", source: "-- mine\nreturn {}" },
      scenario: { kind: "script", source: "-- edited\nreturn classic.reorder {}", starterId: null },
    });
    const { items, session } = migrateV1(saved, edited, 100);
    const byId = new Map(items.map((i) => [i.id, i]));
    expect(byId.get(session?.slots.policy ?? "")?.name).toBe("buffer");
    expect(byId.get(session?.slots.compare ?? "")).toMatchObject({
      name: "Draft comparison policy",
    });
    expect(byId.get(session?.slots.scenario ?? "")).toMatchObject({
      name: "Draft scenario",
      kind: "scenario",
    });
    expect(items).toHaveLength(5);
  });

  it("keeps a classic template's reference policy for changed parameters as an unlisted item", () => {
    const template = classicTemplates.find((t) => t.name === "classic.newsvendor");
    if (!template) throw new Error("newsvendor missing");
    const params = { ...template.defaults, lost_cost: 9 };
    const { items, session } = migrateV1(
      [],
      draft({
        scenario: {
          kind: "script",
          source: templateCall(template.name, params),
          starterId: null,
          template: { name: template.name, params },
        },
        policy: { name: "newsvendor-reference.lua", source: template.reference(params).policy },
      }),
      1,
    );
    expect(session?.slots.policy).toMatch(/^classic:policy:classic\.newsvendor@/);
    expect(session?.items.map((i) => i.id)).toEqual([session?.slots.policy]);
    expect(items.map((i) => i.name)).toEqual(["Draft scenario"]);
  });
});

describe("migrating storage", () => {
  it("writes the library, then clears the old records", async () => {
    const v1 = memoryStorage();
    for (const item of saved) await v1.save(item);
    await v1.saveDraft(draft());
    const v2 = memoryLibraryStorage();
    const result = await migrateStorage(v1, v2, 100);
    expect(result.status).toBe("migrated");
    expect((await v2.listItems()).map((i) => i.name).sort()).toEqual([
      "buffer",
      "my chain",
      "old relay",
    ]);
    expect((await v2.loadSession())?.slots.scenario).toBe("builtin:scenario:relay");
    expect(await v1.list()).toEqual([]);
    expect(await v1.loadDraft()).toBeUndefined();
    expect((await migrateStorage(v1, v2, 200)).status).toBe("none");
  });

  it("leaves the old records intact when the library cannot be written", async () => {
    const v1 = memoryStorage();
    for (const item of saved) await v1.save(item);
    await v1.saveDraft(draft());
    const failing: LibraryStorage = {
      ...memoryLibraryStorage(),
      writeItems: async () => {
        throw new Error("quota exceeded");
      },
    };
    expect((await migrateStorage(v1, failing, 100)).status).toBe("failed");
    expect(await v1.list()).toHaveLength(3);
    expect(await v1.loadDraft()).toEqual(draft());
  });

  it("keeps the old records when the library is only in memory", async () => {
    const v1 = memoryStorage();
    await v1.save(saved[0] as SavedItem);
    const result = await migrateStorage(v1, memoryLibraryStorage(false), 100);
    expect(result.status).toBe("failed");
    expect(await v1.list()).toHaveLength(1);
  });
});
