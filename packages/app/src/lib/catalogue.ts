import examples from "@regolith-rail/docs/examples" with { type: "json" };
import { starterScenarios } from "@regolith-rail/engine";
import { BUILT_IN_POLICIES } from "@regolith-rail/policy-api";
import {
  type ClassicTemplate,
  classicConstructs,
  classicTemplates,
  policyHeader,
  type TemplateParams,
} from "@regolith-rail/scenario-kit";
import { canonical, stableHash } from "./content-hash.ts";
import {
  type ExperimentItem,
  type ItemId,
  itemId,
  type LibraryItem,
  type PolicyItem,
  partId,
  type ScenarioItem,
  type ScenarioLesson,
} from "./library.ts";
import { type ScenarioSource, starterSource, templateSource } from "./scenario-source.ts";

/** The first sentence of a longer text, for one-line descriptions. */
const firstSentence = (text: string) => /^.*?[.!?](?=\s|$)/.exec(text)?.[0] ?? text;

const readOnly = { createdAt: 0, updatedAt: 0 };

/** A starter scenario id or a classic template name, as documentation examples name them. */
function scenarioItemId(id: string): ItemId {
  return id.includes(".") ? itemId("classic", "scenario", id) : itemId("builtin", "scenario", id);
}

const docsExampleId = (kind: "policy" | "scenario", id: string) =>
  itemId("example", kind, `docs/${id}`);

/** Each starter's lesson: its failure-mode page, and the policy example that page suggests. */
function starterItems(): ScenarioItem[] {
  return starterScenarios.map(({ id, document }) => {
    const { title, description, docs } = document as {
      title: string;
      description: string;
      docs?: string;
    };
    // The docs field may name a section, such as a chapter's case study.
    const page = docs?.split("#")[0];
    const fix = examples.find(
      (e) => e.page === page && "fix" in e && e.fix && !e.script && e.scenario === id,
    );
    return {
      ...readOnly,
      id: itemId("builtin", "scenario", id),
      kind: "scenario",
      source: "builtin",
      name: title,
      description: firstSentence(description),
      content: starterSource(id),
      ...(docs
        ? { lesson: { docs, ...(fix ? { fix: docsExampleId("policy", fix.id) } : {}) } }
        : {}),
    };
  });
}

function builtInPolicyItems(): PolicyItem[] {
  return Object.entries(BUILT_IN_POLICIES).map(([name, source]) => ({
    ...readOnly,
    id: itemId("builtin", "policy", name),
    kind: "policy",
    source: "builtin",
    name,
    description: policyHeader(source)?.description ?? "",
    content: source,
  }));
}

/**
 * Every runnable documentation example, so a docs page can open one. Most are snippets that make sense
 * beside their page, so only the starters' suggested fixes are listed, named for their scenario.
 */
function docsExampleItems(starters: readonly ScenarioItem[]): LibraryItem[] {
  const fixes = new Map(
    starters.flatMap((s): [ItemId, ScenarioItem][] => (s.lesson?.fix ? [[s.lesson.fix, s]] : [])),
  );
  return examples.map((example): LibraryItem => {
    const base = {
      ...readOnly,
      source: "example" as const,
      name: example.name,
      example: { scenario: scenarioItemId(example.scenario), seed: example.seed },
      listed: false,
    };
    return example.script
      ? {
          ...base,
          id: docsExampleId("scenario", example.id),
          kind: "scenario",
          description: `A scenario script from the ${example.name} documentation page.`,
          content: { kind: "script", source: example.source, starterId: null },
        }
      : {
          ...base,
          id: docsExampleId("policy", example.id),
          kind: "policy",
          description: `A policy from the ${example.name} documentation page.`,
          content: example.source,
          ...fixFor(fixes.get(docsExampleId("policy", example.id)), example.name),
        };
  });
}

const fixFor = (starter: ScenarioItem | undefined, page: string) =>
  starter
    ? {
        name: `${starter.name} fix`,
        description: `The suggested fix for ${starter.name}, from the ${page} page.`,
        listed: true,
      }
    : {};

const templateConstruct = (template: ClassicTemplate) =>
  classicConstructs.find((c) => c.name === template.name);

