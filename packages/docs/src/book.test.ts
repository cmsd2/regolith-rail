import { describe, expect, it } from "vitest";
import { BOOK, type BookPart, chapterAt, checkBook, writtenChapters } from "./book.ts";
import { frontmatterOf, parseMdx } from "./markdown.ts";

const book: BookPart[] = [
  {
    part: 1,
    title: "Foundations",
    chapters: [
      { chapter: 1, title: "Modelling operations", slug: "book/modelling" },
      { chapter: 2, title: "Randomness and simulation" },
    ],
  },
  {
    part: 2,
    title: "Inventory",
    chapters: [
      { chapter: 3, title: "Reviews", slug: "book/base-stock" },
      { chapter: 4, title: "The newsvendor", slug: "book/newsvendor" },
    ],
  },
];

const page = (slug: string, yaml: string) => ({
  slug,
  frontmatter: frontmatterOf(parseMdx(`---\n${yaml}\n---\n\nText.`)),
});

describe("book contents", () => {
  it("numbers chapters in order across parts", () => {
    const numbers = BOOK.flatMap((p) => p.chapters.map((c) => c.chapter));
    expect(numbers).toEqual(numbers.map((_, i) => i + 1));
    expect(BOOK.map((p) => p.title)).toEqual([
      "Foundations",
      "Inventory",
      "Networks",
      "Optimisation",
      "Dynamics",
    ]);
  });

  it("links each written chapter to the written chapters either side", () => {
    expect(writtenChapters(book).map((c) => c.slug)).toEqual([
      "book/modelling",
      "book/base-stock",
      "book/newsvendor",
    ]);
    const third = chapterAt("book/base-stock", book);
    expect(third?.previous?.slug).toBe("book/modelling");
    expect(third?.next?.slug).toBe("book/newsvendor");
    expect(chapterAt("book/modelling", book)?.previous).toBeUndefined();
    expect(chapterAt("book/randomness", book)).toBeUndefined();
  });
});

describe("book check", () => {
  const good = [
    page("book/modelling", "title: Modelling operations\nsection: Book\npart: 1\nchapter: 1"),
    page("book/base-stock", "title: Reviews\nsection: Book\npart: 2\nchapter: 3"),
    page("book/newsvendor", "title: The newsvendor\nsection: Book\npart: 2\nchapter: 4"),
    page("book", "title: The book\nsection: Book"),
  ];

  it("passes when pages agree with the contents", () => {
    expect(checkBook(good, book)).toEqual([]);
  });

  it("names a chapter whose frontmatter disagrees with the contents", () => {
    const pages = [
      ...good.slice(1),
      page("book/modelling", "title: Modelling\nsection: Book\npart: 2\nchapter: 3"),
    ];
    expect(checkBook(pages, book)).toEqual([
      "book/modelling: part 2 but the contents says 1",
      "book/modelling: chapter 3 but the contents says 1",
      'book/modelling: title "Modelling" but the contents says "Modelling operations"',
    ]);
  });

  it("names unlisted Book pages and listed chapters without a page", () => {
    const pages = [
      ...good.filter((p) => p.slug !== "book/newsvendor"),
      page("book/extra", "title: Extra\nsection: Book\npart: 1\nchapter: 9"),
    ];
    expect(checkBook(pages, book)).toEqual([
      "book/extra: a Book page that the book's contents doesn't list",
      "book/newsvendor: listed in the book's contents but has no page",
    ]);
  });
});
