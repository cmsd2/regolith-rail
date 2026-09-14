import examples from "@regolith-rail/docs/examples" with { type: "json" };
import { starterScenarios } from "@regolith-rail/engine";
import { BUILT_IN_POLICIES } from "@regolith-rail/policy-api";
import {
  type ClassicTemplate,
  classicConstructs,
  classicTemplates,
  examplePolicies,
  policyHeader,
  type TemplateParams,
} from "@regolith-rail/scenario-kit";
import {
  type ExperimentContent,
  type ExperimentItem,
  type ItemId,
  itemId,
  type LibraryItem,
  type PolicyItem,
  partId,
  type ScenarioItem,
} from "./library.ts";
import { type ScenarioSource, starterSource, templateSource } from "./scenario-source.ts";

/** The first sentence of a longer text, for one-line descriptions. */
const firstSentence = (text: string) => /^.*?[.!?](?=\s|$)/.exec(text)?.[0] ?? text;

const DEFAULT_RUN = {
  seed: 1,
  view: "run",
  saveReloadTest: false,
  batch: { seedCount: 100, baseSeed: 1, compare: false },
} as const satisfies Omit<ExperimentContent, "scenario" | "policy">;

const readOnly = { createdAt: 0, updatedAt: 0 };

/** A starter scenario id or a classic template name, as documentation examples name them. */
function scenarioItemId(id: string): ItemId {
  return id.includes(".") ? itemId("classic", "scenario", id) : itemId("builtin", "scenario", id);
}

function starterItems(): ScenarioItem[] {
  return starterScenarios.map(({ id, document }) => {
    const { title, description } = document as { title: string; description: string };
    return {
      ...readOnly,
      id: itemId("builtin", "scenario", id),
      kind: "scenario",
      source: "builtin",
      name: title,
      description: firstSentence(description),
      content: starterSource(id),
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

function examplePolicyItems(): PolicyItem[] {
  return examplePolicies.map((policy) => ({
    ...readOnly,
    id: itemId("example", "policy", policy.file),
    kind: "policy",
    source: "example",
    name: policy.name,
    description: policy.description,
    content: policy.source,
  }));
}

const docsExampleId = (kind: "policy" | "scenario", id: string) =>
  itemId("example", kind, `docs/${id}`);

function docsExampleItems(): LibraryItem[] {
  return examples.map((example): LibraryItem => {
    const base = {
      ...readOnly,
      source: "example" as const,
      name: example.name,
      example: { scenario: scenarioItemId(example.scenario), seed: example.seed },
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
        };
  });
}

const templateSummary = (template: ClassicTemplate) =>
  classicConstructs.find((c) => c.name === template.name)?.summary ?? template.title;

function classicItems(): LibraryItem[] {
  return classicTemplates.flatMap((template): LibraryItem[] => {
    const scenario: ScenarioItem = {
      ...readOnly,
      id: itemId("classic", "scenario", template.name),
      kind: "scenario",
      source: "classic",
      name: template.title,
      description: templateSummary(template),
      content: templateSource(template.name, template.defaults),
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
    const experiment: ExperimentItem = {
      ...readOnly,
      id: itemId("classic", "experiment", template.name),
      kind: "experiment",
      source: "classic",
      name: template.title,
      description: `${template.title} at its default parameters with its reference policy.`,
      content: {
        ...DEFAULT_RUN,
        batch: { ...DEFAULT_RUN.batch },
        scenario: { content: scenario.content, name: scenario.name, origin: scenario.id },
        policy: { content: policy.content, name: policy.name, origin: policy.id },
      },
    };
    return [scenario, policy, experiment];
  });
}

/** Each failure-mode page's suggested fix, paired with the starter scenario it fixes. */
function failureModeExperiments(starters: ScenarioItem[]): ExperimentItem[] {
  return examples
    .filter((example) => example.page.startsWith("failure-modes/") && !example.script)
    .flatMap((example): ExperimentItem[] => {
      const scenario = starters.find((s) => s.id === scenarioItemId(example.scenario));
      if (!scenario) return [];
      const slug = example.page.slice("failure-modes/".length);
      return [
        {
          ...readOnly,
          id: itemId("builtin", "experiment", slug),
          kind: "experiment",
          source: "builtin",
          name: `${example.name}: suggested fix`,
          description: `${scenario.name} with the policy the ${example.name} page suggests.`,
          content: {
            ...DEFAULT_RUN,
            batch: { ...DEFAULT_RUN.batch },
            seed: example.seed,
            scenario: { content: scenario.content, name: scenario.name, origin: scenario.id },
            policy: {
              content: example.source,
              name: example.name,
              origin: docsExampleId("policy", example.id),
            },
          },
        },
      ];
    });
}

function buildCatalogue(): LibraryItem[] {
  const starters = starterItems();
  return [
    ...starters,
    ...builtInPolicyItems(),
    ...failureModeExperiments(starters),
    ...examplePolicyItems(),
    ...docsExampleItems(),
    ...classicItems(),
  ];
}

/** Every read-only item the site ships, in listing order. */
export const catalogue: readonly LibraryItem[] = buildCatalogue();

const byId = new Map(catalogue.map((item) => [item.id, item]));

/** A shipped item by id. */
export const catalogueItem = (id: ItemId): LibraryItem | undefined => byId.get(id);

/** Canonical JSON, with object keys sorted, so equal values give equal text. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** A short, stable FNV-1a hash of a value, for ids that stand for parameters. */
export function stableHash(value: unknown): string {
  let hash = 0x811c9dc5;
  for (const char of canonical(value)) {
    hash ^= char.codePointAt(0) as number;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

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
