## Context

- **Documentation pages.** Pages are MDX files under `packages/docs/content`. Each slug comes from its path, and
  frontmatter gives a `section` from a fixed `SECTIONS` list and an `order`.
  - The docs check verifies reference completeness and frontmatter, and runs every `lua runnable` block,
    comparing it with a following `text output` block.
  - The link check crawls the built site.
  - Runnable examples are indexed into `generated/examples.json`. The library lists starter fixes from it, and
    fix ids are `example:policy:docs/<slug>#<n>`.
- **Starters.** Each starter's `docs` field names its failure-mode page. The catalogue picks the fix as the
  first policy example on that page that runs on the starter.
- **Classic templates.** Each template's construct names its docs page. Its reference results are tested in
  `lua-runtime/src/classic.test.ts`.
- **Tools.** Maxima 5.48 runs locally. `aximar-mcp run <notebook> [-o out]` (cmsd2/aximar `tools-v0.4.1`)
  runs every code cell of a `.macnb` notebook in one Maxima session and exits 1 on the first cell that errors.
  `uv` can run Python scripts that declare pinned dependencies inline.

See proposal.md for why. The requirements are in `specs/textbook`, `specs/checked-claims`, and the
`documentation` and `classic-problems-pack` deltas.

## Goals / Non-Goals

**Goals:**
- A book structure that Parts III to V can extend without moving pages again.
- Checks that are cheap to write, readable by the reader, and impossible to leave out of a displayed formula.
- Old addresses and saved library items keep working after pages move.

**Non-Goals:**
- Automatic detection of numbers stated in running prose. Display maths and exercise answers are enforced,
  and inline numeric claims rely on review.
- Rewriting the reference sections, the remaining failure-mode pages, or the serial chain and fixed-route
  pages.
- New `ops` blocks. Reference policies for the new templates are plain Lua where `ops` lacks a construct.
- Interactive widgets in chapters.

## Decisions

### 1. Chapters at stable, unnumbered slugs

- **Addresses.** Chapters live at `content/book/<slug>.mdx`, and the contents page at `content/book/index.mdx`.
  The slugs are `modelling`, `randomness`, `base-stock`, `newsvendor`, `order-quantities`, `safety-stock` and
  `forecasting`.
- **Numbering.** Frontmatter gives `section: Book`, `part` and `chapter`. A `BOOK` constant in `docs/src` lists
  the parts and chapters in order, including planned ones with no slug. It drives the contents page, the
  previous and next links, and the navigation.
- **Checks.** The docs check fails when frontmatter disagrees with `BOOK`.

*Alternative:* numbered slugs such as `book/04-newsvendor`. Rejected, because inserting a chapter would rename
pages and add redirects.

### 2. The chapter standard as fixed headings

- **Headings.** A chapter's second-level headings must be, in order: `What you will learn`, `The problem`,
  `The model`, `In the simulator`, an optional `Case study: …`, `Where the simulator differs`, `Exercises`
  and `References`. Subsections sit below them.
- **Side note.** It is a `<GameNote>` component, required once and placed before `References`.
- **Enforcement.** The docs check reads the MDX tree and names the chapter and the missing or misplaced
  heading.

*Alternative:* a chapter layout component with slots. Rejected, because MDX headings keep anchors, search
entries and the table of contents working as they do now.

### 3. Checks beside the page, referenced by name

- **Files.** A chapter's checks are `book/<slug>.checks.macnb` and, when numerics need it,
  `book/<slug>.checks.py`.
- **Maxima cells.** Each check cell starts with a comment naming it, such as `/* check: critical-ratio */`.
  Comments survive every notebook tool, whereas cell metadata may not.
- **Python checks.** A script declares its dependencies in an inline `# /// script` block with exact versions,
  defines one `check_<name>()` function per check, and when run calls every `check_*` and exits non-zero if
  any raises.
