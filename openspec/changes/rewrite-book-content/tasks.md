## 1. Groundwork

- [x] 1.1 Write `packages/docs/content/book/STYLE.md` from design decision 7, with the rewrite table extended by one example from each current chapter. Verify by reading it against the user's style rules and listing any rule it omits.
- [x] 1.2 Write `packages/docs/content/book/LEDGER.md` from the current chapters: per chapter, the terms, results, notation and `ops` blocks introduced and used. Mark each use that comes before its introduction. Verify the marked list includes chapter 1's and chapter 2's replication counts.
- [x] 1.3 Add the prose lint to `docs:check`: em dashes, tailing negations and the banned words, outside code and maths, with a per-line exemption comment. Verify unit tests for each rule and the exemption, and run it on the current book to record the baseline count per chapter. Baseline, 2026-09-22: modelling 4, flows 2, randomness 0, order-quantities 3, newsvendor 1, base-stock 2, safety-stock 1, forecasting 7. Chapters awaiting their rewrite are listed in `PROSE_PENDING` and counted without failing the check.
- [x] 1.4 Add grouped checks: `Check` accepts `refs` with several references, and the claims lint accepts a derivation's formulas when a grouped check after them cites each one. Verify unit tests for a passing derivation and for one formula left out of the group.
- [x] 1.5 Add the `Placeholder` component and the `PLACEHOLDERS` registry with the entries from the design's register, and make the docs check fail on unknown ids and print open placeholders. Verify unit tests for an unknown id and for the listing.
- [x] 1.6 Add the `Predicted` component, which sets apart a table of predicted and simulated values, and a lint requiring a check inside it. Verify unit tests for a table with and without a check, and an end-to-end test on chapter 1's rendered table (added with task 2.1, the first chapter to use it).
- [x] 1.7 Write the notation appendix at `book/notation` and list it on the contents page after the parts. Add the prerequisites paragraph to `book.mdx`. Verify `docs:check` and the link check pass.

## 2. Part I

For each chapter, follow the pipeline in design decision 1. Each chapter is one pull request, reviewed before the next starts.

- [x] 2.1 Chapter 1, Modelling operations. Source notes from Eiselt and Sandblom ch. 1, Taha ch. 1 and Hernández-Lerma et al. Example 1.1. Outline, notebook, a `two-station` variant with variability off, both policies, the sensitivity formula for the required gap, and the half capacity case study. Verify `docs:check`, `docs:claims`, the link check and the prose lint pass, the `two-station` fix still resolves, and the ledger shows no use before introduction.
- [x] 2.2 Chapter 2, Flows, rates and Little's law. Source notes from Little (1961), Eiselt and Sandblom ch. 15 and Brémaud. The sample-path derivation, utilisation and the bottleneck bound, `two-station` at two speeds and `relay` under two policies, and the dead stock case study. Verify as in 2.1, and that every simulator claim cites a single-seed or seed-independent test.
- [ ] 2.3 Chapter 3, Randomness and simulation. Source notes from Taha ch. 19 and Brémaud's Monte Carlo chapter. A probability estimate with a known answer, the half-width against replications, and a paired batch against two single-policy batches on different base seeds. Add the `mars-poisson-consumer` placeholder unless a core-format script is used. Verify as in 2.1.
- [ ] 2.4 Read Part I through in order against the style guide and ledger, and fix what the read finds. Verify the prose lint count for Part I is zero without exemptions left unreviewed.

## 3. Part II

- [ ] 3.1 Chapter 4, Order quantities. Source notes from Snyder and Shen §3.2, Axsäter §4.1, Taha §13.3, Eiselt and Sandblom §§12.2–12.3 and Simchi-Levi et al. §§9.4–9.5. The Shop at $Q$ = 10, 20 and 40, deterministic then Poisson, and the `mars-dispatch-interval` placeholder. Verify as in 2.1, and a test that the deterministic costs are 25, 20 and 25 a day.
- [ ] 3.2 Chapter 5, the newsvendor. Source notes from Snyder and Shen §§4.3.1–4.3.2 and Axsäter's newsboy section. The discrete case, the continuous optimum, the normal loss function and optimal cost, salvage, and a discretised normal demand script. Verify as in 2.1, and a test that ordering $S^*$ against $\mu$ saves the predicted amount within its interval.
- [ ] 3.3 Chapter 6, base-stock. Source notes from Snyder and Shen §4.3.4 and Theorem 4.8, and Axsäter on inventory position. The Shop with Poisson demand and a lead time, position against on-hand ordering, $S^*$ against $S^* \pm 5$, and the double dispatch case study. Verify as in 2.1, and the `two-trains` fix still resolves.
- [ ] 3.4 Chapter 7, safety stock. Source notes from Snyder and Shen on service levels, Axsäter on $S_1$ to $S_3$ and Eiselt and Sandblom §12.7. Fixed against variable lead time, three targets, the fill rate by the loss function, the `service-level-metrics` placeholder, and the storm shock case study. Verify as in 2.1, and the `storm-shock` fix still resolves.
- [ ] 3.5 Chapter 8, forecasting. Source notes from Snyder and Shen ch. 2 and Axsäter ch. 2. Moving average against smoothing, the smoothing lag under trend and Holt's method, and a forecast-driven order-up-to level. Verify as in 2.1.
- [ ] 3.6 Read Part II through in order, checking that the Shop changes one thing per chapter and that the notation page matches every symbol used. Verify the prose lint count for Part II is zero without exemptions left unreviewed.

## 4. Whole book

- [ ] 4.1 Read the book from the contents page to chapter 8 in one sitting. Record, per chapter, any step in difficulty that is too large, and fix it. Verify by listing each fix in the pull request.
- [ ] 4.2 Check exercises climb within each chapter: a computation, a derivation or variant, a simulator change, and one that uses an earlier chapter. Verify with a table of exercises by kind in the pull request.
- [ ] 4.3 Run `pnpm check`, `pnpm docs:check`, `pnpm docs:claims`, `pnpm build` with `pnpm docs:links`, and `pnpm test:e2e`. Verify all pass.
