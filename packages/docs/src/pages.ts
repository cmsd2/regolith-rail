import {
  type ApiType,
  apiTypes,
  fieldAnchor,
  type OpsBlock,
  opsBlocks,
  typeAnchor,
} from "@regolith-rail/policy-api";

/** Sections of the documentation, in navigation order. */
export const SECTIONS = [
  "Getting started",
  "Guides",
  "Failure modes",
  "Policy API",
  "ops reference",
  "Reference",
  "Game mechanics",
  "About",
] as const;

export type Section = (typeof SECTIONS)[number];

export const isSection = (value: unknown): value is Section =>
  typeof value === "string" && (SECTIONS as readonly string[]).includes(value);

export interface DocFrontmatter {
  title: string;
  description?: string;
  section: Section;
  order?: number;
}

export type ReferenceKind =
  | { type: "api"; types: ApiType[] }
  | { type: "ops-index" }
  | { type: "ops-block"; block: OpsBlock };

export interface ReferencePage {
  slug: string;
  title: string;
  description: string;
  section: Section;
  order: number;
  kind: ReferenceKind;
}

/** Titles of Policy API pages by slug. A page without a title fails the documentation check. */
export const API_PAGE_TITLES: Record<string, { title: string; description: string }> = {
  "api/context": {
    title: "Context",
    description: "What on_start and on_stop receive, and the resources they refer to.",
  },
  "api/train": {
    title: "Trains and actions",
    description: "The train at a stop, its cargo and the actions it can take.",
  },
  "api/station": { title: "Stations", description: "A station's stock, capacity and memory." },
  "api/line": { title: "The line", description: "Every station and train on the line." },
};

/** Stages of the ops pipeline, in the order the reference lists them. */
export const OPS_STAGES = ["pipeline", "classify", "target", "plan", "allocate", "helper"] as const;
const OPS_ORDER: readonly string[] = OPS_STAGES;

/** Reference pages generated from the Policy API and `ops` descriptions. */
export function referencePages(): ReferencePage[] {
  const pages: ReferencePage[] = [];
  const bySlug = new Map<string, ApiType[]>();
  for (const type of apiTypes) bySlug.set(type.docs, [...(bySlug.get(type.docs) ?? []), type]);
  [...bySlug].forEach(([slug, types], order) => {
    const titles = API_PAGE_TITLES[slug];
    pages.push({
      slug,
      title: titles?.title ?? slug,
      description: titles?.description ?? "",
      section: "Policy API",
      order,
      kind: { type: "api", types },
    });
  });
  pages.push({
    slug: "ops",
    title: "The ops pipeline",
    description: "Building blocks for policies: classify, target, plan, allocate and execute.",
    section: "ops reference",
    order: 0,
    kind: { type: "ops-index" },
  });
  const blocks = [...opsBlocks].sort(
    (a, b) => OPS_ORDER.indexOf(a.stage) - OPS_ORDER.indexOf(b.stage),
  );
  blocks.forEach((block, i) => {
    pages.push({
      slug: block.docs,
      title: `ops.${block.name}`,
      description: block.summary,
      section: "ops reference",
      order: i + 1,
      kind: { type: "ops-block", block },
    });
  });
  return pages;
}

/** Anchor of a block parameter on the block's page. */
export const paramAnchor = (name: string) => `param-${name.replace(/[^\w-]/g, "")}`;

/** Every anchor a reference page defines. */
export function referenceAnchors(page: ReferencePage): string[] {
  switch (page.kind.type) {
    case "api":
      return page.kind.types.flatMap((type) => [
        typeAnchor(type),
        ...type.fields.map((field) => fieldAnchor(type, field)),
      ]);
    case "ops-block":
      return page.kind.block.params.length > 0
        ? ["parameters", ...page.kind.block.params.map((p) => paramAnchor(p.name))]
        : [];
    case "ops-index":
      return [...OPS_STAGES];
  }
}
