import { POLICY_API_VERSION } from "@regolith-rail/engine";
import { shippedPolicyFor, shippedScenarioFor } from "./catalogue.ts";
import { contentHash } from "./content-hash.ts";
import {
  type ExperimentContent,
  type ExperimentPart,
  type ItemId,
  itemId,
  type LibraryItem,
  parsePartId,
} from "./library.ts";
import type { ScenarioSource } from "./scenario-source.ts";
import type { ShareState } from "./share.ts";

/** The parts of the workbench an experiment records. */
export interface RunSetup {
  slots: { scenario: ItemId; policy: ItemId; compare: ItemId };
  seed: number;
  view: "run" | "batch";
  saveReloadTest: boolean;
  batch: { seedCount: number; baseSeed: number; compare: boolean };
  itemById(id: ItemId): LibraryItem | undefined;
}

/** An experiment part copied from the item filling a slot. */
function partOf<T>(item: LibraryItem | undefined, content: T): ExperimentPart<T> {
  // A part of another experiment records the item that part came from.
  const origin = item && (parsePartId(item.id) ? item.origin : item.id);
  return { content, name: item?.name ?? "", ...(origin ? { origin } : {}) };
}

/** A snapshot of the run's setup. The comparison policy is kept only when the batch compares. */
export function experimentContentOf(setup: RunSetup): ExperimentContent {
  const scenario = setup.itemById(setup.slots.scenario);
  const policy = setup.itemById(setup.slots.policy);
  const compare = setup.itemById(setup.slots.compare);
  const scenarioContent = scenario?.kind === "scenario" ? scenario.content : null;
  if (!scenarioContent || policy?.kind !== "policy") {
    throw new Error("the run's slots do not hold a scenario and a policy");
  }
  const { kind, source, starterId, template } = scenarioContent;
  return {
    scenario: partOf(scenario, { kind, source, starterId, ...(template ? { template } : {}) }),
    policy: partOf(policy, policy.content),
    ...(setup.batch.compare && compare?.kind === "policy"
      ? { compare: partOf(compare, compare.content) }
      : {}),
    seed: setup.seed,
    view: setup.view,
    saveReloadTest: setup.saveReloadTest,
    batch: { ...setup.batch },
  };
}

/** A default name for an experiment, from its scenario and policy. */
export const experimentName = (content: ExperimentContent) =>
  `${content.scenario.name} · ${content.policy.name}`;

/** The share link state for an experiment. */
export function shareStateOf(content: ExperimentContent, appVersion: string): ShareState {
  const batch = content.view === "batch";
  return {
    apiVersion: POLICY_API_VERSION,
    appVersion,
    view: content.view,
    policy: { name: content.policy.name, source: content.policy.content },
    ...(batch && content.batch.compare && content.compare
      ? { policyB: { name: content.compare.name, source: content.compare.content } }
      : {}),
    scenario: content.scenario.content,
    seed: content.seed,
    saveReloadTest: content.saveReloadTest,
    ...(batch ? { batch: { ...content.batch } } : {}),
  };
}

/** A shared part named after the shipped item it matches, or after the name the link gave it. */
function sharedPart<T extends string | ScenarioSource>(
  content: T,
  shipped: LibraryItem | undefined,
  name: string,
): ExperimentPart<T> {
  return shipped ? { content, name: shipped.name, origin: shipped.id } : { content, name };
}

const policyName = (name: string, fallback: string) => name.replace(/\.lua$/, "") || fallback;

/** An experiment from an opened share link. */
export function experimentFromShareState(state: ShareState): ExperimentContent {
  const scenario = state.scenario;
  const shippedScenario = shippedScenarioFor(scenario);
  return {
    scenario: sharedPart(scenario, shippedScenario, "Shared scenario"),
    policy: sharedPart(
      state.policy.source,
      shippedPolicyFor(state.policy.source, scenario),
      policyName(state.policy.name, "Shared policy"),
    ),
    ...(state.policyB
      ? {
          compare: sharedPart(
            state.policyB.source,
            shippedPolicyFor(state.policyB.source, scenario),
            policyName(state.policyB.name, "Shared comparison policy"),
          ),
        }
      : {}),
    seed: state.seed,
    view: state.view,
    saveReloadTest: state.saveReloadTest,
    batch: state.batch ?? { seedCount: 100, baseSeed: 1, compare: Boolean(state.policyB) },
  };
}

/** The id of the shared experiment for some content, the same whenever the content is. */
export async function sharedExperimentId(content: ExperimentContent): Promise<ItemId> {
  return itemId("shared", "experiment", await contentHash(content));
}
