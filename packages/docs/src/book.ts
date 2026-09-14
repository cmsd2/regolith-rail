/** A chapter of the book. Chapters without a slug are planned and not yet written. */
export interface BookChapter {
  chapter: number;
  title: string;
  slug?: string;
}

export interface BookPart {
  part: number;
  title: string;
  chapters: BookChapter[];
}

/** The contents page's slug. */
export const BOOK_CONTENTS = "book";

/**
 * The book's parts and chapters in reading order. A chapter gets its slug when its page is
 * written; the documentation check then requires the page to agree with this list.
 */
export const BOOK: readonly BookPart[] = [
  {
    part: 1,
    title: "Foundations",
    chapters: [
      { chapter: 1, title: "Modelling operations" },
      { chapter: 2, title: "Randomness and simulation" },
    ],
  },
  {
    part: 2,
    title: "Inventory",
    chapters: [
      { chapter: 3, title: "Reviews, lead times and base-stock" },
      { chapter: 4, title: "One period under uncertainty: the newsvendor" },
      { chapter: 5, title: "Order quantities: EOQ and (s, S)" },
      { chapter: 6, title: "Safety stock and service levels" },
      { chapter: 7, title: "Forecasting" },
    ],
  },
  {
    part: 3,
    title: "Networks",
    chapters: [
      { chapter: 8, title: "Supply chains, echelon stock and the bullwhip effect" },
      { chapter: 9, title: "Allocation, fairness and risk pooling" },
      { chapter: 10, title: "Disruptions and resilience" },
    ],
  },
  {
    part: 4,
    title: "Optimisation",
    chapters: [
      { chapter: 11, title: "Linear programming and the transportation problem" },
      { chapter: 12, title: "Network flows and bounds over time" },
      { chapter: 13, title: "Integer problems: loading, relaxations and heuristics" },
      { chapter: 14, title: "Routing and inventory routing" },
    ],
  },
  {
    part: 5,
    title: "Dynamics",
    chapters: [
      { chapter: 15, title: "Feedback control" },
      { chapter: 16, title: "Queues and Little's law" },
      { chapter: 17, title: "Sequential decisions and dynamic programming" },
    ],
  },
];

/** Roman numerals for part numbers. */
export const partNumeral = (part: number) =>
  ["I", "II", "III", "IV", "V", "VI"][part - 1] ?? String(part);

/** Whether a part has any written chapter. */
export const isWritten = (part: BookPart) => part.chapters.some((c) => c.slug !== undefined);

export interface WrittenChapter extends BookChapter {
  slug: string;
  part: BookPart;
}

/** Written chapters in reading order. */
export function writtenChapters(book: readonly BookPart[] = BOOK): WrittenChapter[] {
  return book.flatMap((part) =>
    part.chapters.flatMap((c) => (c.slug === undefined ? [] : [{ ...c, slug: c.slug, part }])),
  );
}

/** The written chapter with a slug, and the written chapters before and after it. */
export function chapterAt(
  slug: string,
  book: readonly BookPart[] = BOOK,
): { chapter: WrittenChapter; previous?: WrittenChapter; next?: WrittenChapter } | undefined {
  const chapters = writtenChapters(book);
  const index = chapters.findIndex((c) => c.slug === slug);
  if (index === -1) return undefined;
  const previous = chapters[index - 1];
  const next = chapters[index + 1];
  return {
    chapter: chapters[index] as WrittenChapter,
    ...(previous ? { previous } : {}),
    ...(next ? { next } : {}),
  };
}

/**
 * Problems with book pages: a Book page the contents doesn't list, frontmatter that disagrees
 * with the contents, or a listed chapter with no page.
 */
export function checkBook(
  pages: { slug: string; frontmatter: Record<string, unknown> }[],
  book: readonly BookPart[] = BOOK,
): string[] {
  const problems: string[] = [];
  const chapters = new Map(writtenChapters(book).map((c) => [c.slug, c]));
  const slugs = new Set(pages.map((p) => p.slug));
  for (const { slug, frontmatter } of pages) {
    if (frontmatter.section !== "Book" || slug === BOOK_CONTENTS) continue;
    const chapter = chapters.get(slug);
    if (!chapter) {
      problems.push(`${slug}: a Book page that the book's contents doesn't list`);
      continue;
    }
    if (frontmatter.part !== chapter.part.part) {
      problems.push(
        `${slug}: part ${String(frontmatter.part)} but the contents says ${chapter.part.part}`,
      );
    }
    if (frontmatter.chapter !== chapter.chapter) {
      problems.push(
        `${slug}: chapter ${String(frontmatter.chapter)} but the contents says ${chapter.chapter}`,
      );
    }
    if (frontmatter.title !== chapter.title) {
      problems.push(
        `${slug}: title ${JSON.stringify(frontmatter.title)} but the contents says ${JSON.stringify(chapter.title)}`,
      );
    }
  }
  for (const slug of chapters.keys()) {
    if (!slugs.has(slug)) problems.push(`${slug}: listed in the book's contents but has no page`);
  }
  return problems;
}
