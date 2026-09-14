import { describe, expect, it } from "vitest";
import { catalogueItem } from "./catalogue.ts";
import type { ExperimentItem, LibraryItem, PolicyItem } from "./library.ts";
import { duplicated, renamed } from "./library-ops.ts";
import { memoryLibraryStorage, type SessionRecord } from "./library-storage.ts";
import { classicExperiment } from "./test-fixtures.ts";

const policy = (id: string, name: string, updatedAt = 1): PolicyItem => ({
  id,
  kind: "policy",
  source: "mine",
  name,
  content: `-- ${name}\nreturn {}`,
  createdAt: 1,
  updatedAt,
});

const experiment = (): ExperimentItem => {
  const shipped = classicExperiment();
  return {
    ...shipped,
    id: "mine:experiment:e1",
    source: "mine",
    name: "Reorder run",
    updatedAt: 5,
  };
};

describe("library storage", () => {
  it("saves, lists newest first, and deletes items and experiments", async () => {
    const storage = memoryLibraryStorage();
    await storage.writeItems([policy("mine:policy:a", "buffer", 2), experiment()]);
    expect((await storage.listItems()).map((i) => i.id)).toEqual([
      "mine:experiment:e1",
      "mine:policy:a",
    ]);
    await storage.writeItems([], ["mine:experiment:e1"]);
    expect((await storage.listItems()).map((i) => i.id)).toEqual(["mine:policy:a"]);
  });

  it("keeps stored items apart from later changes to the caller's objects", async () => {
    const storage = memoryLibraryStorage();
    const item = policy("mine:policy:a", "buffer");
    await storage.writeItems([item]);
    item.content = "changed";
    expect((await storage.listItems())[0]?.content).toBe("-- buffer\nreturn {}");
  });

  it("renames within a kind without clashing, and stores the renamed item", async () => {
    const storage = memoryLibraryStorage();
    const items: LibraryItem[] = [
      policy("mine:policy:a", "buffer"),
      policy("mine:policy:b", "other"),
    ];
    await storage.writeItems(items);
    const next = renamed(items[1] as PolicyItem, "buffer", items, 9);
    expect(next).toMatchObject({ id: "mine:policy:b", name: "buffer 2", updatedAt: 9 });
    expect(renamed(items[0] as PolicyItem, "  ", items, 9).name).toBe("buffer");
    await storage.writeItems([next]);
    expect((await storage.listItems()).map((i) => i.name).sort()).toEqual(["buffer", "buffer 2"]);
  });

  it("duplicates items and experiments into Mine under a copy name", async () => {
    const storage = memoryLibraryStorage();
    const baseline = catalogueItem("builtin:policy:balance-stock") as PolicyItem;
    const first = duplicated(baseline, [], 3);
    const second = duplicated(baseline, [first], 4);
    const copy = duplicated(experiment(), [], 5);
    expect(first).toMatchObject({
      source: "mine",
      name: "balance-stock (copy)",
      origin: baseline.id,
    });
    expect(second.name).toBe("balance-stock (copy 2)");
    expect(copy).toMatchObject({ kind: "experiment", name: "Reorder run (copy)" });
    await storage.writeItems([first, second, copy]);
    expect(await storage.listItems()).toHaveLength(3);
  });

  it("keeps the session record", async () => {
    const storage = memoryLibraryStorage();
    const session: SessionRecord = {
      slots: { scenario: "builtin:scenario:relay", policy: "mine:policy:a", compare: null },
      items: [],
      seed: 4,
      view: "batch",
      saveReloadTest: false,
      batch: { seedCount: 30, baseSeed: 2, compare: true },
    };
    expect(await storage.loadSession()).toBeUndefined();
    await storage.saveSession(session);
    expect(await storage.loadSession()).toEqual(session);
  });

  it("reports whether it will keep anything", () => {
    expect(memoryLibraryStorage().available).toBe(true);
    expect(memoryLibraryStorage(false).available).toBe(false);
  });
});
