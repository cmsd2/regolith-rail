## Why

The documentation is organised by kind of page: failure modes, classic problems, `ops` reference. It teaches in
fragments, and a new reader has no path from "what is a policy" to safety stock or forecasting. The roadmap
(§8, M7) promises an encyclopedia of operations research techniques that the simulator makes visible, but most
of it is unwritten. Nothing checks the mathematics the pages state, so a wrong formula or number would go
unnoticed.

This change starts a textbook: an applied introduction to operations research, told through the rail line and
the classic problems, where every chapter has a scenario to run and every stated result is checked by a
computer algebra system, Python or the simulator. It covers Parts I and II. Parts III to V are planned as later
changes.

## What Changes

- **A book section.** A new Book section with a contents page and numbered chapters grouped into parts, and
  previous and next links between chapters. This change writes:
  - Part I, Foundations: 1 Modelling operations; 2 Randomness and simulation.
  - Part II, Inventory: 3 Reviews, lead times and base-stock; 4 One period under uncertainty: the
    newsvendor; 5 Order quantities: EOQ and (s, S); 6 Safety stock and service levels; 7 Forecasting.
  - The contents page lists Parts III (Networks), IV (Optimisation) and V (Dynamics) as coming later.
- **A chapter standard.** Each chapter follows the same shape:
  - what the reader will be able to do;
  - the problem in plain operations research language;
  - the model and its analysis;
  - the scenario to run, with a runnable example;
  - where the simulator differs from the model;
  - a case study where a failure mode belongs;
  - exercises with checked answers;
  - a side note linking it to the rail game;
  - references in Harvard style.

  Prose is original and does not follow any one reference book.
- **Checked claims.**
  - **Mathematics:** every displayed formula and every numeric result in a chapter refers to a check. A check is
    a cell in a Maxima notebook (`.macnb`) run by `aximar-mcp run`, or a Python script run through `uv` with
    pinned dependencies.
  - **Simulator behaviour:** claims are checked by runnable examples with stated output, or by unit tests
    against the chapter's scenario.
  - **Enforcement:** a new documentation step runs every check. It fails, naming the page and check, when a
    check errors, a reference points at a missing check, or a book page shows mathematics with no check.
  - **Showing the working:** readers can open the checking code beside each result.
- **A scenario per chapter.**
  - **Existing scenarios:** chapters 1 to 5 use `two-station`, `classic.reorder` and `classic.newsvendor`.
  - **Two new classic templates:**
    - `classic.safety_stock`: random demand and random lead times, with a target service level.
    - `classic.forecasting`: demand with trend and seasonality.
  - **Reference policies and results:** each new template ships both, and its analytic results are tested
    against the engine over many seeds.
- **Pages move into chapters.**
  - **Classic problem pages:** the newsvendor and reorder pages become chapters 4 and 3 to 5.
  - **Failure-mode pages:** half capacity becomes chapter 1's case study, and double dispatch becomes chapter 3's.
  - **Old addresses:** they redirect to the new pages, and starter scenarios and templates link to the chapters.
  - **Staying for now:** the other failure-mode pages, and the serial chain and fixed-route pages, stay until
    their parts are written.
- **CI.** A blocking docs job installs Maxima and a pinned `aximar-mcp` release, and runs the checks with `uv`.

## Capabilities

### New Capabilities
- `textbook`: the Book section's structure, the chapter standard, a scenario per chapter, exercises, game side
  notes, citations, and the chapters of Parts I and II.
- `checked-claims`: how mathematical and simulator claims in documentation are tied to checks, and how
  those checks run locally and in CI.

### Modified Capabilities
- `documentation`: the required sections gain the Book, and failure-mode and classic problem pages may live
  inside chapters. Link integrity covers redirects from moved pages.
- `classic-problems-pack`: two new templates, `safety_stock` and `forecasting`, with reference policies and
  analytic reference results. A template's page may be a book chapter.

## Impact

- **Docs content** (`packages/docs/content`):
  - New `book/` pages and check notebooks and scripts.
  - The classic newsvendor and reorder pages and two failure-mode pages move into chapters.
- **Docs tooling** (`packages/docs`):
  - The section model gains Book, with parts and chapter numbers.
  - A check-reference MDX component, a checks runner script, redirect generation for moved slugs, and search
    index entries.
- **App:** the docs navigation groups book chapters by part. The starter scenario `docs` fields and the
  catalogue's lesson and fix lookup follow the moved pages. Documentation example ids for moved pages change,
  so the committed examples index is regenerated.
- **Scenario kit and runtime:** the `safety_stock` and `forecasting` constructs, templates, reference policies
  and tests.
- **CI and tools:** a blocking `docs-checks` job with Maxima from apt, `aximar-mcp` from a pinned
  cmsd2/aximar tools release verified by checksum, and `uv`. Contributors need Maxima and `aximar-mcp`
  installed to run the checks locally.
- **Unchanged:** golden result hashes. No engine behaviour changes.
