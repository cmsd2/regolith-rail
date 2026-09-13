# Regolith Rail roadmap

This document describes what Regolith Rail is for, the decisions already made, and
the order in which it will be built. It says what each stage delivers and how we
know it is done. It does not say how to implement anything; that belongs in the
design notes for each stage.

## 1. Purpose

Surviving Mars: Relaunched moves resources between stations with trains that
shuttle back and forth along a line. The game's dispatch logic appears to
balance stock levels across the stations on a line. It does not treat stations
as supply or demand points, does not account for how fast a station is being
drained, and has no notion of flow control.

Regolith Rail is a browser sandbox that lets players:

1. See why the current behaviour fails, through prepared scenarios and
   measurements.
2. Write their own dispatch policies, from one-line configurations built from
   operations research building blocks up to fully custom code.
3. Simulate those policies over many randomised runs and watch the results.
4. Score policies against a fixed benchmark and share results that anyone can
   reproduce, for example on Reddit.
5. Eventually run the same policy in the real game as a mod.

It also teaches: every building block, concept and metric is documented inside
the app.

## 2. The problem in brief

These are the failures the project sets out to demonstrate. Each becomes a
benchmark scenario.

| Failure | Description |
|---|---|
| Half capacity | Balancing moves at most half the stock difference per visit, so a line carries roughly half what a supply-to-demand strategy could. |
| Operating at the edge | To move goods at all, demand stations must sit near empty and supply stations near full. Any disturbance causes shortages or stalled production. |
| No flow control | Deliveries depend on stock differences, not consumption rate. |
| Dead stock at relays | Stations with no producers or consumers fill to the line average and tie up storage. |
| Ping-pong | Resources are carried one way and then back again. |
| Double dispatch | Decisions ignore cargo already on its way. |
| No priorities | Critical resources are treated the same as bulk materials. |
| Bullwhip | Small changes in demand grow into large swings in stock. |

The exact vanilla rules are not yet confirmed; see §9.

## 3. Principles

- **Deterministic.** The same scenario, policy and seed give identical results
  in every supported browser and in Node. Shared results depend on this.
- **One policy file everywhere.** A policy runs unchanged in the simulator and,
  later, in the game.
- **Faithful to the game where it matters, explicit where it isn't.** Every
  modelling assumption about the game is documented with the game version and
  the evidence behind it.
- **Explainable.** Every decision a policy makes can be traced to the building
  block and numbers that produced it.
- **Static.** The app is a static website with no backend and no accounts.
- **Documented as part of done.** A feature is not finished until it is
  documented.
- **Independent of the game's IP.** No game assets, no copied game code, no
  trademarks in names or branding, and a clear non-affiliation statement.

## 4. Decisions made

| Area | Decision |
|---|---|
| Target game | Surviving Mars: Relaunched. Baselines are labelled with the game version they represent. |
| Policy language | A sandboxed subset of Lua matching the Lua version the game embeds, chosen over a Python subset so policies can become mods. |
| Policy model | A policy is a Lua module against a versioned Policy API. It is called when a train stops, receives a snapshot of the world, and issues load and unload actions. |
| High-level constructs | An `ops` library, written in Lua and shipped to both simulator and mod, providing operations research building blocks arranged as a pipeline. Custom Lua is the escape hatch. |
| Simulation | Discrete, integer-based simulation of lines, stations, trains and station catchments, with randomised production, consumption and shocks. Monte Carlo over many seeds, with paired seeds for comparisons. |
| Scale | Scenarios use game units: rates per sol (24 game hours) and game time, with values typical of the game rather than arbitrary ones. |
| World events | Events are states of the world that hold for a time window, like the game's disasters, not one-off impulses. While active, an event's effects scale production (supply shocks) or consumption (demand shocks) of chosen resources at chosen stations. A storm is one kind of event. |
| Trains and disasters | Disasters do not affect trains: speed, capacity and dwell are unchanged. |
| Web stack | TypeScript, pnpm workspaces, Vite, React, Zustand, Radix UI, CodeMirror 6, Canvas 2D, uPlot, Observable Plot, Comlink, Zod. |
| Lua runtime | A Lua VM in the browser matching the game's Lua version (wasmoon or Fengari, decided after the game research stage). |
| Docs | MDX content inside the app, prerendered as static pages with React Router 7, KaTeX, Shiki and MiniSearch. |
| Quality | Vitest, fast-check, Playwright across Chromium, Firefox and WebKit, Biome, GitHub Actions. |
| Hosting | GitHub Pages or Cloudflare Pages. |
| Licence | Apache-2.0. |