- **Failing.** Checks fail by raising.
  - Each notebook's first cell defines `expect_equal(name, got, want)` and `expect_close(name, got, want, tol)`.
    These call `error()` with the check name on a mismatch, so `aximar-mcp run` exits 1.
  - Python uses `assert` with a message.
- **References in pages.** Pages refer to checks with `<Check ref="maxima:critical-ratio" />`,
  `<Check ref="python:fill-rate" />`, `<Check ref="example:2" />` (the page's second runnable example) or
  `<Check ref="test:classic newsvendor › reaches the analytic expected cost…" />`.
- **Enforcement.** In Book pages, every display `math` node must be followed by a `Check` before the next
  paragraph, and every exercise answer must contain one.

*Alternatives:* inline `maxima check` code fences. Rejected, because a notebook keeps one Maxima session for a
chapter's shared definitions, and runs and edits in Aximar as a normal notebook. Asserting with the MCP tools
from a custom runner was also rejected, since `aximar-mcp run` already gives a batch exit code.

### 4. Showing the working

- **Rendering.** `Check` renders a small "Check" disclosure under the claim. At build time the docs package
  reads the named cell's input, or the Python function's source, and inlines it with syntax highlighting. A
  `test:` reference shows the test's name and file, and `example:` links to the runnable example.
- **Static pages.** Nothing loads at view time, so standalone pages stay readable before scripts load.

### 5. A separate checks command and CI job

- **Command.** `pnpm docs:claims` (`packages/docs/scripts/claims.ts`) does the following:
  1. collects references from Book pages and checks that every one resolves;
  2. copies each notebook to a temporary directory and runs `aximar-mcp run` on it;
  3. runs each Python script with `uv run --script`.
- **Tool discovery.** It finds `aximar-mcp` from `AXIMAR_MCP` or `PATH`, and Maxima through `AXIMAR_MAXIMA_PATH`
  or `PATH`. When a tool is missing it exits saying what to install.
- **Test references.** Named `test:` references are resolved by searching test titles. The tests themselves run
  in `pnpm test`.
- **Relation to `docs:check`.** `docs:check` gains the chapter-standard and check-reference lint, which need no
  external tools. It still runs the Lua examples.
- **CI job `docs-claims`.** It blocks, and `deploy` needs it.
  1. `apt-get install maxima`.
  2. Download `aximar-tools-x86_64-unknown-linux-gnu.tar.gz` from the pinned tools release and verify its
     SHA-256 against a value recorded in the workflow.
  3. Set up `uv` with `astral-sh/setup-uv` at a pinned version.
  4. Run `pnpm docs:claims`.

*Alternative:* folding everything into `docs:check`. Rejected, because contributors editing unrelated docs
would then need Maxima installed.

### 6. Moved pages

- **The map.** A `MOVED_PAGES` map in `docs/src` records each old slug and its new slug and anchor:
  - `classic/newsvendor` → `book/newsvendor`;
  - `classic/reorder` → `book/base-stock`;
  - `failure-modes/half-capacity` → `book/modelling#case-study-half-capacity`;
  - `failure-modes/double-dispatch` → `book/base-stock#case-study-double-dispatch`.
- **Uses of the map:**
  - **Redirect pages.** The prerender emits a page at each old address with `<meta http-equiv="refresh">` and a
    canonical link. A script carries the anchor, and the pages are left out of search.
  - **Docs panel.** It resolves `openDocs` targets through the map, so old in-app links and saved lessons land
    on the right section.
  - **Link check.** It fails on internal links to an old slug, so content always links to the new page.
- **Starter pages.** Starters' `docs` fields name the new chapter and anchor. The docs example that is a
  starter's fix is marked `fix` in its code fence (`lua runnable scenario=two-station fix`). The catalogue picks
  the marked example on the starter's page instead of the first match, and the docs check requires exactly one
  fix per starter.
- **Example ids.** Fix examples on moved pages get new ids. The catalogue keeps an alias from each old fix id to
  its new item, so Mine copies whose `origin` names an old id still say what they were copied from.

### 7. The new templates

- **`classic.safety_stock`.**
  - **The scenario:** one station with Poisson demand and backorders, reviewed every `review_period`, and
    supplied with a `lead_time` that is a number or a discrete distribution.
  - **No crossing:** the template rejects lead-time spreads of a review period or more, so orders never cross
    and the analysis is exact.
  - **Reference result:** the cycle service level of an order-up-to level S, the mixture over lead times ℓ of
    the Poisson CDF of S at mean λ(R + ℓ). The reference policy orders up to the smallest S whose cycle
    service level reaches `target_service`.
  - **Test:** it reads the station's stock trace just before each delivery over 400 seeds and compares the share
    without backorders with the analytic value.
- **`classic.forecasting`.**
  - **The scenario:** demand per period of `level + trend·t`, times an optional seasonal profile, plus
    optional Poisson noise, built with the existing `per_period` and `profile` constructs.
  - **Reference policy:** plain Lua. It keeps a simple exponential smoothing forecast in `ctx.memory`, orders up
    to forecast × (lead time + review period) plus a safety allowance, and records the forecast.
  - **Reference result:** the smoothing lag under a pure trend.
  - **Test:** a deterministic run checks the recorded forecasts after warm-up against the trend divided by α and
    the trend times (1 − α)/α. The smoothing lag is already verified in Maxima.
- **Existing constructs.** Both templates compile to existing scenario constructs, so the engine and golden
  hashes are unchanged.

### 8. Chapter scenarios open from the page

A `<Scenario template="classic.safety_stock" />` or `<Scenario starter="two-station" />` component renders an
"Open in workbench" action. It fills the Scenario slot and the reference policy, or the baseline for a
starter, through the existing `#example`-style fragment handling, extended to name a catalogue item. The docs
check requires one per chapter and verifies that the named item exists.

## Risks / Trade-offs

- **[Maxima output or error detection differs between versions]** → The CI Maxima comes from Ubuntu's apt
  package and local installs may differ. Checks compare exact rationals or use `expect_close` with explicit
  tolerances, never printed text.
- **[`aximar-mcp` safety filter blocks `load`]** → Verify first. If it blocks, the runner passes
  `--allow-dangerous`, since the notebooks are repository content reviewed like code.
- **[The tools release is rebuilt or removed]** → The workflow pins a URL and checksum. The fallback is building
  `aximar-mcp` from the tagged source with `cargo install --git … --tag tools-v0.4.1`.
- **[Checks that print but don't assert]** → The helpers make asserting the easy path. Review rejects cells
  without an `expect_` call, and the claims command warns about check cells that call none.
- **[Chapters grow long and drift from the chapter standard]** → The heading lint keeps the shape, and a page
  over about 3,500 words is split into sections below the fixed headings, not into more chapters.
- **[Plagiarism by paraphrase]** → Worked examples and exercises use the simulator's own scenarios and numbers,
  and results are cited with page numbers.
- **[Redirect pages and meta refresh are weak for search engines]** → Acceptable for a small static site. The
  canonical link points at the new page.

## Migration Plan

1. Land the check tooling, the lint and the CI job, with one chapter as the example (chapter 4, which absorbs
   the newsvendor page).
2. Add chapters 1 to 3 and 5, move the reorder, half capacity and double dispatch pages, and add redirects,
   aliases and fix markers.
3. Add `classic.safety_stock` and chapter 6, then `classic.forecasting` and chapter 7.
4. Update the index page, Getting started links and the roadmap's M7 status.

**Rollback:** redeploy the previous commit. Library items keep working either way, because old fix ids still
resolve in older releases and aliases resolve them in newer ones.

## Open Questions

- The exact wording of chapter titles and the order of subsections below the fixed headings can be tuned
  while writing, without changing specs.
