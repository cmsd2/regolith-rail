## 1. Structure and tooling

- [x] 1.1 After `applied-or-textbook-foundations` is archived, rebase this branch on `master`. Verify `pnpm check` and `pnpm docs:check` pass before any change.
- [x] 1.2 Renumber `BOOK`: Part I `modelling`, `flows` (planned, no slug yet), `randomness`; Part II `order-quantities`, `newsvendor`, `base-stock`, `safety-stock`, `forecasting`. Update each chapter's `chapter` frontmatter. Verify the docs check passes and the contents page lists the new order with chapter 2 marked as coming.
- [x] 1.3 Rewrite every "chapter N" reference in `packages/docs/content`, `tests/e2e` and `docs/roadmap.md` to the new numbers, and fix the transitions that now point the wrong way (chapter 6's "Chapter 4 orders once", chapter 5's game note, chapter 4's opening). Verify by searching for `[Cc]hapter [0-9]` and reading each hit against `BOOK`, and by the e2e test that follows previous and next links.
- [x] 1.4 Relax the claims lint: a `Check` must follow display maths before the next heading or display-maths node; outside `Answer`, a ref may be cited once per page. Verify unit tests for a check after worked numbers (passes), a formula with no check before the next heading (fails, naming the line), and a repeated ref (fails, naming the ref).
- [x] 1.5 Remove the duplicate citations from every chapter, moving each formula's check after its worked numbers. Verify `docs:check` passes and each chapter's Check count fell.
- [x] 1.6 Remove "Classic problems" from `SECTIONS`; give `classic/serial-chain.mdx` and `classic/fixed-route-delivery.mdx` `section: Reference`, orders after Scenario format, and "(template)" in their titles; move the sentence naming the game into a `GameNote`. Verify the sidebar shows them under Reference, the library's About this problem action still opens them, and searching the two pages' main text for the game's name finds nothing.

## 2. Chapter 2: flows, rates and Little's law

- [x] 2.1 Write `book/flows.checks.macnb`: flow balance from the conservation equation, the capacity bound as trips a day times load, Little's law with the station cover (30 units at 36 a day is 20 hours) and the line's mine-to-dome time. Verify `pnpm docs:claims` runs it and passes, and a deliberately wrong value fails naming the cell.
- [x] 2.2 Write tests on `relay` over 20 seeds: the junction's mean stock share under `balance-stock` is at least a quarter of the line's; the roles fix (`pass_through` alone, or with `lookahead` if the test shows it is needed) leaves less unmet demand than the baseline. Record which fix the test needed in design.md's open question. Verify the tests pass.
- [x] 2.3 Write `book/flows.mdx` to the chapter standard: what you will learn, the problem, the model, the `relay` scenario with the baseline and the fix run in Batch, the dead stock case study, where the simulator differs, exercises (one on paper, one in the simulator), game note, references. Give it a slug in `BOOK`. Verify `docs:check`, `docs:claims` and the link check pass.
- [x] 2.4 Move dead stock: delete `failure-modes/dead-stock.mdx`, add it to `MOVED_PAGES` with the case-study anchor, point the `relay` starter's `docs` at it, alias its fix id in `MOVED_ITEMS`, mark the chapter's fix example `fix`, and regenerate the examples index. Verify the catalogue test for starter fixes, the e2e test that opens the old address, and that Why the baseline fails on `relay` opens the case study.

## 3. Chapter 3 on the two-station line

- [x] 3.1 Write a test on `two-station` over seeds 1 to 100 comparing the obvious rule with `balance-stock`: the paired difference in weighted unmet demand has a 95% interval excluding zero, and its sample standard deviation is below that of the independent difference. Verify it passes.
- [x] 3.2 Rewrite chapter 3's simulator section around that comparison, remove the protection-interval preview and the borrowed base-stock policy, and move the level 13 versus 15 comparison and its test citation to chapter 6's simulator section. Verify `docs:check` passes and chapter 3 cites no term from Part II.

## 4. Storm shock into chapter 7

- [x] 4.1 Write tests on `storm-shock` over seeds 1 to 50: the `min_max` fix leaves less unmet demand than the baseline, and holds stock at the dome when the storm begins. Add Maxima cells for the round trip as a protection interval and the buffer's cover in hours. Verify the tests and `docs:claims` pass.
- [x] 4.2 Write the "Case study: storm shock" section in `book/safety-stock.mdx`, reading the storm as a demand shock over the round trip and sizing the buffer with the chapter's method, with the fix example marked `fix`. Verify the chapter-standard lint passes and the section's numbers cite the new checks.
- [x] 4.3 Move disruption recovery: delete `failure-modes/disruption-recovery.mdx`, add it to `MOVED_PAGES`, point the `storm-shock` starter at the case study, alias its fix id, regenerate the examples index, and prefix `failure-modes/ping-pong.mdx` with a line saying Part III tells it in full. Verify the catalogue and moved-page tests, and that Why the baseline fails on `storm-shock` opens chapter 7.

## 5. Something to run in every chapter

- [x] 5.1 Chapter 4: add a Batch comparison of 10, 20 and 40 a time, citing the existing test. Chapter 5: add a Batch comparison of 10, 15 and 20, with a test over 100 seeds that the three mean costs are ordered 15 < 20 < 10. Verify the tests pass and `docs:check` passes.
- [x] 5.2 Chapter 7: add the comparison of level 113 with a fixed 2-day lead time at 106, with a test over 200 seeds that both meet 0.95 in their settings and 106 fails it with the variable lead time. Verify the test passes.
- [x] 5.3 Add a simulator exercise to each of chapters 1 to 8 (design decision 7's candidates, confirmed or replaced as each test is written), each answered with a `test:` check. Verify each test passes, and the docs check finds every answer's check.
- [x] 5.4 Extend the chapter-standard lint: a chapter's exercises must include at least one answer citing a `test:` or `example:` check. Verify a unit test for a chapter with only Maxima answers, naming the chapter.

## 6. Prose pass

- [ ] 6.1 Chapter 1: show the round-trip and trips-a-day working, display the two steady-cycle equations before their solution, fix the "Stops take longer with more cargo" bullet. Verify `docs:claims` passes with no check value changed.
- [ ] 6.2 Chapters 4 and 5 (EOQ, newsvendor): read in the new order, fix the contraction, and make each chapter's opening follow the one before it. Verify by reading each chapter once in full.
- [ ] 6.3 Chapter 6 (base stock): remove the text and script duplicated from chapter 3, fix "their inventory position", wrap the over-long source line. Verify `pnpm lint` and `docs:check` pass.
- [ ] 6.4 Chapter 7 (safety stock): correct the fill-rate sentence to one minus the shortfall over the period's demand, and replace "cycle" by "review period" where that is meant. Verify the fill-rate check still passes and the text agrees with the formula.
- [ ] 6.5 Chapter 8 (forecasting): give Holt's method its two update equations with a Maxima cell, fix "simple smoothing's settles", and add a three-sentence walkthrough of the reference policy before its code. Verify `docs:claims` passes.
- [ ] 6.6 Read all eight chapters in order once more and fix any transition or reference the earlier tasks left. Verify the contents page, every previous and next link, and the link check.

## 7. Entry pages and roadmap

- [ ] 7.1 Rewrite `index.mdx`: lead with Getting started and the Book, list the four case studies by chapter under "Lessons from the starter lines", and say ping-pong waits for Part III. Verify the link check and an e2e test that the index links to each case study.
- [ ] 7.2 Change `getting-started.mdx` to days, explaining sol once, and fix `library.mdx`'s "classic problem" link to describe a template. Verify by reading both pages and the link check.
- [ ] 7.3 Update `docs/roadmap.md`: chapter numbers in §8, the M7 status with eight chapters and one tier of lessons, and the Little's law entry marked as chapter 2. Verify by searching the roadmap for "book chapter".
- [ ] 7.4 Run the full gate: `pnpm check`, `docs:check`, `docs:claims`, build, `docs:links`, `test:determinism` and `test:e2e`. Verify all pass and golden hashes are unchanged.
