import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { Nodes, Root } from "mdast";
import { visit } from "unist-util-visit";
import { appendixAt, BOOK_CONTENTS, writtenChapters } from "./book.ts";
import { assignHeadingIds, parseMdx } from "./markdown.ts";

/**
 * The numbered statements of a mathematical text. They share one counter in each chapter, so
 * Definition 2.1 is followed by Proposition 2.2, and a reader finds a statement by its number alone.
 */
export const STATEMENT_KINDS = [
  "Definition",
  "Assumption",
  "Lemma",
  "Proposition",
  "Theorem",
  "Corollary",
  "WorkedExample",
  "Remark",
] as const;
export type StatementKind = (typeof STATEMENT_KINDS)[number];

/**
 * What a kind of statement is called on the page. A worked example is labelled Example; its
 * element has a longer name because `Example` is the element that wraps a runnable code block.
 */
export const kindLabel = (kind: string) => (kind === "WorkedExample" ? "Example" : kind);

/** Elements whose formulas count as part of the text around them: the statements, and proofs. */
export const STATEMENT_ELEMENTS: ReadonlySet<string> = new Set([...STATEMENT_KINDS, "Proof"]);

const isKind = (name: string | null): name is StatementKind =>
  name !== null && (STATEMENT_KINDS as readonly string[]).includes(name);

type Element = Extract<Nodes, { type: "mdxJsxFlowElement" | "mdxJsxTextElement" }>;
type Attribute = Extract<Element["attributes"][number], { type: "mdxJsxAttribute" }>;

const attributeOf = (node: Element, name: string): string | undefined => {
  const a = node.attributes.find(
    (a): a is Attribute => a.type === "mdxJsxAttribute" && a.name === name,
  );
  return typeof a?.value === "string" ? a.value : undefined;
};

const attribute = (name: string, value: string): Attribute => ({
  type: "mdxJsxAttribute",
  name,
  value,
});

export interface Statement {
  kind: StatementKind;
  /** The anchor on its page, such as `thm-littles-law`. */
  id: string;
  /** Its number, such as `2.3`: the chapter, then its place among the chapter's statements. */
  number: string;
  /** Its name, such as "Little's law", when it has one. */
  name?: string;
  /** The slug of its page. */
  slug: string;
  line: number;
}

/** The statements in a page, in order, with the elements that hold them. */
export function statementsIn(
  tree: Root,
  slug: string,
  chapter: number | undefined,
): { node: Element; statement: Statement }[] {
  const found: { node: Element; statement: Statement }[] = [];
  visit(tree, (node) => {
    if (node.type !== "mdxJsxFlowElement" && node.type !== "mdxJsxTextElement") return;
    if (!isKind(node.name)) return;
    const name = attributeOf(node, "name");
    found.push({
      node,
      statement: {
        kind: node.name,
        id: attributeOf(node, "id") ?? "",
        number: `${chapter ?? "?"}.${found.length + 1}`,
        ...(name === undefined ? {} : { name }),
        slug,
        line: node.position?.start.line ?? 0,
      },
    });
  });
  return found;
}

