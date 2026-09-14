## Why

The book (`applied-or-textbook-foundations`, M7) reads out of order: chapter 3 derives its base-stock level
"as a newsvendor problem" from chapter 4, the deterministic economic order quantity comes after two
stochastic chapters, and chapter 2 is the hardest chapter in the book and runs a policy the reader cannot
yet understand. Around the book, lessons still live in three tiers of page (chapters, three thin failure-mode
pages, two half-chapter classic pages), so three of the five workbench starters lead a reader out of the book,
and the docs index mixes the tiers. Inside the chapters, checks are cited two or three times for the same
claim, "In the simulator" too often reports that a test exists instead of asking the reader to run something,
no exercise involves the simulator, and a handful of statements are wrong or opaque (the fill-rate sentence,
a mismatched heading, working that is asserted rather than shown).

This change puts the chapters in the standard order, adds the deterministic half of queueing as a short early
chapter, folds two more failure modes into chapters, reduces the documentation to one tier of lessons, and
makes a full prose pass so the book reads as a textbook rather than a set of checked notes.

## What Changes

- **Part I gains a chapter and Part II is reordered.** Slugs do not change; numbers and links do.
  - Part I, Foundations: 1 Modelling operations; **2 Flows, rates and Little's law (new)**; 3 Randomness and
    simulation.
  - Part II, Inventory: 4 Order quantities: EOQ and (s, S); 5 One period under uncertainty: the newsvendor;
    6 Reviews, lead times and base-stock; 7 Safety stock and service levels; 8 Forecasting.
  - The order is deterministic before random, and one period before many, so no chapter depends on a later
    one. Every cross-reference and transition is rewritten to the new order. The roadmap's chapter numbers
    follow.
- **Chapter 2, Flows, rates and Little's law.** Throughput, the capacity bound as a flow argument, and
  stock = flow × time. It re-derives chapter 1's capacity bound and has the `relay` starter's **dead stock**
  as its case study: stock at a station nothing consumes is time, not supply. Birth–death queues stay in
  Part V.
- **Randomness moves to chapter 3 and uses the two-station line.** Its simulator section compares the two
  policies the reader already knows from chapter 1, the obvious rule and balancing, over many seeds, to show
  standard errors and paired comparison. Its protection-interval preview and the base-stock policy it
  borrowed from chapter 6 are removed.
- **Storm shock becomes chapter 7's case study**, as safety stock applied to a line, and the failure-modes
  page for it redirects there. **Ping-pong** stays a failure-mode page until Part III, and the docs index
  says so.
- **One tier of lessons.** The Failure modes section keeps only ping-pong. The serial-chain and fixed-route
  pages become template reference pages under Reference; their links and the library's About this problem
  action are unchanged. The docs index leads with the book and its case studies.
- **Checks cited once per claim.** The claims lint requires a check to follow a displayed formula before the
  next heading or formula, not as the very next element, so a cell that verifies a formula and its worked
  numbers is cited once, after the numbers. Repeated citations are removed.
- **Something to run in every chapter.** Every "In the simulator" section asks the reader to run at least two
  policies or parameter settings and states what they will see, checked by a test. Every chapter gains one
  exercise that changes a policy or parameter and runs it, with a checked answer.
- **Prose pass over every chapter.** Working is shown, not asserted (chapter 1's trip times and steady-cycle
  equations); Holt's method gets its equations or is cut to a mention; the fill-rate statement and the meaning
  of "cycle" in chapter 7 are corrected; the mismatched heading in chapter 1 is fixed; chapter 8's reference
  policy is walked through; agreement and contraction slips are fixed; text duplicated between chapters is
  removed.
- **Entry fixes.** Getting started says "day" as the book does, with sol explained once. The library page no
  longer calls the newsvendor chapter a classic problem. The game's name leaves the main text of the template
  pages.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `textbook`: the chapter list and order (a new chapter 2, Part II reordered), case studies for dead stock
  and storm shock, a runnable comparison in every chapter, and a simulator exercise in every chapter. This
  capability is introduced by `applied-or-textbook-foundations`, which must merge first.
- `checked-claims`: a displayed formula's check may follow its worked numbers rather than the formula
  itself, and a claim is cited once. Introduced by `applied-or-textbook-foundations`.
- `documentation`: the required sections change: failure-mode pages only for failure modes not yet in the
  book, classic template pages as reference pages, and the index leads into the book.
- `classic-problems-pack`: a template's page may be a template reference page or a Book chapter.

## Impact

- **Docs content** (`packages/docs/content`): a new `book/flows.mdx` with its Maxima notebook; every
  existing chapter edited; `failure-modes/dead-stock.mdx` and `disruption-recovery.mdx` become redirects;
  `classic/*.mdx` change section; `index.mdx`, `getting-started.mdx` and `library.mdx` edited.
- **Docs tooling** (`packages/docs/src`): `BOOK` renumbered with the new chapter; `MOVED_PAGES` gains the two
  failure-mode slugs; `claims-lint.ts` relaxed; `SECTIONS` loses Classic problems; the chapter-scenario
  check learns the new chapter's starter.
- **App**: starter `docs` fields for `relay` and `storm-shock` point at the chapters; `MOVED_ITEMS` aliases
  their fix example ids; the examples index is regenerated. No UI changes.
- **Tests**: new simulator tests for each chapter's comparison and simulator exercise; existing test titles
  cited by chapters are unchanged.
- **Roadmap**: chapter numbers in §8 and the M7 status.
- **Unchanged**: engine, golden hashes, the `ops` library, templates and their reference results, and chapter
  slugs, so saved links keep working.