## 5. Components

| Component | Responsibility |
|---|---|
| `engine` | Simulation core. No browser dependencies. |
| `policy-api` | The single definition of the Policy API. Generates TypeScript types, Lua editor annotations, documentation and shared test cases. |
| `lua-runtime` | Runs policies: sandbox, instruction budget, information-level checks, snapshots, save/load testing. |
| `ops` | The Lua building-block library (lives with `policy-api`). |
| `bench` | Benchmark suites, bounds and scoring. |
| `cli` | Runs simulations and benchmarks in Node for CI, golden results and batch work. |
| `app` | The web application. |
| `docs` | Documentation content and generated reference. |
| `mod` | The game adapter mod (later stages). |

## 6. Concepts

| Term | Meaning |
|---|---|
| Scenario | A complete world definition: line, stations, trains, catchments, randomness, events, duration, information level. |
| Catchment | Everything behind a station: producers, consumers, depots and drones, with limited transfer rates. |
| Site | One station and one resource. |
| Policy | A Lua module that decides what a train loads and unloads at each stop. |
| Information level | How much a policy may see: `local`, `line`, `line+history`, `colony`. |
| Category | Vanilla (`local`, `line`: what a mod could plausibly read) or Extended (more). Scores are compared within a category. |
| Inventory position | Stock on hand plus cargo on its way, minus stock already promised elsewhere. |
| Baseline | The naive policy reproducing the game's behaviour for a stated game version. |
| Bound | The best result any policy could achieve on a scenario, computed with full knowledge of the future. |

## 7. Stages

Stages are listed in dependency order. Some can run in parallel; this is noted
where it matters. No dates are attached.

### M0 — Foundations

Repository, licence, placeholder README and CI exist.

**Remaining deliverables**
- pnpm workspace with the component packages above as empty shells.
- Lint, format and type-check in CI.
- Line-ending and editor settings.
- Contribution notes and non-affiliation statement.
- Docs directory with this roadmap.

**Done when** a clean checkout installs, lints, type-checks and passes an empty
test suite in CI.

### M1 — Game research

Answer the questions the rest of the design depends on, using the Relaunched
install, its mod tools documentation and in-game observation.

**Deliverables**
- The Lua version the game embeds.
- Internal resource identifiers and storage units.
- How trains and stations decide what to load and unload, at the level of
  observable rules.
- Whether a mod can intercept or replace that decision, and where.
- What data about stations, trains and catchments a mod can read.
- How a mod persists data in save games.
- Observed behaviour on small test lines (two and three stations, one train)
  recorded as reproducible notes.
- A first draft of the Policy API grounded in these findings.
- Game mechanics documentation pages tagged with game version and evidence.

**Done when** each question above has an answer or is recorded as unanswerable
with the consequences stated, and the naive baseline's rules are written down.

**Notes** No game code is copied into the repository. Findings are described
in our own words.

### M2 — Simulation engine

**Deliverables**
- Scenario format with validation and a published schema.
- Deterministic engine: lines, stations with per-resource capacity, shuttling
  trains with capacity, speed and per-unit dwell time, catchments with
  randomised production and consumption, scheduled and random events.
- Separate random streams per source so changing one part of a scenario does
  not disturb the others.
