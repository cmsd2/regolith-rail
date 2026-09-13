## Context

See proposal.md for motivation and the specs for required behaviour. The current system:

- **Engine.** `packages/engine` simulates one line: a Zod-validated format 1 document, integer milli-units,
  a one-game-minute tick, named random streams, and an event queue ordered eventCheck < tick < departure <
  arrival. Golden result hashes for the starter scenarios × {reference naive, `naive.lua`} × seeds 1–20 are
  checked in Node, Chromium, Firefox and WebKit.
- **Policy API and runtime.** `packages/policy-api` defines Policy API v1 once and generates types,
  annotations, editor data and embedded Lua sources, including `ops`. `packages/lua-runtime` runs policies
  in wasmoon with a Lua 5.1 subset checker, source-instrumented budget, sandbox prelude and memory rules.
- **App.** The workbench edits a scenario as JSON text and draws a line map on a canvas. Share links carry
  the scenario text in the URL fragment.
- **Determinism lint.** The engine and runtime packages are linted to ban `Math.random`, `exp`, `log`,
  `pow`, trigonometry, `Date` and `performance.now`.

## Goals / Non-Goals

**Goals:**
- One engine and one format for both Surviving Mars lines and classic operations research problems.
- Format 1 scenarios keep producing exactly the same results, proven by unchanged golden hashes at every
  step.
- Scenario scripts short enough that a starter scenario fits on one screen.
- Each phase leaves the application releasable.

**Non-Goals:**
- Vehicles choosing destinations or computing shortest paths. Routes are explicit sequences of arcs.
- Arc capacities, congestion, vehicles blocking each other, or random travel times.
- Catchments with depots and drones, and multi-line Surviving Mars colonies.
- Optimisation bounds and benchmark scoring; they belong to M8.
- A visual map editor. Scripts, parameter forms and JSON are the authoring surfaces.

## Decisions

### D1. One core format, packs compile to it

Format 2 is the only format the engine runs. Its core objects:

| Object | Holds |
|---|---|
| Stock point | Resources with capacity or unlimited, expiring flag, flows, converters, suppliers, review schedule, optional map position |
| Arc | Two stock points and a distance |
| Vehicle | A route (`shuttle`, `loop` or `timetable`) and today's speed, dwell and capacity fields |
| Events | As today |
| Costs | Holding, ordering, transport, lost demand, backorder and stall costs |

Format 1 is upgraded to format 2 by a pure function at validation time, so everything after validation sees
only format 2. Packs are Lua libraries that build format 2 tables.

*Alternatives:* a separate engine for classic problems, rejected because it duplicates the determinism work
and splits the documentation. A pack-specific JSON schema per domain, rejected because every tool would then
need to understand every pack.

### D2. Bit-exact format 1 results

The engine is generalised in small steps, and the golden matrix must pass unchanged after each step:

1. Rename stations and trains internally.
2. Generalise movement to routes.
3. Add new flow kinds.
4. Add reviews, orders and costs.

Three rules keep results identical:
- **Random streams.** Stream names for existing sources stay derived from the same identifiers. The upgrade
  keeps station ids, flow order and train ids.
- **Event order.** New kinds slot in without reordering existing ones: eventCheck < delivery < review < tick <
  departure < arrival. Format 1 has no deliveries or reviews, so its relative order is unchanged.
- **Arithmetic.** Shuttle travel time uses today's formula. A path of arcs built from a format 1 line has
  exactly the old segment distances.

### D3. Routes are explicit paths

A route lists stock points in visiting order, and each consecutive pair (and last to first for a loop) must
be joined by an arc. The engine never searches for paths.

- **Shuttle:** reverses at path ends exactly as trains do now.
- **Loop:** wraps around.
- **Timetable:** departs from the first stop at listed times, runs the path, and waits back at the first
  stop, with validation rejecting overlapping trips.

The oscillation metric's "round trip" becomes one full round of the route: out and back for a shuttle, one
circuit for a loop, one trip for a timetable.

### D4. Integer-only stochastic processes

All new processes stay within the determinism lint.

- **Discrete distributions:** integer weights sampled with one uniform integer draw.
- **Poisson arrivals:** approximated per tick as a binomial count over 8 Bernoulli sub-steps with integer
  parts-per-billion probabilities. The mean is exact, and the variance is lower by a factor of (1 − p) with
  p ≤ 1/8 of the per-tick rate, which is negligible at the rates the templates use. Exact Poisson inversion
  needs `exp`, which the lint forbids in the engine; a precomputed table was rejected because rates are
  arbitrary.
