import { catalogue, referencePolicyItem } from "./catalogue.ts";
import {
  type ItemId,
  type LibraryItem,
  newMineId,
  type PolicyItem,
  type ScenarioItem,
  uniqueName,
} from "./library.ts";
import type { LibraryStorage, SessionRecord } from "./library-storage.ts";
import { type ScenarioSource, upgradeScenarioRecord } from "./scenario-source.ts";
import type { Draft, SavedItem, WorkStorage } from "./storage.ts";

const SOURCE_PREFERENCE = ["builtin", "classic", "example"];

const preferred = <T extends LibraryItem>(items: T[]) =>
  items.sort(
    (a, b) => SOURCE_PREFERENCE.indexOf(a.source) - SOURCE_PREFERENCE.indexOf(b.source),
  )[0];

/**
 * The shipped policy whose source this is, if any, including a classic template's reference
 * policy for the parameters of the scenario it runs on.
 */
export function shippedPolicyFor(
  source: string,
  scenario?: ScenarioSource,
): PolicyItem | undefined {
  const shipped = catalogue.filter(
    (item): item is PolicyItem => item.kind === "policy" && item.content === source,
  );
  if (shipped.length > 0) return preferred(shipped);
  if (scenario?.template) {
    const reference = referencePolicyItem(scenario.template.name, scenario.template.params);
    if (reference.content === source) return reference;
  }
  return undefined;
}

/** The shipped scenario whose source this is, if any, such as an unedited starter or template. */
export function shippedScenarioFor(record: ScenarioSource): ScenarioItem | undefined {
  const shipped = catalogue.filter(
    (item): item is ScenarioItem =>
      item.kind === "scenario" &&
      item.content.kind === record.kind &&
      item.content.source === record.source,
  );
  return shipped.length > 0 ? preferred(shipped) : undefined;
}

export interface Migration {
  /** New Mine items, from saved work and from edited parts of the draft. */
  items: LibraryItem[];
  /** The slots the draft filled, when there was a draft. */
  session?: SessionRecord;
}

/** Library items and a session from the saved work and draft of releases before the library. */
export function migrateV1(
  saved: readonly SavedItem[],
  draft: Draft | undefined,
  now: number,
): Migration {
  const items: LibraryItem[] = saved.flatMap((item): LibraryItem[] => {
    const base = {
      source: "mine" as const,
      name: item.name,
      createdAt: item.savedAt,
      updatedAt: item.savedAt,
    };
    if (item.kind === "policy") {
      return [{ ...base, id: newMineId("policy"), kind: "policy", content: item.source }];
    }
    // Saves from before scenario scripts hold JSON text with no kind.
    const content = item.scenarioKind
      ? { kind: item.scenarioKind, source: item.text, starterId: null }
      : upgradeScenarioRecord({ starterId: null, text: item.text });
    return content ? [{ ...base, id: newMineId("scenario"), kind: "scenario", content }] : [];
  });
  if (!draft) return { items };

  const scenario = upgradeScenarioRecord(draft.scenario);
  const unlisted: LibraryItem[] = [];
  const names = (kind: LibraryItem["kind"]) =>
    items.filter((i) => i.kind === kind).map((i) => i.name);

  const scenarioSlot = (): ItemId => {
    if (!scenario) return "builtin:scenario:two-station";
    const shipped = shippedScenarioFor(scenario);
    if (shipped) return shipped.id;
    const same = items.find(
      (i): i is ScenarioItem =>
        i.kind === "scenario" &&
        i.content.kind === scenario.kind &&
        i.content.source === scenario.source,
    );
    if (same) return same.id;
    const item: ScenarioItem = {
      id: newMineId("scenario"),
      kind: "scenario",
      source: "mine",
      name: uniqueName("Draft scenario", names("scenario")),
      content: { ...scenario, starterId: null },
      createdAt: now,
      updatedAt: now,
    };
    items.push(item);
    return item.id;
  };

  const policySlot = (source: string, name: string): ItemId => {
    const shipped = shippedPolicyFor(source, scenario ?? undefined);
    if (shipped) {
      if (shipped.listed === false) unlisted.push(shipped);
      return shipped.id;
    }
    const same = items.find((i) => i.kind === "policy" && i.content === source);
    if (same) return same.id;
    const item: PolicyItem = {
      id: newMineId("policy"),
      kind: "policy",
      source: "mine",
      name: uniqueName(name, names("policy")),
      content: source,
      createdAt: now,
      updatedAt: now,
    };
    items.push(item);
    return item.id;
  };

  const session: SessionRecord = {
    slots: {
      scenario: scenarioSlot(),
      policy: policySlot(draft.policy.source, "Draft policy"),
      compare: policySlot(draft.policyB.source, "Draft comparison policy"),
    },
    items: unlisted,
    seed: draft.seed,
    view: "run",
    saveReloadTest: false,
    batch: { seedCount: 100, baseSeed: 1, compare: false },
  };
  return { items, session };
}

export type MigrationStatus = "none" | "migrated" | "failed";

/**
 * Moves saved work and the draft from earlier releases into the library. The old records are
 * removed only once the library has been written to storage that keeps it.
 */
export async function migrateStorage(
  v1: WorkStorage,
  v2: LibraryStorage,
  now: number,
): Promise<{ status: MigrationStatus; session?: SessionRecord }> {
  if (!v1.available) return { status: "none" };
  let saved: SavedItem[];
  let draft: Draft | undefined;
  try {
    saved = await v1.list();
    draft = await v1.loadDraft();
  } catch {
    return { status: "failed" };
  }
  if (saved.length === 0 && !draft) return { status: "none" };
  const migration = migrateV1(saved, draft, now);
  try {
    await v2.writeItems(migration.items);
    if (migration.session) await v2.saveSession(migration.session);
  } catch {
    return { status: "failed" };
  }
  if (!v2.available)
    return { status: "failed", ...(migration.session ? { session: migration.session } : {}) };
  await v1.clear().catch(() => {});
  return { status: "migrated", ...(migration.session ? { session: migration.session } : {}) };
}