function classicItems(): LibraryItem[] {
  return classicTemplates.flatMap((template): LibraryItem[] => {
    const scenario: ScenarioItem = {
      ...readOnly,
      id: itemId("classic", "scenario", template.name),
      kind: "scenario",
      source: "classic",
      name: template.title,
      description: templateConstruct(template)?.summary ?? template.title,
      content: templateSource(template.name, template.defaults),
      lesson: {
        docs: templateConstruct(template)?.docs ?? "",
        reference: template.name,
      },
    };
    const reference = template.reference(template.defaults);
    const policy: PolicyItem = {
      ...readOnly,
      id: itemId("classic", "policy", template.name),
      kind: "policy",
      source: "classic",
      name: `${template.title} reference policy`,
      description: reference.summary,
      content: reference.policy,
    };
    return [scenario, policy];
  });
}

function buildCatalogue(): LibraryItem[] {
  const starters = starterItems();
  return [...starters, ...builtInPolicyItems(), ...docsExampleItems(starters), ...classicItems()];
}

/** Every read-only item the site ships, in listing order. */
export const catalogue: readonly LibraryItem[] = buildCatalogue();

const byId = new Map(catalogue.map((item) => [item.id, item]));

/**
 * Ids that shipped items had before they were renamed or their documentation page moved, with their
 * ids now, so saved slots, runs and copies still find them.
 */
export const MOVED_ITEMS: Readonly<Record<ItemId, ItemId>> = {
  // The balancing baseline was called naive before.
  "builtin:policy:naive": "builtin:policy:balance-stock",
  "example:policy:docs/failure-modes/dead-stock#1": "example:policy:docs/book/flows#1",
  "example:policy:docs/failure-modes/double-dispatch#1": "example:policy:docs/book/base-stock#4",
  "example:policy:docs/failure-modes/half-capacity#1": "example:policy:docs/book/modelling#1",
};

/** A shipped item by id, following ids of items whose page has moved. */
export const catalogueItem = (id: ItemId): LibraryItem | undefined =>
  byId.get(id) ?? byId.get(MOVED_ITEMS[id] ?? "");

/**
 * A classic template's reference policy for some parameters. At the defaults this is the
 * catalogue item; otherwise an unlisted item whose id stands for the parameters.
 */
export function referencePolicyItem(templateName: string, params: TemplateParams): PolicyItem {
  const template = classicTemplates.find((t) => t.name === templateName);
  if (!template) throw new Error(`unknown template ${templateName}`);
  const merged = { ...template.defaults, ...params };
  if (canonical(merged) === canonical(template.defaults)) {
    return catalogueItem(itemId("classic", "policy", templateName)) as PolicyItem;
  }
  const reference = template.reference(merged);
  return {
    ...readOnly,
    id: itemId("classic", "policy", `${templateName}@${stableHash(merged)}`),
    kind: "policy",
    source: "classic",
    name: `${template.title} reference policy`,
    description: reference.summary,
    content: reference.policy,
    listed: false,
  };
}

/** The template and parameters a classic reference policy item stands for, when it is one. */
export function referenceOf(id: ItemId): string | null {
  const match = /^classic:policy:([^@]+)/.exec(id);
  return match ? (match[1] as string) : null;
}

/** The unlisted items that stand for an experiment's parts, so slots can refer to them. */
export function experimentParts(experiment: ExperimentItem): (ScenarioItem | PolicyItem)[] {
  const { content, source } = experiment;
  const part = <T extends ScenarioSource | string>(
    name: "scenario" | "policy" | "compare",
    value: { content: T; name: string; origin?: ItemId },
  ) => ({
    ...readOnly,
    id: partId(experiment.id, name),
    source,
    name: value.name,
    ...(value.origin ? { origin: value.origin } : {}),
    listed: false,
  });
  return [
    { ...part("scenario", content.scenario), kind: "scenario", content: content.scenario.content },
    { ...part("policy", content.policy), kind: "policy", content: content.policy.content },
    ...(content.compare
      ? [
          {
            ...part("compare", content.compare),
            kind: "policy" as const,
            content: content.compare.content,
          },
        ]
      : []),
  ];
}

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

/**
 * The lesson for a scenario item: its own when it was shipped with one, otherwise that of the shipped
 * scenario it was copied from. A copy of a classic template keeps the template's reference policy.
 */
export function lessonOf(
  item: LibraryItem | undefined,
  lookup: (id: ItemId) => LibraryItem | undefined,
): ScenarioLesson | undefined {
  let current = item;
  for (let depth = 0; current && depth < 10; depth++) {
    if (current.kind === "scenario" && current.lesson) return current.lesson;
    current = current.origin ? lookup(current.origin) : undefined;
  }
  if (item?.kind !== "scenario" || !item.content.template) return undefined;
  const template = catalogueItem(itemId("classic", "scenario", item.content.template.name));
  return template?.kind === "scenario" ? template.lesson : undefined;
}