- **Per-period processes:** draw at period boundaries and spread evenly over the period's ticks, using the
  same accumulator as rates.
- **Profiles:** piecewise-linear multipliers in thousandths, evaluated with integer interpolation at the start
  of each tick.
- **Recorded traces:** amounts per period.

The documentation states the Poisson approximation, and the classic reference tests use parameters where it
does not move results outside their confidence intervals.

### D5. Reviews, orders and shipments

- **Scheduling.** Reviews are queue events per stock point. At a review the engine expires stock if flagged,
  builds the review snapshot and calls `on_review`, then applies orders in the order issued.
- **External orders.** Each order becomes a delivery event at now plus a lead time drawn from the supplier's
  own random stream.
- **Stock point suppliers.**
  - An order becomes a demand on the supplier's stock.
  - What it holds ships at once as a delivery event after the lead time.
  - The rest joins that supplier's backlog of downstream orders, which is served before its own consumers
    whenever its stock rises (at the next tick).
- **Pipeline.** Orders on the way are kept per stock point and resource, sorted by arrival, and exposed in the
  review snapshot and in `ops` inventory position.
- **Overflow.** A delivery that exceeds capacity is recorded as overflow and is not stored.

Serving backorders and supplier backlogs at the next tick keeps a single, simple place where stock is
allocated.

### D6. Backorders

Each backordering consumer has a backlog counter. At each tick, available stock serves the backlog first,
then current demand, and anything unmet adds to the backlog. Lost-sales consumers behave exactly as today.
Backorder metrics integrate the backlog per tick.

### D7. Exact costs with BigInt accumulators

Cost rates are integers per unit per sol, or per unit, per order or per distance. Accumulating
cost × milli-units × ms can exceed 2^53, so each component uses a BigInt numerator. Totals are reported as
milli-cost integers, converted to Number once they are known to be safe. When a scenario states no costs,
the accumulators are skipped, so format 1 runs pay nothing.

*Alternative:* floating-point costs, rejected because totals would differ across engines in the last bits
and break hashes.

### D8. Scenario scripts run in the Lua runtime

`lua-runtime` gains a scenario evaluator that reuses the checker, instrumentation, budget and sandbox, but
has no policy context.

- **Libraries.** The core, `mars` and `classic` libraries are embedded Lua sources like `ops`, loaded into
  the script environment.
- **Randomness and ordering.** `math.random` stays banned. `pairs` order is fixed for evaluation, so scripts
  are deterministic without the per-seed shuffle.
- **Output.** The evaluator returns the document as JSON through the prelude's encoder. Constructs convert
  keyed tables into arrays in sorted key order.
- **Line numbers.** The privileged prelude exposes a `caller_line()` helper that reads the calling script
  line with `debug.getinfo` from outside the sandbox. Constructs record, in a side table, the line that
  created each table they return. The evaluator emits a source map from document path to line.
- **Mapping validation errors.** Each error is reported at the line of its longest mapped path prefix.
- **Units.** Helpers such as `sols`, `hours`, `weeks` and `units` return exact integers. A non-representable
  value, off by more than 1e-9 of a milli-unit after rounding, raises an error naming the nearest values.

*Alternatives:* a custom DSL, and declarative templates in JSON or YAML. Both were rejected, as recorded in
the proposal discussion: one language for players, reuse of the existing tooling, and loops and functions
without designing a language.

### D9. Where the scenario lives in the app

The workbench stores the scenario as `{ kind: "script" | "json", source, template?: { id, params } }` plus
the cached evaluated document and source map.

- **Evaluation.** It runs in the same worker as policy checks, so typing never blocks.
- **Templates.** Picking a template writes a one-line script calling it with the form's parameters, so
  templates, forms and scripts are one mechanism. Editing the script by hand detaches the form.
- **Share links.** They keep the `v1.` fragment and add the scenario kind and source. Links without a kind
  are treated as JSON and upgraded, which satisfies "Older links".
- **Saves and drafts.** They store the same record.

### D10. A scenario kit package with a single description source

A new `packages/scenario-kit` holds:
- the Lua sources of the core, `mars` and `classic` libraries and the classic reference policies;
- a TypeScript description of every construct and parameter (type, default, units, summary, docs slug);
- generation of editor data, LuaLS annotations, embedded source modules, and the construct reference
  entries used by the docs package.

