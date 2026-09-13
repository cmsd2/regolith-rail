import { fieldAnchor, typeAnchor } from "@regolith-rail/policy-api";
import { constructAnchor, constructParamAnchor } from "@regolith-rail/scenario-kit";
import MiniSearch from "minisearch";
import type { ContentPage } from "./content.ts";
import { searchableText } from "./markdown.ts";
import { paramAnchor, referencePages } from "./pages.ts";
import { SEARCH_INDEX_OPTIONS, type SearchDocument } from "./search.ts";

/** Search entries for every page, Policy API member and `ops` block. */
export function searchDocuments(content: ContentPage[]): SearchDocument[] {
  const extra = new Map(content.map((page) => [page.slug, searchableText(page.tree)]));
  const documents: SearchDocument[] = [];
  const reference = referencePages();
  const referenceSlugs = new Set(reference.map((page) => page.slug));

  for (const page of content) {
    if (referenceSlugs.has(page.slug)) continue;
    const { headings, text } = extra.get(page.slug) ?? { headings: [], text: "" };
    documents.push({
      id: page.slug,
      title: String(page.frontmatter.title ?? page.slug),
      section: String(page.frontmatter.section ?? ""),
      headings: headings.join(" "),
      text: `${page.frontmatter.description ?? ""} ${text}`,
    });
  }

  for (const page of reference) {
    const added = extra.get(page.slug);
    const kind = page.kind;
    const base = {
      section: page.section,
      headings: added?.headings.join(" ") ?? "",
      text: `${page.description} ${added?.text ?? ""}`,
    };
    if (kind.type === "ops-block") {
      documents.push({
        ...base,
        id: page.slug,
        title: page.title,
        text: `${base.text} ${kind.block.stage} ${kind.block.params
          .map((p) => `${p.name} ${p.summary}`)
          .join(" ")}`,
      });
      for (const param of kind.block.params) {
        documents.push({
          id: `${page.slug}#${paramAnchor(param.name)}`,
          title: `${param.name} (ops.${kind.block.name})`,
          section: page.section,
          headings: "",
          text: param.summary,
        });
      }
    } else if (kind.type === "api") {
      documents.push({ ...base, id: page.slug, title: page.title });
      for (const type of kind.types) {
        documents.push({
          id: `${page.slug}#${typeAnchor(type)}`,
          title: type.name,
          section: page.section,
          headings: "",
          text: type.summary,
        });
        for (const field of type.fields) {
          documents.push({
            id: `${page.slug}#${fieldAnchor(type, field)}`,
            title: `${type.name}.${field.name}`,
            section: page.section,
            headings: "",
            text: field.summary,
          });
        }
      }
    } else if (kind.type === "constructs") {
      documents.push({ ...base, id: page.slug, title: page.title });
      for (const construct of kind.constructs) {
        documents.push({
          id: `${page.slug}#${constructAnchor(construct)}`,
          title: construct.name,
          section: page.section,
          headings: "",
          text: `${construct.summary} ${construct.params.map((p) => p.name).join(" ")}`,
        });
        for (const param of construct.params) {
          documents.push({
            id: `${page.slug}#${constructParamAnchor(construct, param)}`,
            title: `${param.name} (${construct.name})`,
            section: page.section,
            headings: "",
            text: param.summary,
          });
        }
      }
    } else {
      documents.push({ ...base, id: page.slug, title: page.title });
    }
  }
  return documents;
}

export function buildSearchIndex(content: ContentPage[]): MiniSearch<SearchDocument> {
  const index = new MiniSearch<SearchDocument>(SEARCH_INDEX_OPTIONS);
  index.addAll(searchDocuments(content));
  return index;
}
