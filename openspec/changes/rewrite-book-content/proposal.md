## Why

The book's eight chapters have the right order and headings, but the content does not teach well.

- **The examples narrate the simulator instead of teaching a model.** Most results are stated as what a batch
  showed ("over 20 replications the junction holds about 13 units, three tenths of the stock"). The reader
  sees simulator output before seeing the model that predicts it, and many sentences read like the tests
  they cite.
- **The maths is arithmetic more than textbook results.** Chapter 1 spends its displays on leg times and trip
  counts. Results that the field treats as central, such as the sample-path argument for Little's law, the
  EOQ sensitivity ratio, the normal loss function, the optimal newsvendor cost, and the variance and lag of
  exponential smoothing, are missing or asserted without derivation.
- **Each chapter uses one scenario and one set of default numbers.** Part II's chapters each open a different
  template with its defaults, so nothing carries from one chapter to the next. The reader cannot watch a
  single store gain a lead time, then random demand, then a service target, then a forecast.
- **The difficulty does not climb.** Chapter 1 teaches the `ops` pipeline before it teaches what a model is.
  Chapters 1 and 2 quote "20 replications" and averages before chapter 3 explains replications and
  confidence intervals. Within chapters, subsections do not move from a simple case to a general one.
- **The prose has habits that read as generated.** It closes paragraphs with aphorisms ("Balancing pays for
  its generality"), uses tailing negations ("That is a fact about the line, not a failure of the rule"), and
  states strong conclusions ("that knowledge is the whole difference between meeting demand and not").
  A check after nearly every paragraph breaks the reading.

## What Changes

- **A rewrite of chapters 1 to 8, one chapter at a time, in book order.** Headings, slugs, part structure,
  case studies and the chapter standard stay as they are.
- **Chosen examples per chapter,** each drawn from the treatment in a source in the acm-index library
  (Eiselt and Sandblom, Taha, Axsäter, Snyder and Shen, Simchi-Levi, Chen and Bramel, Brémaud, and
  Hernández-Lerma et al.). Every example pairs a scenario with at least two policies or parameter settings,
  and derives in KaTeX the result the simulation then tests. The per-chapter choices are in design.md.
- **A stated prerequisite.** The book assumes first-year undergraduate probability and statistics: discrete
  and continuous distributions, the Poisson and normal in particular, expectation and variance, the sample
  mean, the central limit theorem and the t-interval. It recalls these where it uses them and does not
  teach them. Open University modules may inform the examples but are not cited, since most readers cannot
  get them.
- **Running examples that carry across chapters.** The two-station line runs through Part I and returns in
  chapters 6 and 7. One store, "the Shop", runs through chapters 4, 6, 7 and 8 with the same demand and costs,
  and gains a lead time, randomness, a service target and a forecast in turn.
- **A progression rule.** Each chapter's model section moves from a deterministic or single-station case to
  the general one. No chapter uses replications, confidence intervals or batch comparisons before chapter 3
  introduces them.
- **A predict-then-run pattern.** Each simulator section states the model's prediction first, runs at least
  two policies, and shows predicted and simulated values side by side.
- **A style guide and a prose lint** for the book. The lint flags em dashes, tailing negations, banned words
  and stock closers. Every chapter gets a read-through against the guide.
- **Grouped checks.** A derivation of several displayed formulas can end with one check that cites several
  notebook cells, in place of a check after each formula.
- **Placeholders for simulator gaps.** Where an example needs a capability the simulator lacks, the chapter
  keeps the example and its checked mathematics, and shows a placeholder that names the capability and links
  to its roadmap entry. The documentation check lists open placeholders.

## Capabilities

### Modified Capabilities
- `textbook`: the scenario-per-chapter requirement names the new examples and running examples. New
  requirements cover progression, prose style, predict-then-run and placeholders.
- `checked-claims`: a derivation may share one grouped check.

## Impact

- **Docs content:** all eight chapter files under `packages/docs/content/book/`, their `.checks.macnb` and
  `.checks.py` files, and a new notation appendix to the book.
- **Docs tooling:** a `Placeholder` component and registry, grouped `Check` references, a `Predicted` table
  component, and a prose lint in `docs:check`.
- **Tests:** simulator claims in `packages/lua-runtime/src/book.test.ts` are rewritten to match the new
  examples. Scenario variants (variability off, faster train, discretised normal demand) are written as
  scenario scripts in the chapters.
- **Scenario kit:** no required changes. Capabilities the examples would like, such as Poisson consumers in the
  `mars` pack and service-level metrics, are recorded as placeholders for a later change.
- **Unchanged:** golden result hashes, chapter slugs and the redirects from moved pages.