A test checks that construct names and parameters in the description match the Lua libraries, as
`ops-spec.test.ts` does for `ops`.

Policy API v2 stays in `policy-api`. The review context and order action are added to `spec.ts`, and
generated types and annotations follow.

### D11. Analytic reference results in tests

Each classic template's TypeScript description has an optional `reference(params)` function that returns
analytic values. Those functions use floating point freely; they live outside the linted engine packages.

| Template | Reference value |
|---|---|
| Newsvendor | Exact expected cost from the discrete demand distribution |
| Economic order quantity | Closed form |
| Base-stock with backorders | Poisson or discrete lead-time demand sums |

Tests run fixed seed ranges, so they are deterministic and not flaky, and compare with the reference within
a 99% interval or a stated absolute tolerance. `serial_chain` and `fixed_route_delivery` have no closed form.
Their tests check conservation, the bullwhip variance ratio's direction, and agreement with a hand-computed
short trace.

### D12. Map layout

- **Lines:** a single shuttle line keeps today's straight layout, so the Mars experience is unchanged.
- **Positions:** stock points with positions from scripts use them.
- **Automatic layout:**
  - a single loop is drawn on a circle;
  - a tree, such as a serial chain or distribution, is drawn in layers from its external suppliers;
  - anything else falls back to a deterministic circular layout.

The map code moves from station index positions to projected coordinates, and shipments in transit are
drawn along their arc.

### D13. `ops` reviews and mod-ready detection

`ops.policy` gains a `review` spec and returns `on_review` when it is given. The review path builds a site for
each supplied resource, computes the inventory position (stock + on order − backorders), reuses the target
blocks, and emits orders and traces.

Mod-ready status is computed in the worker after loading. The policy's hook set comes from the loaded
module, the scenario checks come from the evaluated document, and both are returned with check results.

### D14. Roadmap placement

The roadmap gains a stage between M7 and M8, "M7a — General scenarios and packs". The benchmark is then built
on format 2, and the classic pack can supply analytic checks for scoring. Free vehicle routing moves to the
research track. §9 no longer excludes networks of stock points, but keeps Surviving Mars colonies to one line
at a time. `openspec/config.yaml` context is updated to describe the core model and packs.

## Risks / Trade-offs

- **[Refactoring the engine changes format 1 results in subtle ways]** → Generalise in the small steps of D2,
  with the golden matrix run in Node after every step and in browsers in CI.
- **[The change is large]** → Tasks are grouped into phases, each ending with a releasable application:
  1. Core format and engine.
  2. Reviews and costs.
  3. Scripts.
  4. Mars pack.
  5. Classic pack.
  6. App and documentation.
- **[The Poisson approximation surprises readers of textbooks]** → Documented on the scenario format and
  classic pages. Reference tests choose parameters where the effect is within noise.
- **[Source-map line numbers are wrong for tables built by helper functions]** → Report the line of the
  construct call that finally received the table, and fall back to the document path when no line is known.
- **[BigInt cost accounting slows batches]** → Only scenarios with costs use it. Measure a 100-seed `reorder`
  batch and switch to scaled Number accumulators with overflow checks if it is more than 20% slower.
- **[Mars players meet operations research jargon]** → Mars starters and pack stay the defaults. Classic
  templates sit under their own picker group. Mars pack documentation uses game terms first.
- **[Scripts make shared scenarios harder to audit than JSON]** → The evaluated document is one click away,
  and share links open without running anything, as today.

## Migration Plan

1. Ship the format 2 engine behind format 1 upgrade: starters stay JSON and goldens stay unchanged. Deploy.
2. Add reviews, costs, scripts and packs. Replace the starter JSON with Mars scripts only when their evaluated
   documents give identical golden hashes.
3. Share links and saved work from earlier releases open through the upgrade path. Rollback is a redeploy of
   the previous commit through the manual deploy workflow. Links created by the new release that use scripts
   will not open in an older release, which is acceptable for a static site with a single live version.

## Open Questions

- Default rates for Mars pack buildings. The current starter values are close enough. The game mechanics page
  lists defaults with the `observed` evidence level and can be refined without changing the specs.
- Whether classic templates should also get worked-example variants with fixed seeds for the docs. That can
  be decided when their pages are written.