/** References to statements in a page, with the id each names. */
export function refsIn(tree: Root): { node: Element; to: string; line: number }[] {
  const found: { node: Element; to: string; line: number }[] = [];
  visit(tree, (node) => {
    if (
      (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") &&
      node.name === "Ref"
    ) {
      found.push({ node, to: attributeOf(node, "to") ?? "", line: node.position?.start.line ?? 0 });
    }
  });
  return found;
}

const CONTENT = fileURLToPath(new URL("../content/", import.meta.url));
const BOOK_DIR = join(CONTENT, "book");

const slugOfFile = (file: string) =>
  relative(CONTENT, file)
    .replace(/\\/g, "/")
    .replace(/\.mdx$/, "");

const chapterNumbers = () => new Map(writtenChapters().map((c) => [c.slug, c.chapter]));

const parsedChapters = new Map<string, { mtimeMs: number; statements: Statement[] }>();

/**
 * Every statement in the book, by id. Chapter files are parsed again only when they change, so a
 * development server that keeps running resolves references to statements added since it started.
 */
export function bookStatements(dir = BOOK_DIR): Map<string, Statement> {
  const chapters = chapterNumbers();
  const all = new Map<string, Statement>();
  for (const entry of readdirSync(dir).sort()) {
    if (!entry.endsWith(".mdx")) continue;
    const file = join(dir, entry);
    const slug = `book/${entry.replace(/\.mdx$/, "")}`;
    const mtimeMs = statSync(file).mtimeMs;
    let cached = parsedChapters.get(file);
    if (!cached || cached.mtimeMs !== mtimeMs) {
      const tree = parseMdx(readFileSync(file, "utf8"));
      const statements = statementsIn(tree, slug, chapters.get(slug)).map((s) => s.statement);
      cached = { mtimeMs, statements };
      parsedChapters.set(file, cached);
    }
    for (const statement of cached.statements) {
      if (statement.id !== "" && !all.has(statement.id)) all.set(statement.id, statement);
    }
  }
  return all;
}

/** How a statement is cited in running text, such as "Theorem 2.3". */
export const statementLabel = (statement: Statement) =>
  `${kindLabel(statement.kind)} ${statement.number}`;

/**
 * Numbers each statement at build time and resolves each `<Ref to="…" />` to the statement it
 * names, so pages cite statements by number without anyone keeping the numbers in step.
 */
export function remarkStatements() {
  return (tree: Root, file: { path?: string }) => {
    const slug = file.path ? slugOfFile(file.path) : "";
    const here = statementsIn(tree, slug, chapterNumbers().get(slug));
    const refs = refsIn(tree);
    for (const { node, statement } of here) {
      node.attributes = [
        ...node.attributes.filter((a) => !(a.type === "mdxJsxAttribute" && a.name === "number")),
        attribute("number", statement.number),
      ];
    }
    if (refs.length === 0) return;
    const book = bookStatements();
    for (const { statement } of here) book.set(statement.id, statement);
    for (const { node, to } of refs) {
      const target = book.get(to);
      if (!target) {
        node.attributes = [attribute("to", to), attribute("error", `no statement ${to}`)];
        continue;
      }
      const href = target.slug === slug ? `#${target.id}` : `/docs/${target.slug}#${target.id}`;
      node.attributes = [
        attribute("to", to),
        attribute("label", statementLabel(target)),
        attribute("href", href),
      ];
    }
  };
}

interface Page {
  slug: string;
  tree: Root;
  frontmatter: Record<string, unknown>;
}

const ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * Problems with statements and references to them: a statement outside a chapter, a missing,
 * malformed or repeated id, an id that a heading on the page already uses, and a reference to a
 * statement that does not exist.
 */
export function checkStatements(pages: Page[]): string[] {
  const problems: string[] = [];
  const chapters = chapterNumbers();
  const seen = new Map<string, string>();
  for (const page of pages) {
    const statements = statementsIn(page.tree, page.slug, chapters.get(page.slug));
    if (statements.length === 0) continue;
    const isChapter =
      page.frontmatter.section === "Book" &&
      page.slug !== BOOK_CONTENTS &&
      appendixAt(page.slug) === undefined;
    if (!isChapter) {
      problems.push(`${page.slug || "index"}: numbered statements belong in book chapters`);
      continue;
    }
    const headings = new Set(assignHeadingIds(page.tree));
    for (const { statement } of statements) {
      const where = `${page.slug} line ${statement.line}`;
      const tag = `<${statement.kind}>`;
      if (statement.id === "") {
        problems.push(`${where}: ${tag} needs an id, such as id="thm-littles-law"`);
      } else if (!ID.test(statement.id)) {
        problems.push(`${where}: ${tag} id "${statement.id}" must be lower-case words and hyphens`);
      } else if (headings.has(statement.id)) {
        problems.push(`${where}: ${tag} id "${statement.id}" is also a heading's anchor`);
      } else if (seen.has(statement.id)) {
        problems.push(
          `${where}: ${tag} id "${statement.id}" is already used on ${seen.get(statement.id)}`,
        );
      } else {
        seen.set(statement.id, where);
      }
    }
  }
  for (const page of pages) {
    for (const { to, line } of refsIn(page.tree)) {
      if (!seen.has(to)) {
        problems.push(`${page.slug || "index"} line ${line}: <Ref to="${to}"> names no statement`);
      }
    }
  }
  return problems;
}

/** The anchors statements add to a page, for checking links. */
export function statementAnchors(tree: Root): string[] {
  return statementsIn(tree, "", undefined)
    .map((s) => s.statement.id)
    .filter((id) => id !== "");
}
