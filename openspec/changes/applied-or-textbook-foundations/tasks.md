## 1. Tools spike

- [x] 1.1 Install `aximar-mcp` from the `tools-v0.4.1` release locally. With `AXIMAR_MAXIMA_PATH` pointing at Maxima, confirm three things with scratch notebooks, and record the findings in design.md: a cell calling `error("…")` makes `aximar-mcp run` exit 1; `load(distrib)` passes the safety filter, or needs `--allow-dangerous`; and a `/* check: name */` comment survives a run. Verify by quoting each notebook's exit code.
- [x] 1.2 Confirm `uv run --script` runs a script with an inline `# /// script` block pinning sympy and scipy, and exits non-zero when a `check_*` function asserts false. Verify with a scratch script's exit codes.

## 2. Book structure

- [x] 2.1 Add `Book` to `SECTIONS`, and `part` and `chapter` to the frontmatter type. Add the `BOOK` constant with Parts I–V and chapters 1–7, marking planned parts. Verify unit tests for frontmatter parsing, and that the docs check rejects a chapter whose frontmatter disagrees with `BOOK`.
- [x] 2.2 Write the contents page `book.mdx` from `BOOK`. Group the docs navigation by part. Add previous and next chapter links to chapter pages. Verify an e2e test that opens the contents, sees Parts III–V marked as coming later, and follows next from chapter 3 to chapter 4.
- [x] 2.3 Add the chapter-standard lint to `docs:check`: fixed second-level headings in order, one `GameNote` before References. Add a `GameNote` component styled as a side note. Verify unit tests for a missing Exercises heading and a missing side note, each naming the chapter.

## 3. Checked claims

- [x] 3.1 Add the `Check` MDX component and build-time resolution of `maxima:`, `python:`, `example:` and `test:` references to their source, shown in a disclosure under the claim. Verify a unit test that resolves each kind from fixture files, and that a standalone page contains the check source in its HTML.
- [x] 3.2 Add the check-reference lint to `docs:check`: in Book pages, every display math node is followed by a `Check`, every exercise answer contains one, and every reference resolves. Verify unit tests for an unchecked equation (naming its line), a renamed notebook cell, and an unknown test title.
- [x] 3.3 Write the shared Maxima helpers `expect_equal` and `expect_close` as a notebook prelude cell template, and the Python `check_*` runner convention. Verify a fixture notebook with a deliberately wrong value fails with the check's name.
- [x] 3.4 Add `pnpm docs:claims` (`packages/docs/scripts/claims.ts`). It resolves references, runs each notebook with `aximar-mcp run` in a temporary copy, runs each Python script with `uv run --script`, and reports each failure with page and check. It exits naming a missing tool. Verify by running it against the fixtures, where one passes and one fails with the page named, and with `PATH` lacking `aximar-mcp`.
- [ ] 3.5 Add the blocking `docs-claims` CI job: install Maxima with apt, download the pinned `aximar-tools` Linux archive, check its recorded SHA-256, set up a pinned `uv`, and run `pnpm docs:claims`. Make `deploy` need it. Verify on a pull request that the job passes, and that a temporary commit with a wrong checksum fails before any check runs.

## 4. Moved pages, fixes and redirects

- [ ] 4.1 Add `MOVED_PAGES`. Emit redirect pages at old addresses in the prerender, carrying anchors, and leave them out of search. Make the link check fail on internal links to old slugs. Resolve old targets in the docs panel's `openDocs`. Verify an e2e test that opens `/docs/failure-modes/double-dispatch` and lands on the chapter 3 case study, a panel test for an old target, and a link-check unit test.
- [x] 4.2 Add the `fix` code-fence flag to runnable examples and the examples index. Pick starter fixes by the flag, and require exactly one per starter in the docs check. Add catalogue aliases from old fix ids to new items. Verify catalogue tests that every starter has its fix, and that an old fix id resolves, plus a docs check test for a starter with no marked fix.