- Naive baseline implemented directly in TypeScript as a reference.
- Event log and time series output for a run.
- Core metrics: unmet demand (priority-weighted), stalled production,
  delivered throughput, empty distance, dwell time, oscillation count,
  recovery time after a shock.
- `cli` command to run a scenario and emit results.
- Invariant tests: resources are conserved, stock stays within capacity, the
  same seed gives the same event log.
- Cross-browser determinism test comparing result hashes with Node.
- Starter scenarios: two-station, three-station with relay, storm shock.

**Done when** the starter scenarios run headlessly, reproduce the half-capacity
and edge-of-failure effects with the reference baseline, and give identical
hashes in Node, Chromium, Firefox and WebKit.

### M3 — Policy runtime and Policy API v1

**Deliverables**
- Lua VM running in a worker, matching the game's Lua version.
- Sandbox: banned libraries removed, language features outside the game's
  version rejected.
- Instruction budget per call with clear failure reporting.
- Snapshot of the world per stop, limited to the scenario's information level;
  reads beyond it raise a descriptive error.
- Actions: load, unload, log, record.
- Persistent `memory` restricted to data that could survive a save game.
- Unordered-iteration shuffling per seed, so order-dependent policies show up
  as variance.
- Save/load test mode that reloads the policy mid-run and restores memory.
- Policy API v1 spec with generated TypeScript types, Lua editor annotations
  and shared test cases.
- `naive.lua` baseline.
- Language and Policy API reference documentation.

**Done when** `naive.lua` produces results identical to the TypeScript reference
on every starter scenario and seed, and runaway, sandbox-escaping and
order-dependent test policies are all caught and reported.

### M4 — `ops` library v1

**Deliverables**
- Policy pipeline: observe, estimate, classify, target, control, plan,
  allocate, execute. Every stage accepts a built-in block or a custom
  function, and there are before/after hooks.
- Inventory position tracking with reservations kept in persistent memory.
- First blocks:
  - Estimate: last change, moving average, exponentially weighted moving
    average, visit interval.
  - Classify: manual roles, roles by net flow with hysteresis.
  - Target: balance, order-up-to, min-max, days of cover, drain, fill,
    pass-through.
  - Control: hysteresis, rate limit.
  - Plan: downstream lookahead.
  - Allocate: priority, proportional, fractional knapsack across resources.
- Each block declares the information it reads, so a policy's category is
  known before it runs.
- Decision traces explaining each block's output.
- The naive baseline expressed as a one-line `ops` policy, matching `naive.lua`.
- A documentation page, live example and demonstrating scenario for each block.

**Done when** the one-line baseline matches `naive.lua`, a policy combining
inventory position, roles and lookahead measurably fixes double dispatch and
ping-pong on the relevant scenarios, and every block is documented.

### M5 — Single-run app

**Deliverables**
- Editor with Lua highlighting, diagnostics, autocomplete and hover
  documentation from the Policy API and `ops`.
- Scenario picker and parameter controls.
- Line map showing trains, cargo and per-station stock.
- Stock and metric charts over time.
- Timeline scrubber replaying the run from its event log.
- Stop inspector showing actions, decision traces and log output for any stop.
- Error display pointing at the failing line, train, station and time.
- Local saving of policies and scenarios.
- Share links that encode a policy and scenario in the URL.

**Done when** a player can open the app, load a starter scenario, edit a policy,
run it, scrub through it and understand why any stop did what it did, without
reading the source.

### M6 — Batch runs and comparison

**Deliverables**
- Monte Carlo runner using all available cores.
- Distributions for every metric across seeds, with confidence intervals.
- Paired comparison of two policies on identical seeds, showing the
  difference and whether it exceeds noise.
- Fan charts of stock over time across seeds.
- Progress reporting and cancellation.
- Parameter sweeps producing heatmaps (for example train count against
  consumption rate).

**Done when** the app can show, with confidence intervals, that a supply-to-
demand policy outperforms the baseline on the starter scenarios and where the
baseline breaks down as demand rises.

