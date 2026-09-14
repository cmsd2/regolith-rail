## Context

- **Builds on `applied-or-textbook-foundations`.** That change (PR #11) introduces the Book, the chapter
  standard, the claims lint and the moved-page machinery this change relies on. It must merge and be archived
  first; the `textbook` and `checked-claims` deltas here modify requirements it adds.
- **Chapters have stable slugs.** `BOOK` in `packages/docs/src/book.ts` gives each chapter its part and
  number, and the docs check requires page frontmatter to agree. Renumbering is a change to `BOOK` and
  frontmatter; addresses stay.
- **The claims lint** (`packages/docs/src/claims-lint.ts`) requires the node after a display-maths node to be
  a `Check`, which is what produces the duplicate citations.
- **Moved pages** are recorded in `MOVED_PAGES` (redirect page, panel resolution, link-check failure on old
  slugs) and moved fix examples in the catalogue's `MOVED_ITEMS`.
- **Starters** name their lesson page in a `docs` field; the marked `fix` example on that page is the
  suggested fix. `relay` and `storm-shock` currently name `failure-modes/dead-stock` and
  `failure-modes/disruption-recovery`.
- **Sections** come from the fixed `SECTIONS` list; the sidebar shows them in that order.

See proposal.md for why, and the four spec deltas for the requirements.

## Goals / Non-Goals

**Goals:**
- Every chapter readable in order with nothing borrowed from later.
- One tier of lessons: a reader who starts at the index never meets a page in a different register.
- Chapters that read as a textbook: working shown, one check per claim, something to run and something to
  try in every chapter.

**Non-Goals:**
- New `ops` blocks, templates or engine behaviour. Chapter 2's fix and the simulator exercises use what
  exists.
- Parts III to V, and the queueing chapter. Chapter 2 takes only the deterministic part of that topic.
- Re-examining the mathematics already checked. The prose pass changes how results are explained, not what
  they are; a check whose value changes is a bug in the text, not a target of this change.
- Changes to the Check component's rendering.

## Decisions

### 1. Renumber through `BOOK`; slugs stay

- `BOOK` becomes: Part I `modelling`, `flows`, `randomness`; Part II `order-quantities`, `newsvendor`,
  `base-stock`, `safety-stock`, `forecasting`. Frontmatter `chapter` values follow.
- Everything that refers to a chapter by number is found by searching for "chapter N" and "Chapter N" in
  `packages/docs/content`, `docs/roadmap.md` and `tests/e2e`, and rewritten by hand. The docs check cannot
  verify prose numbers, so the task list names every file.
- The archived spec of the earlier change lists chapters 1 to 7; this change's `textbook` delta replaces that
  requirement in full.

*Alternative:* leave numbers and reorder only the contents page. Rejected: the spec's chapter numbers are what
readers and the roadmap cite, and the point is that "chapter 3" should be readable after chapters 1 and 2.

### 2. Chapter 2: the deterministic half of queueing

- **Slug and title.** `book/flows.mdx`, "Flows, rates and Little's law".
- **Content.** Rates in and out of a station; flow balance over a period as the conservation equation of
  chapter 1 divided by time; the capacity of a vehicle as an upper bound on flow (chapter 1's 77.1 units a day,
  re-derived as trips a day times load); Little's law, stock = throughput × time in the system, applied to a
  station (30 units at 36 a day is 20 hours of cover) and to the whole line (stock on the line and on the
  train against the mine's output gives the average time a unit takes from mine to dome). Everything is
  algebra, checked in `book/flows.checks.macnb`. Sources: Little's law as in Hopp and Spearman or Anupindi et
  al., cited Harvard style; the roadmap's references gain the source used.
- **Case study: dead stock.** The `relay` starter. Under balancing about a third of the line's stock sits at
  the junction; nothing flows out of the junction to a consumer, so by Little's law its residence time is
  unbounded: that stock is time lost, not supply. The fix is the roles policy from the old page. If the test
  shows `pass_through` alone does not clear the junction on the starter, the fix keeps `ops.lookahead` and the
  text introduces it in one sentence as "keep cargo for the station that needs it", leaving its reservation
  mechanism to chapter 6's double dispatch. Tests: the junction's mean stock share under balancing over 20
  seeds; the fix's unmet demand against the baseline's.
- **Why a whole chapter.** It smooths the difficulty curve (deterministic, deterministic, random), gives the
  bound argument of chapter 1 a name the later parts reuse (echelon stock, bullwhip, queues), and gives dead
  stock a home. Birth–death queues need Markov chains and stay in Part V.

*Alternative:* a Little's law section inside chapter 1. Rejected: chapter 1 is already the longest chapter,
and dead stock needs its own scenario section.

### 3. Chapter 3's comparison is chapter 1's two policies

- The simulator section opens `two-station`, runs the obvious rule and `balance-stock` in Batch over 100
  seeds, and reads off the standard error of each and the paired difference. The reader has seen both policies
  and the metric. The text shows that the paired spread is smaller than the independent one, which is the
  chapter's point.
- **Tests.** One test on `two-station` over seeds 1 to 100: the paired difference in weighted unmet demand has
  an interval that excludes zero, and its sample standard deviation is below that of the independent
  difference. The existing test comparing base-stock levels 13 and 15 moves to chapter 6's simulator section
  as its comparison.
- The "Demand over a protection interval" section leaves chapter 3. Chapter 6 introduces the protection
  interval itself, as it already does.

### 4. Storm shock as chapter 7's case study

- The case study reads the storm as a demand shock over a protection interval that is the train's round
  trip, sets the buffer with the chapter's method (the existing fix's `min_max { min = 20000, max = 30000 }`
  is a 20-unit safety stock at the demand end), and compares recovery with the baseline in Batch.
- **Tests.** Over seeds 1 to 50 on `storm-shock`, the fix's unmet demand against the baseline's, and that the
  fix leaves the dome with stock when the storm begins. The numbers stated in the text come from the test.
- Existing Maxima checks are enough for the model; the case study adds cells only for the round trip and the
  buffer's cover in hours.

### 5. Lint: a check before the next heading or formula, cited once

- `claims-lint.ts` walks each section; after a display-maths node it requires a `Check` to appear before the
  next heading or display-maths node, in the same parent or a following sibling. It also collects refs per
  page, ignoring those inside `Answer`, and fails on a ref seen twice.
- The chapter text moves each formula's citation to after its worked numbers and deletes the repeat. Where a
  formula and its numbers are verified by different cells, both stay: they are different refs.

*Alternative:* leave the lint and delete duplicates by hand. Rejected: the lint would put them back the next
time a formula is edited.

### 6. One tier of lessons

- `failure-modes/dead-stock` and `failure-modes/disruption-recovery` are removed and added to `MOVED_PAGES`
  with the case-study anchors; their fix example ids are added to `MOVED_ITEMS`; `relay` and `storm-shock`
  starters name the chapters. The Failure modes section keeps `ping-pong` with a first line saying it is told
  in full in Part III.
- `classic/serial-chain` and `classic/fixed-route-delivery` change frontmatter to `section: Reference` with
  orders after Scenario format, and their titles gain "(template)" so the sidebar reads as reference. "Classic
  problems" leaves `SECTIONS`. The template constructs' `docs` fields and the library's About this problem
  action point at the same slugs and need no change. The sentence naming the game moves into a `<GameNote>`
  on each page (the component works outside the Book).
- The index's "Why the baseline struggles" becomes "Lessons from the starter lines", listing the four case
  studies by chapter and ping-pong as waiting for Part III.

### 7. Something to run, something to try

- **Simulator sections.** The standard is: open the scenario; run the reference; change one thing and run
  again, or compare two in Batch; here is what you will see. Chapters 1, 3, 6 and 8 already do this. Chapter 4
  gains a Batch comparison of 10, 20 and 40 a time (its test exists). Chapter 5 asks for 10, 15 and 20 in
  Batch (its Maxima check exists; a test over 100 seeds confirms the ordering of the three means). Chapter 7
  compares level 113 with a fixed 2-day lead time at 106, checked by a test that both meet 0.95 over 200
  seeds and that 106 fails it with the variable lead time.
- **Simulator exercises.** One per chapter, each answered by a `test:` check. Candidates, to be confirmed by
  the tests as they are written:
  1. Two-station with 60-unit stations: does balancing keep up?
  2. Relay with the junction given the `any` role: how much stock sits there?
  3. Ten seeds instead of a hundred: does the interval still exclude zero?
  4. Order 30 a time on `classic.reorder`: cost against the model's 21.67.
  5. Newsvendor with salvage is not in the template; instead, lost-demand cost 10: the best order becomes 20.
  6. Base stock from stock on hand with a lead time of zero: does the stock-on-hand mistake still cost?
  7. Target 0.99 on `classic.safety_stock`: level 121 meets it over 200 seeds.
  8. `alpha = 0.5` on `classic.forecasting`: 9 units of safety stock suffice.
- Each is a named Vitest test in the package that owns the scenario, titled so the `test:` ref reads as a
  sentence, as the existing ones are.

### 8. The prose pass, bounded

The pass covers, and is limited to, the items in the proposal plus what a read-through in the new order turns
up as transitions. Each chapter is read once in full in its new position, and the changes are listed in the
commit message. A chapter's checks do not change unless the text was wrong; the fill-rate sentence in chapter
7 is corrected to "one minus the expected shortfall over the period's demand", and "cycle" is replaced by
"review period" where that is what is meant. Holt's method gets its two update equations and a Maxima cell,
since its check already exists. Chapter 8's reference policy gets a three-sentence walkthrough before the
code.

## Risks / Trade-offs

- **[Renumbering breaks a reference the search misses]** → Search covers content, roadmap, e2e tests and
  specs; the link check catches anchors; a final read of the contents page and each chapter's previous and
  next links is a task.
- **[Chapter 2 is thin or reads as padding]** → It has a model, a case study with a scenario, tests and
  exercises like every other chapter; if it cannot reach that standard it is a section of chapter 1 instead,
  and dead stock waits for Part III. Decided when the draft exists.
- **[`pass_through` alone does not fix dead stock]** → Covered in decision 2; the fix may keep lookahead.
- **[The lint's once-per-page rule blocks a legitimate second citation]** → Answers are exempt; elsewhere a
  second citation means the claim was stated twice, which the prose pass removes.
- **[New tests are slow]** → Each runs at most 200 seeds of a small scenario; they join the existing
  batch-style tests and use the same detail level.
- **[Prose pass drifts into a rewrite]** → Decision 8 bounds it; anything beyond it is a separate change.

## Migration Plan

1. Merge and archive `applied-or-textbook-foundations`; rebase this branch on `master`.
2. Tooling first: `BOOK`, `SECTIONS`, the lint, `MOVED_PAGES`, `MOVED_ITEMS`, starter `docs` fields, and the
   section changes to the template pages, with the existing chapters renumbered and their cross-references
   fixed so the site builds.
3. Chapter 2 and its case study and tests; chapter 3's new simulator section and test.
4. Storm shock into chapter 7; the index and Getting started.
5. Simulator sections and exercises, one chapter at a time.
6. The prose pass, one chapter at a time, in reading order.
7. Roadmap chapter numbers and M7 status.

**Rollback:** redeploy the previous commit; slugs are unchanged, so links and library items keep working.

## Open Questions

- Whether the relay fix needs lookahead (decision 2). Answered by the first test written for the case study.
- Whether the exercise candidates in decision 7 all hold as stated. Each is confirmed or replaced when its test
  is written; the standard (one simulator exercise per chapter, checked) does not change.
