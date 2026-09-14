import {
  type ApiType,
  apiTypes,
  fieldAnchor,
  type OpsBlock,
  opsBlocks,
  typeAnchor,
} from "@regolith-rail/policy-api";
import {
  type Construct,
  constructAnchor,
  constructParamAnchor,
  constructs,
  LIBRARY_PAGES,
  type Library,
} from "@regolith-rail/scenario-kit";

/** Sections of the documentation, in navigation order. */
export const SECTIONS = [
  "Getting started",
  "Book",
  "Guides",
  "Failure modes",
  "Classic problems",
  "Policy API",
  "ops reference",
  "Scenarios",
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
  /** A Book chapter's part and chapter numbers, as the book's contents lists them. */
  part?: number;
  chapter?: number;
}

export type ReferenceKind =
  | { type: "api"; types: ApiType[] }
  | { type: "ops-index" }
  | { type: "ops-block"; block: OpsBlock }
  | { type: "constructs"; library: Library; constructs: Construct[] };

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
    description: "What every hook receives: stations, resources, memory and helpers.",
  },
  "api/station": {
    title: "Stations",
    description: "A station's stock, neighbours, suppliers and orders.",
  },
  "api/vehicle": {
    title: "Vehicles",
    description: "The stopped vehicle, its cargo and the route ahead.",
  },
  "api/review": {
    title: "Reviews and orders",
    description: "What on_review receives and how a station orders from its suppliers.",
  },
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
  (Object.keys(LIBRARY_PAGES) as Library[]).forEach((library, i) => {
    const page = LIBRARY_PAGES[library];
    pages.push({
      ...page,
      section: "Scenarios",
      order: i + 1,
      kind: {
        type: "constructs",
        library,
        constructs: constructs.filter((c) => c.library === library),
      },
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
    case "constructs":
      return page.kind.constructs.flatMap((c) => [
        constructAnchor(c),
        ...c.params.map((p) => constructParamAnchor(c, p)),
      ]);
  }
}