### M7 — Documentation system

Can start alongside M3; content grows with every later stage.

**Deliverables**
- In-app documentation panel and prerendered public pages under `/docs`.
- Sections: Guides, Language, Policy API, Blocks, Encyclopedia, Game mechanics,
  Simulator reference.
- Generated reference for the Policy API and `ops`, sharing its source with
  editor hover and autocomplete.
- Standard page layout for blocks and concepts: summary, intuition, formula,
  live widget, usage, failure modes, related pages, further reading.
- Live widgets that run small fixed-seed simulations.
- Links from diagnostics, the stop inspector, metrics and scenarios into the
  docs.
- Offline search.
- CI checks: code examples execute, every API symbol and block is documented,
  widgets render deterministically, links resolve.
- Initial encyclopedia covering the concepts used by `ops` v1 and the failure
  modes in §2.

**Done when** every public API symbol and block has a page, all documentation CI
checks pass, and the failure modes in §2 each have an explanatory page linked
to a scenario.

### M8 — Benchmark v1 and scoring

**Deliverables**
- A frozen, versioned benchmark suite: at least two-station, three-station
  relay, five-station mixed, storm shock and demand ramp.
- Separate training and evaluation seed sets.
- Bounds for each scenario and seed, computed offline from an optimisation
  model with full knowledge of the future, and shipped with the suite.
- Headline score: the share of the gap between baseline and bound that a
  policy closes, averaged over the suite, with a documented fallback where no
  bound is available.
- Supporting figures always shown with the score: component metrics, worst-
  case seed, confidence intervals, instructions per stop, lines of code.
- Categories (Vanilla, Extended) with a Mod-ready indication.
- Golden results for the baseline stored and checked in CI.
- Simulator reference documentation for metrics, score and categories.

**Done when** the suite, bounds and baseline results are frozen under a version
label, and scoring a policy twice on different machines and browsers gives the
same numbers.

### M9 — Reports, sharing and public alpha

**Deliverables**
- One-click benchmark run producing:
  - Markdown suitable for Reddit: summary table, the full policy, a verify
    link.
  - A result card image with score, per-scenario comparison, a chart, category,
    versions and policy hash.
  - A verify link that re-runs the suite in the reader's browser and confirms
    or disputes the claimed numbers.
  - Raw results as JSON.
- Custom-scenario reports clearly marked and unscored.
- Paste repair for policies copied from forums.
- Guides: getting started, first policy, reading results, sharing.
- Non-affiliation notice in the app and on shared outputs.
- Public deployment.

**Done when** a result posted from one browser verifies in another, the guides
take a new player from nothing to a shared result, and the site is public.

### M10 — Tuning and `ops` v2

**Deliverables**
- Tunable parameters declared inline in a policy.
- In-browser parameter search over training seeds, with results scored on
  evaluation seeds and reports marking tuned policies.
- Additional blocks: safety stock by service level, trend forecasting,
  variance estimation, earliest stockout first, max-min fair allocation,
  smoothing, PID control, line-wide transport planning.
- Form-based policy builder that edits the same Lua text, with custom
  functions shown as code cells.
- Encyclopedia pages for every new concept.
- Diverted traffic: while storms ground shuttles, freight they would have
  carried moves onto the rail line, raising supply and demand at the stations
  those shuttles served, with an optional backlog after the storm clears.

**Done when** tuning measurably improves a documented example policy on
evaluation seeds, every new block meets the M4 documentation standard, and a
storm scenario with diverted traffic is part of the benchmark's next version.

### M11 — Mod: shadow mode

Depends on M1 confirming that a mod can read the necessary data. If it cannot,
this stage is reduced to what is possible, and the reasons are documented.

**Deliverables**
- Adapter mod for Relaunched that builds the Policy API snapshot from game
  objects and runs a policy without affecting the game.