## 5. Chapter 4 as the first full chapter

- [x] 5.1 Write chapter 4, the newsvendor, absorbing `classic/newsvendor`, with its checks notebook, exercises, side note, references and the `Scenario` action for `classic.newsvendor`. Move the page and add its redirect. Verify `docs:check`, `docs:claims` and the link check pass, and an e2e test opens the chapter's scenario in the workbench.
- [x] 5.2 Add the `Scenario` MDX component, which opens a starter with its baseline or a template with its reference policy through the workbench fragment, and require one per chapter in the docs check. Verify an e2e test from chapter 4 and a docs check test for a chapter without one.

## 6. Chapters 1, 2, 3 and 5

- [x] 6.1 Write chapter 1, Modelling operations, on `two-station`, with the half capacity case study moved in, the fix marked, and the starter's `docs` field updated. Verify `docs:check`, `docs:claims` and the link check pass, and the library's Why the baseline fails for `two-station` opens the case study.
- [x] 6.2 Write chapter 2, Randomness and simulation. Use `classic.reorder { random = true }` compared over many seeds. Check the Poisson mean and variance, the standard error's square-root law and a confidence interval in Maxima or Python. Verify `docs:check` and `docs:claims` pass.
- [ ] 6.3 Write chapter 3, Reviews, lead times and base-stock, on `classic.reorder`, absorbing the base-stock part of `classic/reorder` and the double dispatch case study. Update the `two-trains` `docs` field. Verify `docs:check`, `docs:claims` and the link check pass, and Why the baseline fails for `two-trains` opens the case study.
- [ ] 6.4 Write chapter 5, Order quantities: EOQ and (s, S), on `classic.reorder`, absorbing the rest of `classic/reorder`. Point the `reorder` construct's docs at the chapters, and redirect `classic/reorder`. Verify `docs:check`, `docs:claims` and the link check pass, and the template's About this problem link opens a Book chapter.

## 7. Safety stock

- [ ] 7.1 Add the `classic.safety_stock` construct, its Lua template and TS defaults. Reject lead-time spreads of a review period or more. Verify the defaults-description test, the random lead time scenario test and a rejection test with its message.
- [ ] 7.2 Add the reference policy and the analytic cycle service level as a mixture of Poisson CDFs, and choose the order-up-to level for `target_service`. Verify the analytic value in the chapter's Maxima notebook, and a `lua-runtime` test that the simulated share of cycles without backorders over 400 seeds contains the analytic value in its 99% confidence interval.
- [ ] 7.3 Write chapter 6, Safety stock and service levels, on `classic.safety_stock`, covering cycle service level against fill rate and variable lead times. Verify `docs:check`, `docs:claims` and the link check pass, and the library lists the template under Classic problems with its reference policy.

## 8. Forecasting

- [ ] 8.1 Add the `classic.forecasting` construct and template: level, trend, optional seasonal profile, optional Poisson noise. Verify the defaults-description test, and that the trend scenario's per-period demand starts at the level and rises by the trend.
- [ ] 8.2 Add the plain Lua reference policy with simple exponential smoothing kept in `ctx.memory`, recording its forecasts. Verify a `lua-runtime` test that after warm-up each forecast trails its period's demand by trend/α and the latest demand by trend·(1 − α)/α within one unit, with the lag also checked in the chapter's notebook.
- [ ] 8.3 Write chapter 7, Forecasting: moving averages, exponential smoothing, trend and seasonality, and forecast error, on `classic.forecasting`. Verify `docs:check`, `docs:claims` and the link check pass.

## 9. Integration

- [ ] 9.1 Update the docs home page, Getting started and the library guide to point at the Book. Update the roadmap's M7 status and §8 entries for the techniques now covered. Verify the link check passes.
- [ ] 9.2 Run the full check, `docs:check`, `docs:claims`, determinism tests and end-to-end tests locally, and in CI on a pull request. Verify every blocking job passes and golden hashes are unchanged.