- Logging of vanilla decisions, policy decisions and station stock over time.
- Comparison of `naive.lua` against actual vanilla decisions.
- Import of game logs into the simulator as calibrated scenarios.
- Fitting of an interpretable model to logged vanilla decisions to confirm or
  correct the baseline.
- Adapter translation logic tested outside the game against the shared test
  cases.
- Modding guide in the docs.

**Done when** `naive.lua` in shadow mode matches vanilla decisions on the test
lines, or every difference is explained and the baseline updated under a new
version label.

### M12 — Mod: active mode and export

Depends on M1 confirming a mod can replace the dispatch decision.

**Deliverables**
- Policy replaces the vanilla decision, per line, with vanilla as a fallback
  on error or budget overrun.
- Mod settings to choose policy and mode per line.
- Export from the simulator packaging a policy with the adapter as a mod ready
  for upload to Paradox Mods.
- Compliance check against Paradox's mod terms.

**Done when** an exported policy runs in the game on a test colony through a
save and reload with behaviour matching its shadow-mode log.

### Research track (after M9, optional)

Not required for the core product. Each item ships only if it produces
something players can read or use.

- **Reinforcement learning.** A Gymnasium-compatible environment over the
  engine, trained agents as reference policies, and distillation into
  decision trees emitted as readable Lua.
- **Genetic programming.** Evolving `ops` pipelines and custom functions, with
  size limits and simplification, offered as a "beat the evolved policy"
  challenge.
- **Engine performance.** Revisit a native engine with browser and Python
  bindings if batch or training workloads need it.

## 8. Out of scope

- Backend services, accounts and a shared leaderboard. Verify links provide
  trust without them; a leaderboard may be reconsidered after M9.
- Passenger transport.
- Networks of interconnected lines. The model is one line at a time.
- Colony simulation beyond what a station's catchment needs.
- Game assets, art or copied game code.
- Other games.

## 9. Open questions

| Question | Blocks | Resolved by |
|---|---|---|
| Which Lua version does Relaunched embed? | Lua runtime choice, language subset | M1 |
| What exactly is the vanilla balancing rule: line average or neighbours, live or stale stock, does train cargo count? | Faithful baseline | M1, confirmed in M11 |
| What is a train's cargo capacity and is it per resource or shared? | Engine model | M1 |
| What are typical game values for train speed, trip times, loading time, station sizes (30 small, 60 large per resource) and production and consumption per sol? | Realistic starter scenarios | Player observation, then M1 |
| How do multiple trains on one line behave? | Engine model, multi-train scenarios | M1 |
| What happens when a station is full or empty: do producers stall, do drones reroute? | Catchment model | M1 |
| Can a mod read other stations' stock and catchment data? | Definition of the Vanilla category | M1 |
| Can a mod intercept the load/unload decision? | M11, M12 | M1 |
| Which Lua VM: wasmoon or Fengari? | M3 | M1 findings plus a performance check |
| What do Paradox's mod terms allow? | M12 | Before M12 |

## 10. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| The game's dispatch decision cannot be modded. | No active mod. | Shadow mode or advisory tooling where possible; the simulator stands alone regardless. |
| The baseline does not match the game. | Claims about the game are wrong. | Evidence tags on all game pages, shadow-mode validation, versioned baselines. |
| Game patches change train behaviour. | Old results no longer describe the game. | Baselines and benchmarks are versioned and never edited in place. |
| Browsers disagree on results. | Verify links fail. | Integer arithmetic, own random generator, cross-browser CI from M2. |
| Running policies in a Lua VM is too slow for large batches. | Slow comparisons and tuning. | One snapshot per stop, worker parallelism, performance budget checked in CI. |
| Players find Lua unfamiliar. | Fewer people write policies. | `ops` blocks and the form builder cover most needs without code; thorough language guide. |
| Trademark or IP complaints. | Takedown. | No game names in branding, no assets, no copied code, non-affiliation notices. |
| Scope creep from research ideas. | Core product delayed. | Research track only after public alpha. |
