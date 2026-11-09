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

Surviving Mars is the flagship use case, but the simulator is not limited to it.
Its core model describes networks of stations, converters, suppliers with lead
times, costs and vehicles on fixed routes, so well-known operations research
problems can be expressed as well. Scenarios for either are written concisely with
domain packs: one in the game's own vocabulary, and one of classic problems.

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

The exact vanilla rules are not yet confirmed; see §10.

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
- **General core, domain packs.** The engine and scenario format know nothing
  about any one game. Domain packs describe scenarios in their own vocabulary and
  compile to the core format. Surviving Mars is the flagship pack and the default
  experience.
- **Independent of the game's IP.** No game assets, no copied game code, no
  trademarks in names or branding, and a clear non-affiliation statement.

## 4. Decisions made

| Area | Decision |
|---|---|
| Target game | Surviving Mars: Relaunched. Baselines are labelled with the game version they represent. |
| Policy language | A sandboxed subset of Lua matching the Lua version the game embeds, chosen over a Python subset so policies can become mods. |
| Policy model | A policy is a Lua module against a versioned Policy API. It is called when a train stops, receives a snapshot of the world, and issues load and unload actions. |
| High-level constructs | An `ops` library, written in Lua and shipped to both simulator and mod, providing operations research building blocks arranged as a pipeline. Custom Lua is the escape hatch. |
| Simulation | Discrete, integer-based simulation of networks of stations joined by arcs, with vehicles on fixed shuttle, loop or timetable routes, converters, suppliers with lead times, reviews, backorders or lost sales, costs, and randomised production, consumption and shocks. A Surviving Mars line is one shuttle route. Monte Carlo over many seeds, with paired seeds for comparisons. |
| Scenario authoring | Scenario scripts in the same sandboxed Lua as policies, built from a constructs library and evaluated to a validated JSON document. Packs: `mars` for the game, `classic` for well-known operations research problems. |
| Scale | Scenarios use game units: rates per sol (24 game hours) and game time, with values typical of the game rather than arbitrary ones. |
| World events | Events are states of the world that hold for a time window, like the game's disasters, not one-off impulses. While active, an event's effects scale production (supply shocks) or consumption (demand shocks) of chosen resources at chosen stations. A storm is one kind of event. |
| Trains and disasters | Disasters do not affect trains: speed, capacity and dwell are unchanged. |
| Web stack | TypeScript, pnpm workspaces, Vite, React, Zustand, Radix UI, CodeMirror 6, Canvas 2D, uPlot, Observable Plot, Comlink, Zod. |
| Lua runtime | wasmoon (Lua 5.4 compiled to WebAssembly), with policies checked against the Lua 5.1 subset until the game's Lua version is confirmed. |
| Docs | MDX content inside the app, prerendered as static pages with React Router 7, KaTeX, Shiki and MiniSearch. |
| Quality | Vitest, fast-check, Playwright across Chromium, Firefox and WebKit, Biome, GitHub Actions. |
| Hosting | GitHub Pages, deployed from `main` by CI. The build is host-agnostic, with a guide for S3 and CloudFront. |
| Licence | Apache-2.0. |

## 5. Components

| Component | Responsibility |
|---|---|
| `engine` | Simulation core. No browser dependencies. |
| `policy-api` | The single definition of the Policy API. Generates TypeScript types, Lua editor annotations, documentation and shared test cases. |
| `lua-runtime` | Runs policies: sandbox, instruction budget, information-level checks, snapshots, save/load testing. |
| `ops` | The Lua building-block library (lives with `policy-api`). |
| `scenario-kit` | Scenario construct libraries and packs in Lua, with the single description of every construct that drives the editor and documentation. |
| `bench` | Benchmark suites, bounds and scoring. |
| `cli` | Runs simulations and benchmarks in Node for CI, golden results and batch work. |
| `app` | The web application. |
| `docs` | Documentation content and generated reference. |
| `mod` | The game adapter mod (later stages). |

## 6. Concepts

| Term | Meaning |
|---|---|
| Scenario | A complete world definition: stations, arcs, vehicles and routes, flows, suppliers, reviews, costs, randomness, events, duration, information level. |
| Station | A place that holds stock of one or more resources: a Surviving Mars rail station, a warehouse, a shop or a stage in a supply chain. |
| Vehicle | Anything that carries stock along a fixed route: a shuttle, a loop or a timetable. A Surviving Mars train is a vehicle on a shuttle route. |
| Review | A scheduled moment when a policy decides what a station orders from its suppliers. |
| Scenario script | Lua source that builds a scenario from constructs. |
| Pack | A construct library for one domain, such as the game or classic problems. |
| Template | A pack construct that returns a whole scenario from a few parameters. |
| Catchment | Everything behind a station: producers, consumers, depots and drones, with limited transfer rates. |
| Site | One station and one resource. |
| Policy | A Lua module that decides what a train loads and unloads at each stop. |
| Information level | How much a policy may see: `local`, `line`, `line+history`, `colony`. |
| Category | Vanilla (`local`, `line`: what a mod could plausibly read) or Extended (more). Scores are compared within a category. |
| Inventory position | Stock on hand plus cargo on its way, minus stock already promised elsewhere. |
| Baseline | The balance-stock policy reproducing the game's behaviour for a stated game version. |
| Bound | The best result any policy could achieve on a scenario, computed with full knowledge of the future. |

## 7. Stages

Stages are listed in dependency order. Some can run in parallel; this is noted
where it matters. No dates are attached.

### M0 — Foundations

**Status** Delivered, apart from contribution notes.

**Deliverables**
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
with the consequences stated, and the balancing baseline's rules are written down.

**Notes** No game code is copied into the repository. Findings are described
in our own words.

### M2 — Simulation engine

**Status** Delivered, except catchments (depots and drones behind a station) and
the recovery-time metric. Stations have producers and consumers directly. World
events are states that scale supply or demand for a time window.

**Deliverables**
- Scenario format with validation and a published schema.
- Deterministic engine: lines, stations with per-resource capacity, shuttling
  trains with capacity, speed and per-unit dwell time, catchments with
  randomised production and consumption, scheduled and random events.
- Separate random streams per source so changing one part of a scenario does
  not disturb the others.
- Balancing baseline implemented directly in TypeScript as a reference.
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

**Status** Delivered with wasmoon. Matching the game's Lua version waits for M1.

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
- `balance-stock.lua` baseline.
- Language and Policy API reference documentation.

**Done when** `balance-stock.lua` produces results identical to the TypeScript reference
on every starter scenario and seed, and runaway, sandbox-escaping and
order-dependent test policies are all caught and reported.

### M4 — `ops` library v1

**Status** Partly delivered: the classify, target, plan and allocate stages;
manual roles; the balance, order-up-to, min-max, drain, fill and pass-through
targets; lookahead with reservations; priority and proportional allocation;
decision traces; level checks; the one-line baseline; and a reference page per
block. Still to come: the observe, estimate and control stages and hooks,
estimate blocks, roles by net flow, days of cover, fractional knapsack, and a
demonstrating scenario for every block.

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
- The balancing baseline expressed as a one-line `ops` policy, matching `balance-stock.lua`.
- A documentation page, live example and demonstrating scenario for each block.

**Done when** the one-line baseline matches `balance-stock.lua`, a policy combining
inventory position, roles and lookahead measurably fixes double dispatch and
ping-pong on the relevant scenarios, and every block is documented.

### M5 — Single-run app

**Status** Delivered.

**Deliverables**
- Editor with Lua highlighting, diagnostics, autocomplete and hover
  documentation from the Policy API and `ops`.
- Scenario picker and parameter controls.
- Line map showing trains, cargo and per-station stock.
- Stock and metric charts over time.
- Timeline scrubber replaying the run from its event log.
- Stop inspector showing actions, decision traces and log output for any stop.
- Error display pointing at the failing line, train, station and time.
- Local saving of policies and scenarios (replaced in M9 by the library
  explorer).
- Share links that encode a policy and scenario in the URL.

**Done when** a player can open the app, load a starter scenario, edit a policy,
run it, scrub through it and understand why any stop did what it did, without
reading the source.

### M6 — Batch runs and comparison

**Status** Delivered, except parameter sweeps and heatmaps.

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

**Status** Delivered, except live widgets. The encyclopedia is becoming a book,
*Operations research on the line*: Part I (Foundations, chapters 1 to 3) and
Part II (Inventory, chapters 4 to 8) are written in the standard order,
deterministic before random and one period before many. Every chapter has a
scenario, a comparison to run, an exercise run in the simulator, and every
formula and number checked by Maxima, Python or the simulator in CI. Four of
the five starter lessons are case studies in chapters; ping-pong waits for
Part III. Parts III (Networks), IV (Optimisation) and V (Dynamics) are to come.
Documentation sections are organised as getting started, the book, guides, the
one remaining failure mode, reference (including the template pages) and game
mechanics.

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
- Encyclopedia pages for the §8 techniques as their stages land, each citing its
  sources and saying where the simulator departs from the textbook setting.

**Done when** every public API symbol and block has a page, all documentation CI
checks pass, and the failure modes in §2 each have an explanatory page linked
to a scenario.

### M7a — General scenarios and packs

Comes after M7 and before M8, so the benchmark is built on the general format and
classic problems can check the engine against known results.

**Deliverables**
- Scenario format 2: stations and arcs, vehicles on shuttle, loop and
  timetable routes, converters, suppliers with lead times, reviews, expiring
  stock, backorders or lost sales, costs, and Poisson, per-period, trace and
  profile demand. Format 1 scenarios are upgraded on load.
- Engine support for format 2, with upgraded format 1 scenarios giving exactly
  the same results.
- Policy API v2: a review hook with an order action and route-aware context,
  with v1 policies unchanged and a mod-ready indication.
- `ops` pipelines that make ordering decisions at reviews.
- Scenario scripts: a sandboxed Lua constructs library with unit helpers and
  errors reported at script lines.
- The `mars` pack in game vocabulary, with the starter scenarios rewritten in it.
- The `classic` pack: newsvendor, reorder policies, serial chain and fixed-route
  delivery templates with reference policies and analytic checks.
- A map for networks and loops, a template picker with parameter forms, a
  review inspector, and scripts in share links and saved work.
- Construct reference, a scenario scripting guide and a page per classic
  template.

**Done when** golden results are unchanged, every classic template with an
analytic answer agrees with it within its confidence interval, and a starter
scenario and a classic template can each be edited as a short script, run and
shared.

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
- A versioned result format: each version declares the output fields its hash
  covers, so later additions to run output do not change published hashes.
- Simulator reference documentation for metrics, score and categories.

**Done when** the suite, bounds and baseline results are frozen under a version
label, and scoring a policy twice on different machines and browsers gives the
same numbers.

### M9 — Reports, sharing and public alpha

**Status** Public deployment, share links, the library explorer, and the getting
started and library guides are delivered. Benchmark reports, result cards,
verify links, paste repair, and the first policy and reading results guides are
still to come.

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
- Library explorer: slots for the run's scenario, policy and comparison
  policy; separate Scenarios, Policies and Saved runs lists, with policies
  grouped by fit to the scenario; scenario lessons offering the baseline, the
  suggested fix or the reference policy; saved runs that share links open as;
  copy on edit with automatic saving; and import and export of files.
- Guides: getting started, library and saved runs (including sharing), first
  policy, reading results.
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
- The §8 techniques marked M10, each with a block, metric or view and an
  encyclopedia page.
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
- Comparison of `balance-stock.lua` against actual vanilla decisions.
- Import of game logs into the simulator as calibrated scenarios.
- Fitting of an interpretable model to logged vanilla decisions to confirm or
  correct the baseline.
- Adapter translation logic tested outside the game against the shared test
  cases.
- Modding guide in the docs.

**Done when** `balance-stock.lua` in shadow mode matches vanilla decisions on the test
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
  decision trees emitted as readable Lua. §8.9 outlines the book chapters this
  work supports.
- **Genetic programming.** Evolving `ops` pipelines and custom functions, with
  size limits and simplification, offered as a "beat the evolved policy"
  challenge.
- **Engine performance.** Revisit a native engine with browser and Python
  bindings if batch or training workloads need it.
- **Vehicle routing.** Vehicles that choose their own destinations, for
  vehicle routing and pickup-and-delivery problems. Routes stay fixed until then.

## 8. Techniques to showcase

Regolith Rail is meant to teach. Each technique below becomes something a player
can use or watch: a building block, a metric, a scenario or a view. Each is paired
with a documentation page that explains it, cites its sources in §12 and compares
it with the baseline. The stage in brackets is where it is planned. Where a
classic problem template demonstrates a technique, the entry names it; templates
arrive in M7a. Where a chapter of the book teaches a technique, the entry names the
chapter.

The simulator often differs from the textbook setting, and those differences are
part of the lesson. Unmet demand is lost rather than backordered. Trains limit how
much can be delivered at once and cannot choose their route. The interval between
visits depends on the policy, and a station that runs dry hides how much demand it
missed. Every page says which assumptions hold and which do not.

### 8.1 Inventory control at a station

A site behaves like a single stocking point. A visit is a review, the time between
visits is the review period, and the travel time for cargo is the lead time.

- **Inventory position** [M4; book chapter 6]. Decide from stock plus cargo already heading for a
  site, not stock on hand, because what a station holds after the lead time is its
  position now minus the demand in between. `plan` reservations compute it. Stock
  and position are charted together, and removing the position shows over-delivery
  and oscillation (Axsäter, 2015, pp. 39–40; Snyder and Shen, 2019, p. 50).
- **Periodic review** [M10; book chapter 6]. Stock must cover the review period plus the lead time,
  so longer lines and fewer trains need fuller stations. A sweep of train count and
  speed shows unmet demand growing with the protection interval (Axsäter, 2015,
  pp. 40–41).
- **Base-stock (order-up-to) policies** [M4; template `classic.reorder`; book chapter 6]. At every review, raise the position
  to a level made of cycle stock plus safety stock. This is the `order_up_to`
  target, with its level drawn on the stock chart. Station and train capacity cap
  the level in ways the textbook model does not (Axsäter, 2015, pp. 42–43, 113–115;
  Snyder and Shen, 2019, pp. 105–113).
- **Newsvendor critical ratio** [M10; template `classic.newsvendor`; book chapter 5]. Choose the level at which the chance of
  meeting demand equals the shortage cost divided by the sum of the shortage and
  overage costs. Resource priority sets the shortage cost and stalled production is
  the overage, so a slider traces the trade-off between them (Axsäter, 2015,
  pp. 95–97; Snyder and Shen, 2019, pp. 90–101; Taha, 2017, pp. 618–620).
- **Safety stock and service levels** [M10; template `classic.safety_stock`; book chapter 7]. Safety stock grows quickly with the
  service level demanded. The cycle service level, fill rate and ready rate can
  differ widely, especially under bursty demand, so all three are reported side by
  side (Axsäter, 2015, pp. 79–81, 86–87; Snyder and Shen, 2019, pp. 105–113).
- **Min–max (s, S) policies and the economic order quantity** [M4; template `classic.reorder`; book chapter 4]. Act only when
  the position falls below a minimum, then restore it to a maximum. Fixed dwell per
  stop plays the part of a fixed ordering cost. The flat cost curve of the economic
  order quantity shows that batch size matters less than the reorder point. This is
  the `min_max` target (Axsäter, 2015, pp. 45–48, 115–116; Eiselt and Sandblom,
  2022, pp. 420–421; Simchi-Levi, Chen and Bramel, 2014, pp. 152–153; Taha, 2017,
  pp. 507–510).
- **Lost sales** [M8]. With lost sales and a lead time, base-stock policies are no
  longer optimal and the optimal form is unknown. A sweep finds the best level
  empirically and compares it with the textbook level, which motivates search and
  learning (Axsäter, 2015, pp. 97–99; Snyder and Shen, 2019, pp. 136–138;
  Simchi-Levi, Chen and Bramel, 2014, pp. 169–172).
- **Random lead times** [M10; template `classic.safety_stock`; book chapter 7]. Variable visit intervals add to the safety stock
  needed even when demand is steady. The run log supplies the interval variance
  (Axsäter, 2015, pp. 100–101; Snyder and Shen, 2019, pp. 166–167).

### 8.2 Networks of stations and disruptions

- **Echelon stock** [M10; template `classic.serial_chain`]. In a chain of stations, decide from a station's own
  stock plus everything downstream and in transit. In simple serial systems this is
  optimal, and upstream stock is often best kept low. An `echelon_position` target
  removes dead stock at relays (Snyder and Shen, 2019, pp. 191–197; Axsäter, 2015,
  pp. 192–198).
- **Local versus central control** [M8]. Rules that see only their own station react
  to changes late, and the gap grows with lead time. Comparing the `local` and
  `line` information levels across train speeds shows the value of information
  (Axsäter, 2015, pp. 153–160, 167–168).
- **Where to hold buffers** [M10]. Strategic safety stock placement keeps buffers at
  a few stages and lets the rest pass goods through. A heatmap splits a fixed buffer
  between relays and end stations (Snyder and Shen, 2019, pp. 203–222).
- **Allocating scarce stock** [M4, M10]. When cargo cannot cover every station
  ahead, an allocation rule decides who goes short. Priority, proportional and
  balanced allocation are compared. A relay between two demand ends shows when
  holding stock centrally pays (Snyder and Shen, 2019, pp. 202–203; Axsäter, 2015,
  pp. 198–201).
- **METRIC approximation** [M10]. Shortages upstream appear downstream as extra
  waiting time. An estimator of travel plus waiting time feeds the target block
  (Axsäter, 2015, pp. 201–205).
- **Risk pooling** [M10]. Pooling independent demands cuts the stock needed, because
  variances add but standard deviations do not. A storm that raises all demand at
  once makes the benefit vanish (Snyder and Shen, 2019, pp. 230–237).
- **Lateral transshipment** [M10]. Move stock sideways from surplus to shortage,
  never between two surpluses. In the simulator transfers take time, so only
  proactive rules help. A `transship` rule targets ping-pong (Snyder and Shen, 2019,
  pp. 240–243; Axsäter, 2015, pp. 151–152).
- **Flexibility and chaining** [Research]. A long chain of overlapping assignments
  captures most of the benefit of full flexibility. Trains are assigned to
  overlapping segments of a line and tested under storms (Snyder and Shen, 2019,
  pp. 243–253; Simchi-Levi, Chen and Bramel, 2014, pp. 241–243).
- **Supply disruptions** [M10]. Supply that switches between up and down follows a
  two-state Markov process, like storms and bursts. With steady demand, the optimal
  buffer covers outages up to a chosen length. A `disruption_buffer` target sizes it
  from the storm process, and uniformly random production stands in for uncertain
  yield (Snyder and Shen, 2019, pp. 355–372).
- **Diversification and reliability** [M8]. Centralising stock under disruptions
  keeps the mean cost the same but raises its variance. Components in series or in
  parallel set overall reliability. Batches report the spread across seeds and the
  worst shortfalls, not just means (Snyder and Shen, 2019, pp. 372–387; Eiselt and
  Sandblom, 2022, pp. 440–445, 450–451).
- **The bullwhip effect** [M8, M10; template `classic.serial_chain`]. Variability grows upstream through forecasting,
  rationing and batching, and sharing demand information reduces it. The ratio of
  cargo variance to consumption variance is reported per station. A moving-average
  estimator shows how window length and lead time drive it (Snyder and Shen, 2019,
  pp. 539–562; Axsäter, 2015, pp. 167–168).

### 8.3 Optimisation, transport and bounds

- **Time-expanded network flow** [M8]. A copy of each station for every period,
  joined by storage and train arcs, turns a whole run into a minimum-cost flow
  problem. This is the natural form of the perfect-foresight bound, and its minimum
  cut marks the bottleneck on the line map. Resources sharing a train make it a
  multicommodity problem (Eiselt and Sandblom, 2022, pp. 220–230; Simchi-Levi, Chen
  and Bramel, 2014, pp. 264–266; Boyd and Vandenberghe, 2004, p. 193).
- **Duality and shadow prices** [M8]. Each dual value prices one more unit of a
  limited resource, and spare capacity is worth nothing. The bound reports what more
  train capacity or storage would be worth (Taha, 2017, pp. 178–182; Boyd and
  Vandenberghe, 2004, pp. 251–253).
- **The transportation problem** [M7]. Ship from supply to demand at least cost,
  with a dummy source standing for shortage. A one-trip teaching scenario sets the
  dummy cost to resource priority (Taha, 2017, pp. 207–214; Eiselt and Sandblom,
  2022, p. 183).
- **Relaxations and optimality gaps** [M8]. Relaxing integrality gives a bound. The
  gap between the best solution and the best bound measures how far there is to go.
  The headline score is the share of the gap between baseline and bound that a
  policy closes, and the app explains why no online policy can close all of it
  (Eiselt and Sandblom, 2022, pp. 165–168; Simchi-Levi, Chen and Bramel, 2014,
  pp. 9–10, 99; Snyder and Shen, 2019, pp. 442–452).
- **Knapsack loading** [M10]. Filling by value per unit is exact for divisible
  cargo, while greedy loading of indivisible items can reach only half the optimum.
  A fractional knapsack allocation values cargo by priority and downstream shortfall
  (Eiselt and Sandblom, 2022, pp. 170–172, 194–197; Taha, 2017, pp. 475–480).
- **Dynamic lot sizing and rolling horizons** [M10]. With known but varying demand
  and a fixed cost per delivery, deliver only when stock runs out, and re-plan as
  forecasts change. This is the theory behind line-wide planning (Simchi-Levi, Chen
  and Bramel, 2014, pp. 137–143; Eiselt and Sandblom, 2022, pp. 45–49).
- **Inventory routing** [M8, M10; template `classic.fixed_route_delivery`]. Decide jointly when, how much and on which route
  to deliver. Regolith Rail is inventory routing with a fixed route. A relief-style
  variant scores the worst station's shortfall (Snyder and Shen, 2019, pp. 531–534,
  632–635).
- **Fairness** [M10]. Minimising the largest shortfall is a linear program with one
  extra variable, and it should be balanced against efficiency. A metric toggle
  compares total with worst-station unmet demand (Eiselt and Sandblom, 2022,
  pp. 179–181; Boyd and Vandenberghe, 2004, pp. 150–151; Snyder and Shen, 2019,
  pp. 309–314).
- **Pareto frontiers** [M6]. With several objectives, compare the policies no other
  policy beats on every objective. A batch scatter of unmet demand against empty
  distance highlights them (Eiselt and Sandblom, 2022, pp. 125–133).
- **Routing problems** [M7]. The travelling salesman, vehicle routing, backhaul and
  pickup-and-delivery problems explain what a fixed shuttle gives up. Empty distance
  measures missed backhauls (Snyder and Shen, 2019, pp. 404–406, 500–501).
- **Facility location** [Research]. Decide which station should become a
  large-storage relay by computing the bound for each candidate (Snyder and Shen,
  2019, pp. 269–270; Eiselt and Sandblom, 2022, pp. 285–290).
- **Metaheuristics** [M10, Research]. Local search stops at local optima; tabu
  search, simulated annealing and genetic algorithms escape them. They drive
  parameter tuning and genetic programming. Results are scored on held-out seeds,
  because heuristics tuned to one test set can fail on the next (Taha, 2017,
  pp. 397–415; Brémaud, 2020, pp. 408–420; Simchi-Levi, Chen and Bramel, 2014,
  pp. 9–10).

### 8.4 Randomness, simulation and statistics

- **Geometric waits and Poisson processes** [M7; book chapter 3]. A storm that starts with a small
  chance at every check has geometric, nearly exponential waiting times, and is
  never "due". A storm clock plots the gaps against both curves (Brémaud, 2020,
  pp. 23–25, 423–428; Taha, 2017, pp. 656–660).
- **Two-state Markov chains** [M7]. Bursty producers switch on and off with fixed
  chances. The long-run share of time on, the mean run lengths and the slow approach
  to equilibrium follow directly. Equal mean rates with different run lengths show
  that burstiness, not the mean, drains buffers (Brémaud, 2020, pp. 86, 159; Taha,
  2017, pp. 634–635).
- **Random walks with replenishment** [M7]. Stock at one station under a min–max
  rule is a random walk whose long-run distribution can be computed and compared
  with the simulation (Brémaud, 2020, pp. 128–135; Taha, 2017, pp. 661–662).
- **Queues and Little's law** [M7; Little's law in book chapter 2, queues in
  Part V]. Birth–death queues show variability growing sharply as supply
  approaches demand. Little's law turns average stock and throughput into the
  average time goods spend at a station. Known queueing results
  also validate the engine (Brémaud, 2020, pp. 500–502; Taha, 2017, pp. 667–668;
  Eiselt and Sandblom, 2022, p. 475).
- **Monte Carlo and the number of seeds** [M6; book chapter 3]. Standard error falls with the square
  root of the number of runs, so halving an interval takes four times the seeds. The
  batch view recommends a seed count for a target precision (Brémaud, 2020, p. 369;
  Wasserman, 2004, pp. 404–405; MacKay, 2003, pp. 357–358).
- **Pseudo-random numbers** [M7]. Seeded generators give repeatable sequences, and
  inverse transform sampling turns uniform draws into other distributions. A toy
  generator with a short cycle contrasts with the engine's generator (Taha, 2017,
  pp. 720–722; Eiselt and Sandblom, 2022, pp. 475–478; Brémaud, 2020, pp. 370–371).
- **Common random numbers and paired comparison** [M6; book chapter 3]. Running both policies on
  the same randomness correlates their results, so the variance of the difference
  drops. A paired versus independent toggle shows the interval shrink. Separate
  random streams per source keep the two runs aligned (Wasserman, 2004, pp. 52,
  154–155; Eiselt and Sandblom, 2022, pp. 483–485).
- **Confidence intervals and practical significance** [M6; book chapter 3]. A difference is
  significant when its interval excludes zero, but it may still be too small to
  matter, so players can set the smallest difference they care about (Wasserman,
  2004, pp. 155, 170).
- **Warm-up and regenerative cycles** [M6]. Early output is transient and should be
  discarded. The renewal–reward theorem predicts long-run averages, such as the
  share of time spent in storms, from cycle means (Taha, 2017, pp. 728–731;
  Brémaud, 2020, pp. 135–136; Eiselt and Sandblom, 2022, p. 474).
- **The bootstrap** [M6]. Resampling whole seeds gives intervals for medians and
  tail percentiles, shown next to the t interval (Wasserman, 2004, pp. 107–111).
- **Multiple comparisons** [M6]. Testing many metrics, stations and sweep cells
  inflates false positives. Bonferroni and Benjamini–Hochberg corrections are
  offered as a toggle (Wasserman, 2004, pp. 165–167).
- **Overfitting and held-out seeds** [M10]. Tuned parameters score better on the
  seeds they were tuned on than on new ones. The tuner shows both scores, and the
  benchmark keeps a locked evaluation set (Deisenroth, Faisal and Ong, 2020,
  pp. 262–264; Wasserman, 2004, p. 219).

### 8.5 Forecasting and estimation

- **Moving averages and exponential smoothing** [M4, M10; template `classic.forecasting`; book chapter 8]. Forecast consumption
  between visits, with Holt's method adding a trend, and track forecast error. A
  storm shows the trade-off between lag and responsiveness, and a demand ramp shows
  why the trend term matters (Snyder and Shen, 2019, pp. 6–17).
- **Forecast error and censored demand** [M10]. Safety stock should use forecast
  error, which grows faster than the square root of the horizon when errors are
  correlated. A station that runs dry records what was taken, not what was wanted,
  so estimates drift low and cause more stockouts. A realistic mode hides true
  demand from policies (Axsäter, 2015, pp. 28–29; Snyder and Shen, 2019,
  pp. 90–101).
- **Kalman filtering** [M10]. A predict-and-update filter estimates stock and
  consumption rate from irregular visits. Its uncertainty band shows the balance
  between process and measurement noise (Särkkä, 2013, pp. 34–37, 52, 56–59).
- **Transients after retuning** [M10]. Raising reorder levels triggers a wave of
  deliveries while lowering them acts slowly, so retuning during a storm can make
  things worse (Axsäter, 2015, pp. 231–232).

### 8.6 Feedback control

- **Feedback and feed-forward** [M4]. Feedback corrects errors after they appear;
  feed-forward acts on predicted disturbances and needs a model. Balancing is
  feedback, and lookahead is feed-forward (Åström and Murray, 2008, pp. 22, 319–320;
  Albertos and Mareels, 2010, pp. 59–64).
- **Proportional control and steady-state error** [M4]. The game's balancing rule
  behaves like a proportional controller whose gain is the share of the imbalance
  moved per visit. A steady drain then settles below target, which is the operating
  at the edge failure. Higher gain reduces the offset but causes oscillation (Åström
  and Murray, 2008, pp. 23–24, 294–295; Dorf and Bishop, 2011, pp. 322–324).
- **PID control** [M10]. Integral action removes steady-state error, learning a
  station's net drain without being told the rate. Derivative action needs
  filtering. A PID block keeps its integrator in memory (Åström and Murray, 2008,
  pp. 295–297, 308, 311–312; Albertos and Mareels, 2010, pp. 193–194, 238).
- **Saturation and integrator windup** [M10]. Train capacity, station capacity and
  empty stations all saturate. During a long storm an integrator winds up and later
  over-delivers. Anti-windup prevents it, and a chart of commanded against applied
  loads shows the difference (Åström and Murray, 2008, pp. 306–308, 311–312).
- **On–off control and hysteresis** [M4]. Min–max is a relay with hysteresis, and
  its band sets the size and period of the resulting cycle. Relay experiments also
  reveal the critical gain used by tuning rules (Åström and Murray, 2008, pp. 23–24,
  292, 305–306; Albertos and Mareels, 2010, p. 237).
- **Dead time and sampling** [M6, M10]. Stock integrates flow, and the visit interval
  is both a delay and a sampling period. Proportional control of an integrator with
  delay is unstable above a certain gain. A stability map over gain and train
  spacing explains ping-pong. The fixes are lower gain, rate limits, smoothing and
  gain scheduled on the observed interval (Albertos and Mareels, 2010, pp. 13, 192;
  Åström and Murray, 2008, pp. 281, 292, 333; Dorf and Bishop, 2011, pp. 668–670,
  999–1000).
- **Step response and recovery time** [M8]. Settling time, overshoot and integrated
  error after a disturbance define recovery after a storm. They are reported by
  shock size, because capacity limits make recovery nonlinear (Åström and Murray,
  2008, p. 151; Albertos and Mareels, 2010, pp. 63, 135–136).
- **Partial information and observers** [M8]. Controllers see only part of the
  state, and observers reconstruct the rest from a model. The information levels
  make this concrete (Åström and Murray, 2008, pp. 201, 206; Albertos and Mareels,
  2010, p. 273).
- **Receding-horizon control** [M10]. Optimise over a horizon, apply the first step
  and re-plan. Lookahead is a simple form, and the distance to the perfect-foresight
  bound is the value of information (Albertos and Mareels, 2010, p. 272;
  Hernández-Lerma et al., 2023, p. 5).

### 8.7 Sequential decisions and learning

- **Markov decision processes and dynamic programming** [Research]. The Bellman
  equation defines optimal policies, which value or policy iteration finds, and the
  state space explodes as variables are added. A tiny two-station scenario is solved
  exactly in the browser, and its policy is shown beside balancing. The car rental
  example in Sutton and Barto is a close analogue (Sutton and Barto, 2015, pp. 67,
  75–76, 96–98; Hernández-Lerma et al., 2023, pp. 4, 50–51, 83–85; Taha, 2017,
  p. 489).
- **Reinforcement learning** [Research]. A constant step-size average is the same
  update as exponential smoothing. Bandits capture the trade-off between exploring
  and exploiting. Q-learning and Sarsa learn the value of actions, and function
  approximation, including decision trees, generalises across states. Q-learning's
  risky optimal path, against Sarsa's safer one, mirrors running stock close to
  empty. Learning on a live line costs service, because exploring disturbs it
  (Sutton and Barto, 2015, pp. 32–33, 38–39, 64–65, 154–158, 226, 257–261; Albertos
  and Mareels, 2010, p. 274).

§8.9 outlines the chapters that would teach these entries.

### 8.8 Capabilities the book waits for

Some of the book's examples need things the simulator cannot yet do. The chapter keeps the example and its
checked mathematics, and shows a placeholder that links here. `PLACEHOLDERS` in `packages/docs/src` lists
the same entries, and `pnpm docs:check` prints which chapters are waiting on which.

#### mars-poisson-consumer

Poisson demand for consumers in the `mars` pack, as the core format already offers. Chapter 3 uses it to
estimate the chance a dome runs out during a round trip, a probability with a known answer.

#### mars-dispatch-interval

Timetable routes and a fixed cost per trip in the `mars` pack. Chapter 4 uses them to show the order-quantity
trade-off on a line: running the train less often saves trips and holds more stock.

#### normal-per-period-demand

Normally distributed per-period demand. Chapter 5 uses it for the newsvendor with normal demand, where the
model gives the optimal order and the cost of uncertainty in closed form.

#### service-level-metrics

Cycle service level and fill rate as run and batch metrics. Chapter 7 compares both with their models.

#### smooth-seasonal-demand

A seasonal demand profile smoother than two levels. Chapter 8 uses it for seasonal indices, which Winters'
method estimates.

### 8.9 Outline for a part on decisions and learning

This subsection outlines seven chapters that would form a sixth part of the book,
with the working title *Decisions and learning*. It expands §8.7 and the learning
entries of §8.4 and §8.5 into chapters. The part belongs to the research track, and
Parts III to V come first. If Part IV or Part V takes dynamic programming, D1 and
D2 move there and the other five chapters stand as they are.

The labels D1 to D7 are provisional and follow the order of dependence. The
outlines below group the chapters by topic.

| Label | Chapter | Topic | Builds on | Scenario |
|---|---|---|---|---|
| D1 | Many periods: dynamic programming | Dynamic programming and reinforcement learning | Chapters 4 to 6 | `classic.reorder`, cut down |
| D2 | The long run: discounted and average cost | Dynamic programming and reinforcement learning | D1, chapter 2 | A two-station line with every state listed |
| D3 | Bayesian estimation of demand | Bayesian forecasting and filtering | Chapters 5, 7 and 8 | `classic.newsvendor` with an unknown rate |
| D4 | Hidden states and filtering | Bayesian forecasting and filtering | D2, D3, chapter 8 | A line with a bursty consumer; `classic.forecasting` |
| D5 | Choosing among policies: bandits | Bandits and simulation optimisation | Chapter 3, D3 | `two-station` with four candidate policies |
| D6 | Learning values from runs | Dynamic programming and reinforcement learning | D2, D5 | The line of D2, model withheld |
| D7 | Tuning a policy: simulation optimisation | Bandits and simulation optimisation | D5, D6 | One site with lost sales; `classic.serial_chain` |

Each outline lists the statements of the chapter's model section, its simulations
and what the simulator lacks. A statement marked *prove* has a short proof that
uses a technique the reader meets again. A statement marked *cite* appears with
its source and no proof, as the book's style guide directs. Every simulation sets
a value the model predicts beside the value a batch measures, in a `<Predicted>`
table with a simulator check.

#### Dynamic programming and reinforcement learning

Part II takes the form of a good policy as given: order up to a level, or reorder
at a minimum. Dynamic programming derives those forms, and gives exact answers on
small scenarios. Reinforcement learning estimates the same quantities from runs
when no transition model is at hand. The exact answers of D1 and D2 are the
predictions that D6 is tested against.

**D1. Many periods: dynamic programming**

Chapter 5 solves one period. Chapters 4 and 6 state a many-period policy and tune
it. This chapter derives the policy by backward induction.

*Model*
- Definition: a finite-horizon Markov decision process, with states, actions, a
  transition law, a cost per period and a horizon. A policy is one decision rule
  per period.
- Theorem (backward induction), *prove* by induction on the periods remaining. The
  optimal cost-to-go satisfies `V_t(x) = min_a { c(x, a) + E V_{t+1}(X') }`, and a
  rule that attains the minimum in every period is optimal (Snyder and Shen, 2019,
  ch. 4; Taha, 2017, p. 489).
- Running example: one site reviewed every period, no lead time, backorders, unit
  ordering cost `c`, holding cost `h`, backorder cost `p` and demand `D` per period.
- Lemma (convexity is preserved), *prove*. If `V_{t+1}` is convex, then so are
  `y ↦ L(y) + E V_{t+1}(y − D)` and `V_t`, where `L` is the one-period cost of
  chapter 5.
- Theorem (base-stock policies are optimal), *prove* from the lemma. Every period
  has a level `S_t`, and the optimal order raises the inventory position to `S_t`
  whenever it is below.
- Proposition (the myopic level), *prove* by telescoping the ordering cost. With
  stationary demand, leftover stock credited at `c` when the horizon ends and
  starting stock at most `S`, every `S_t` equals the newsvendor level `S` with
  `F(S) = p / (p + h)`.
- Theorem (Scarf), *cite*. With a fixed cost `K` per order the cost-to-go is
  K-convex, and an `(s_t, S_t)` policy is optimal (Scarf, 1960; Simchi-Levi, Chen
  and Bramel, 2014, pp. 155–157).
- Remark: with lost sales and a lead time the state holds every outstanding order,
  and no base-stock or `(s, S)` form is optimal (§8.1; Zipkin, 2008).
- Remark: the number of states grows as a power of the number of sites and
  outstanding orders, which confines exact solution to small scenarios.

*Simulations*
- Scenario: `classic.reorder` cut down to a short horizon, a review every period
  and a demand table of a few values, so that a check script runs the recursion.
- Run the order-up-to policy at the computed level, then one step above and one
  step below. The recursion predicts each expected total cost.
- Add a fixed cost per order. Run the min–max policy at the computed `(s, S)` and
  the order-up-to policy. The recursion predicts both costs.
- Exercise: lost sales with a lead time of one period. The recursion on the
  two-part state gives a cost at or below the best order-up-to level's, and the
  exercise measures the gap.

*Needs*
- No engine change. Per-period demand tables, order costs, holding costs and
  backorder costs exist in format 2.
- The recursion as a Python check, and a statement in "Where the simulator
  differs" of how the engine accrues holding cost within a period.

**D2. The long run: discounted and average cost**

Runs are long, and the simulator reports long-run averages. This chapter replaces
the horizon with a stationary problem and gives two algorithms that solve it.

*Model*
- Definitions: a stationary policy, the discounted cost with factor `γ`, the
  long-run average cost, and the Bellman operator `T`.
- Theorem (contraction), *prove* in two lines, with Banach's theorem *cite*. `T`
  contracts the supremum norm by `γ`, so it has one fixed point `V*`, and the policy
  that is greedy for `V*` is optimal (Hernández-Lerma et al., 2023, pp. 38, 46–49).
- Corollary (value iteration), *prove*. After `k` sweeps the error is at most `γ^k`
  times the starting error, and the gap between two successive iterates bounds
  the error that remains.
- Proposition (policy evaluation), *prove*. The cost of a stationary policy solves
  the linear system `(I − γ P_π) V_π = c_π`.
- Theorem (policy iteration), *prove* the improvement step. Each step returns a
  policy at least as good, and with finitely many policies the method stops at an
  optimal one (Hernández-Lerma et al., 2023, pp. 51–54; Sutton and Barto, 2015,
  pp. 96–98).
- Theorem (average-cost optimality equation), *cite*. Under a unichain assumption
  a constant `g` and a function `h` satisfy `g + h(x) = min_a { c(x, a) + E h(X') }`.
  The constant is the least long-run average cost, and relative value iteration
  computes the pair (Puterman, 1994, ch. 8; Hernández-Lerma et al., 2023, sec. 2.5
  and 3.7).
- Remark: stops and reviews fall at irregular times, so the simulator's decision
  process is semi-Markov. The equation becomes
  `h(x) = min_a { c(x, a) − g τ(x, a) + E h(X') }`, with `τ` the expected time to
  the next decision (Puterman, 1994, ch. 11; Sutton and Barto, 2015, p. 288).
- Remark: `g` is the quantity a batch's long-run average cost estimates, and the
  flow balance of chapter 2 constrains every stationary policy.

*Simulations*
- Scenario: a two-station line with one shuttle, stock counted in a few train
  loads and demand per period, small enough to list every state. §8.7 already
  plans this scenario.
- Run the two policies of chapter 1, balancing and drain-and-fill, and then the
  policy that policy iteration returns. The linear system predicts each policy's
  average cost per sol.
- Plot the error of value iteration after each sweep against `γ^k`.
- Exercise: raise the backorder cost and rerun the solver. The solver predicts how
  much more stock the optimal policy keeps at the demand station.

*Needs*
- A transition model for a small scenario: listed from the scenario by a tool, or
  written by hand and checked against the engine on every transition.
- The in-browser solver that §8.7 plans, and total cost per sol as a batch metric.

**D6. Learning values from runs**

D2 needs the transition model. This chapter estimates the same values from
simulated runs alone.

*Model*
- Definition: Monte Carlo evaluation, the average of the cost that followed each
  visit to a state.
- Proposition, *prove*. The running mean is the update `V ← V + (G − V)/n`, and a
  constant step in place of `1/n` is the exponential smoothing of chapter 8
  (Sutton and Barto, 2015, pp. 36–39).
- Theorem (Robbins and Monro), *cite*. With step sizes whose sum diverges and whose
  squares have a finite sum, the noisy iteration converges to the root it seeks
  (Robbins and Monro, 1951; Sutton and Barto, 2015, p. 39).
- Definition: the temporal-difference error and TD(0).
- Proposition, *prove*. The expected TD(0) update is zero exactly at the solution
  of D2's linear system.
- Theorem (convergence of TD(0)), *cite*. Tabular TD(0) converges to `V_π` with
  probability one under the Robbins–Monro step sizes (Sutton and Barto, 2015,
  p. 148).
- Definitions: action values, Sarsa and Q-learning.
- Theorem (Watkins and Dayan), *cite*. Tabular Q-learning converges to the optimal
  action values with probability one when every state–action pair recurs and the
  step sizes meet the same conditions (Watkins and Dayan, 1992; Sutton and Barto,
  2015, pp. 157–159).
- Definition: an afterstate, the stock after an order or a load and before demand.
  Values on afterstates need one table entry per stock level in place of one per
  state–action pair (Sutton and Barto, 2015, pp. 160–161).
- Remark: average-cost learning replaces the discount with a running estimate of
  `g`, which matches D2's criterion (Sutton and Barto, 2015, pp. 260–263).
- Definition: a linear value approximation `V(x) ≈ θ·φ(x)` and semi-gradient TD(0).
- Theorem (Tsitsiklis and Van Roy), *cite*. On-policy linear TD(0) converges, and
  its error is within the factor `1/(1 − γ)` of the best approximation the features
  allow (Tsitsiklis and Van Roy, 1997).
- Remark: off-policy updates that bootstrap through an approximation can diverge
  (Baird, 1995).
- Remark: exploring on a live line costs service (§8.7).

*Simulations*
- Scenario: the line of D2, with the transition model withheld from the learner.
- Evaluate the balancing baseline by Monte Carlo and by TD(0) at two step sizes.
  D2's linear system predicts the limit, and the chapter plots the
  root-mean-square error against the number of runs.
- Train Sarsa and Q-learning. D2 predicts the least average cost `g*`; the chapter
  reports each greedy policy's cost beside it, and the cost paid while exploring.
- A five-station line beyond exact solution: linear TD(0) on stock per site, stock
  on order, cargo and train position. The comparison is the best tuned base-stock
  policy of D7 and the perfect-foresight bound of M8.

*Needs*
- A training loop that carries a table or weights from run to run, since a
  policy's `memory` lasts one run. The research track's environment over the engine
  serves, or a `cli` command.
- An exporter that writes a learned table as a Lua policy, so the workbench runs
  and shares it. `ctx.rand()` already gives policies seeded exploration.

#### Bayesian forecasting and filtering

Chapter 8 forecasts a mean and chapter 7 sizes safety stock around it. These two
chapters carry a whole distribution: over an unknown demand rate in D3, and over
a state the policy cannot see in D4. Exponential smoothing reappears as the
steady state of a Kalman filter.

**D3. Bayesian estimation of demand**

Chapters 5 to 7 take the demand distribution as known. This chapter carries the
uncertainty about its rate into the order.

*Model*
- Definitions: prior, likelihood, posterior and posterior predictive distribution.
- Proposition (gamma–Poisson), *prove*. A Gamma(`a`, `b`) prior on a Poisson rate
  and a total demand `s` over `n` periods give a Gamma(`a + s`, `b + n`) posterior.
  Its mean is a weighted average of the prior mean and the sample mean (Wasserman,
  2004, p. 179; MacKay, 2003, p. 319).
- Proposition (predictive demand), *prove*. The next period's demand is negative
  binomial with mean `(a + s)/(b + n)` and a variance larger than the mean by the
  factor `1 + 1/(b + n)`.
- Corollary: the critical-ratio quantile of the predictive distribution replaces
  the Poisson quantile at the estimated rate, and the two agree as `n` grows.
- Proposition (censoring), *prove*. With lost sales, a period that ends empty
  records `min(D, y)` for starting stock `y`. Its mean is below `E D`, so an
  estimate that treats sales as demand is biased low. The likelihood of such a
  period is the tail probability `P(D ≥ y)`.
- Remark: under censoring the gamma prior is no longer conjugate, and a grid over
  the rate gives the posterior.
- Remark: a larger order reveals more demand, so the order also buys information.
  D1's recursion on the pair of stock and posterior parameters prices it, and D5
  studies the same trade.

*Simulations*
- Scenario: `classic.newsvendor` with Poisson demand at a rate the policy does not
  know. The policy keeps `a` and `b` in `memory`.
- Run the plug-in policy, which orders the Poisson quantile at the sample mean,
  and the predictive policy over the first periods. Exact enumeration predicts
  each expected cost per period, and the gap closes as periods pass.
- Switch to lost sales. Run an estimator that treats sales as demand and one that
  uses the censored likelihood. The model predicts the bias of the first (§8.5,
  forecast error and censored demand).

*Needs*
- No engine change: format 2 has Poisson flows and lost sales.
- An `ops` estimate block that holds posterior parameters (the estimate stage of
  M4 and M10).

**D4. Hidden states and filtering**

A bursty consumer is on or off, and a policy sees only the stock it has drawn.
This chapter computes what the policy can know about the hidden state.

*Model*
- Definition: a hidden Markov model, a Markov chain the policy cannot see with an
  observation whose distribution depends on the chain's state.
- Running example: a consumer that switches on with chance `a` and off with chance
  `b` per game minute, observed through the stock drawn between visits.
- Proposition (two-state chain), *prove* from the eigenvalues. The long-run share
  of time on is `a/(a + b)`, and the memory of the starting state decays as
  `(1 − a − b)^k` (§8.4; Brémaud, 2020, pp. 86, 159).
- Theorem (filtering recursion), *prove* from Bayes' rule and the Markov property.
  Predict with the transition matrix, then multiply by the likelihood of the
  observation and normalise (Särkkä, 2013, pp. 54, 62; Rabiner, 1989).
- Definition: the local level model, a level that follows a random walk with
  variance `q` per period, observed with noise of variance `r`.
- Theorem (Kalman filter), *prove* in the scalar case as a normal–normal update,
  with the general case *cite* (Särkkä, 2013, pp. 56–59).
- Proposition (steady state), *prove* by solving a quadratic. With `ρ = q/r` the
  gain converges to `α = (√(ρ² + 4ρ) − ρ)/2`, and the filter is then simple
  exponential smoothing with constant `α` (Muth, 1960; Särkkä, 2013, p. 62).
- Corollary: chapter 8's smoothing constant has an optimal value for given `q` and
  `r`, and the one-step forecast error then has variance `r/(1 − α)`.
- Remark: between irregular visits the level's variance grows with the time
  elapsed, so the gain is larger after a long gap (§8.5, Kalman filtering).
- Definition: a belief state. Theorem, *cite*: a decision process with a partly
  hidden state is a Markov decision process on beliefs (Smallwood and Sondik,
  1973). The `local` information level hides other stations' stock, so a `local`
  policy that filters approaches a `line` policy (§8.2, local versus central
  control; §8.6, partial information and observers).

*Simulations*
- Scenario: a two-station line whose consumer has `bursts` variability with known
  switching chances.
- Run an order-up-to policy sized for the long-run mean rate, and one whose level
  follows the filtered chance that the consumer is on. The model predicts the
  share of time on, and the filter's calibration: among stops where it reports a
  chance near `x`, the consumer is on in a share `x`.
- Scenario: `classic.forecasting` with a random-walk level supplied as a trace. Run
  exponential smoothing at the steady-state `α` and at two other constants. The
  model predicts the forecast error variance at each.
- Run the filtering policy at `local` and the unfiltered policy at `line`. The
  difference in cost measures what the filter recovers.

*Needs*
- A trace generated offline for the random-walk level. Normal per-period demand
  (`normal-per-period-demand` in §8.8) would let a scenario script build it.
- The share of time a bursty flow is on, as a run output.

#### Bandits and simulation optimisation

Chapter 3 compares two policies on a fixed number of seeds. These two chapters
decide where to spend runs: among a few policies in D5, and across a policy's
parameters in D7. Both lean on chapter 3's confidence intervals and common random
numbers.

**D5. Choosing among policies: bandits**

This chapter decides, run by run, which of several policies to run next and when
to stop.

*Model*
- Definition: a bandit with `K` arms. An arm is a policy, a pull is one run on a
  new seed, and the reward is the negative cost scaled to `[0, 1]`. Regret is the
  expected cost above that of running the best policy every time.
- Proposition (regret decomposition), *prove*. Regret equals the sum over arms of
  the arm's gap `Δ_a` times its expected number of pulls.
- Theorem (Hoeffding's inequality), *cite* (Wasserman, 2004, pp. 64–67).
- Theorem (UCB1), *cite* with a sketch of the proof. Running the arm with the
  largest `mean + √(2 ln t / n_a)` gives regret at most
  `8 Σ (ln n)/Δ_a + (1 + π²/3) Σ Δ_a` after `n` pulls (Auer, Cesa-Bianchi and
  Fischer, 2002; Sutton and Barto, 2015, p. 41).
- Theorem (Lai and Robbins), *cite*. No consistent rule has regret that grows
  slower than a constant times `ln n`, and the Kullback–Leibler divergences between
  the arms set the constant (Lai and Robbins, 1985).
- Definition: Thompson sampling. Draw a mean from each arm's posterior and run the
  arm with the best draw. D3 supplies the posteriors (Thompson, 1933).
- Definition: best-arm identification at confidence `1 − δ`.
- Theorem (successive elimination), *cite*. Dropping every arm whose upper bound
  falls below another arm's lower bound returns the best arm with probability at
  least `1 − δ`, after a number of runs of order `Σ Δ_a^{-2} ln(K/(δ Δ_a))`
  (Even-Dar, Mannor and Mansour, 2006).
- Proposition (paired elimination), *prove*. On common seeds
  `Var(X − Y) = Var X + Var Y − 2 Cov(X, Y)`. With equal variances and correlation
  `ρ`, the runs needed to separate two policies fall by the factor `1 − ρ`.
- Remark: the union bound over arms in the elimination proof is the Bonferroni
  correction of §8.4.

*Simulations*
- Scenario: `two-station` with four candidate policies: the balancing baseline,
  drain-and-fill, order-up-to at a low level and order-up-to at a high level.
- Run uniform allocation and successive elimination to the same confidence, many
  times over. The model predicts that each selects the best policy in a share of
  at least `1 − δ` of the experiments, and bounds the runs elimination uses.
- Plot the regret of explore-then-commit, ε-greedy, UCB1 and Thompson sampling.
  The model predicts UCB1's curve below its bound and the Lai–Robbins slope below
  every curve in the long run.
- Run elimination on common seeds and on independent seeds. The measured
  correlation predicts the ratio of runs.

*Needs*
- A batch runner that allocates seeds a round at a time. The M6 runner takes its
  list of seeds before it starts.
- A `cli` harness that repeats a whole selection experiment many times.

**D7. Tuning a policy: simulation optimisation**

Most policies in the book have a few numbers to set. This chapter treats their
choice as the minimisation of an expected cost that only runs can estimate.

*Model*
- Definitions: a policy family indexed by a parameter vector `θ`, the objective
  `J(θ)` as the expected cost over seeds, and the sample average of the cost on a
  fixed set of seeds.
- Theorem (consistency), *cite*. Over a finite set of parameter values, the chance
  that the minimiser of the sample average fails to minimise `J` falls
  exponentially in the number of seeds (Kleywegt, Shapiro and Homem-de-Mello,
  2002).
- Proposition (optimism of the tuned score), *prove* in one line. The expected
  minimum of the sample average is at most the minimum of `J`, so the score on the
  tuning seeds flatters the tuned policy. Held-out seeds give an unbiased
  estimate (§8.4, overfitting and held-out seeds).
- Proposition (finite differences), *prove*. A difference quotient with step `d`
  has variance `(Var X + Var Y − 2 Cov(X, Y))/d²`, and common seeds raise the
  covariance.
- Theorem (simultaneous perturbation), *cite*. Perturbing every parameter at once
  estimates the gradient from two runs whatever the dimension, and the iteration
  converges under step-size conditions of the Robbins–Monro kind (Spall, 1992).
- Theorem (score-function gradient), *prove* with the log-derivative identity. For
  a randomised policy `∇J(θ) = E[ Σ_t ∇ log π_θ(A_t | X_t) G_t ]`, and subtracting a
  baseline that depends only on the state leaves the mean unchanged (Williams,
  1992; Sutton and Barto, 2015, ch. 11).
- Definition: a Gaussian-process model of `J`. Proposition, *prove* by conditioning
  a joint normal: the posterior mean and variance of `J` at a new `θ` (Deisenroth,
  Faisal and Ong, 2020, p. 198; MacKay, 2003, ch. 45).
- Definition: expected improvement, with its closed form *cite* (Jones, Schonlau
  and Welch, 1998).
- Remark: stock levels are integers, and one run's cost is a step function of a
  level. Search without derivatives suits level parameters, and the score-function
  gradient suits randomised policies.
- Remark: a learned policy becomes readable when a decision tree fitted to its
  decisions is emitted as Lua (research track). The metaheuristics of §8.3 are
  alternatives to every method here.

*Simulations*
- Scenario: one site with lost sales and a lead time, the case §8.1 leaves to
  search. Tune the order-up-to level by a full sweep. Then tune it by simultaneous
  perturbation and by Gaussian-process search with expected improvement. The
  methods should agree within the batch interval, and the chapter reports the
  runs each uses beside the exact optimum from D1's recursion.
- Score the tuned level on the tuning seeds and on held-out seeds. The model
  predicts the sign of the gap and that it shrinks as seeds are added.
- Scenario: `classic.serial_chain` with backorders. Tune one echelon level per
  stage. The model predicts the Clark–Scarf levels (§8.2; Clark and Scarf, 1960;
  Axsäter, 2015, pp. 192–198).
- Estimate a finite difference on common seeds and on independent seeds. The
  measured correlation predicts the ratio of the variances.
- The line of D2 with a randomised policy over load sizes, trained by the
  score-function gradient with and without a baseline. The model predicts equal
  mean gradients and D2 supplies `g*`.

*Needs*
- Tunable parameters declared in a policy and in-browser search (M10).
- Separate tuning and evaluation seed sets (M8), and parameter sweeps (M6, still
  to come).
- The training loop of D6.

#### What the part needs from the simulator

| Capability | Chapters | Where it stands |
|---|---|---|
| Check scripts for recursions and exact solvers | D1, D2 | The book's checks already run Maxima and Python. |
| A transition model for a small scenario, and a solver in the browser | D2, D6 | New. §8.7 plans the solver. |
| A random-walk demand level | D4 | Traces exist. `normal-per-period-demand` in §8.8 would replace the trace. |
| The share of time a bursty flow is on, as a run output | D4 | New. |
| Seeds allocated a round at a time | D5, D7 | New. The M6 runner takes its seeds up front. |
| Tuning and evaluation seed sets | D5, D7 | M8. |
| Tunable parameters and search | D7 | M10. |
| A training loop that carries state from run to run | D6, D7 | Research track, as the environment over the engine. |
| A learned table or tree written out as a Lua policy | D6, D7 | Research track, as distillation. |

D1 and D3 need nothing new and depend only on Part II. D2 and D5 need a solver
and a sequential runner. D4 needs a trace. D6 and D7 wait for the training loop,
so they come last.

## 9. Out of scope

- Backend services, accounts and a shared leaderboard. Verify links provide
  trust without them; a leaderboard may be reconsidered after M9.
- Passenger transport.
- Vehicles choosing their own routes, until the research track takes it up.
- Surviving Mars colonies with several interconnected lines. The `mars` pack
  models one line at a time, although the core model supports networks.
- Colony simulation beyond what a station's catchment needs.
- Game assets, art or copied game code.
- Other games.

## 10. Open questions

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

## 11. Risks

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

## 12. References

- Albertos, P. and Mareels, I. (2010) *Feedback and control for everyone*. Berlin:
  Springer.
- Åström, K.J. and Murray, R.M. (2008) *Feedback systems: an introduction for
  scientists and engineers*. Princeton, NJ: Princeton University Press.
- Auer, P., Cesa-Bianchi, N. and Fischer, P. (2002) 'Finite-time analysis of the
  multiarmed bandit problem', *Machine Learning*, 47(2–3), pp. 235–256.
- Axsäter, S. (2015) *Inventory control*. 3rd edn. Cham: Springer (International
  Series in Operations Research and Management Science, 225).
- Baird, L.C. (1995) 'Residual algorithms: reinforcement learning with function
  approximation', in *Proceedings of the twelfth international conference on
  machine learning*. San Francisco, CA: Morgan Kaufmann, pp. 30–37.
- Boyd, S. and Vandenberghe, L. (2004) *Convex optimization*. Cambridge: Cambridge
  University Press.
- Brémaud, P. (2020) *Markov chains: Gibbs fields, Monte Carlo simulation and
  queues*. 2nd edn. Cham: Springer (Texts in Applied Mathematics, 31).
- Clark, A.J. and Scarf, H. (1960) 'Optimal policies for a multi-echelon inventory
  problem', *Management Science*, 6(4), pp. 475–490.
- Deisenroth, M.P., Faisal, A.A. and Ong, C.S. (2020) *Mathematics for machine
  learning*. Cambridge: Cambridge University Press.
- Dorf, R.C. and Bishop, R.H. (2011) *Modern control systems*. 12th edn. Upper
  Saddle River, NJ: Prentice Hall.
- Eiselt, H.A. and Sandblom, C.-L. (2022) *Operations research: a model-based
  approach*. 3rd edn. Cham: Springer (Springer Texts in Business and Economics).
- Even-Dar, E., Mannor, S. and Mansour, Y. (2006) 'Action elimination and stopping
  conditions for the multi-armed bandit and reinforcement learning problems',
  *Journal of Machine Learning Research*, 7, pp. 1079–1105.
- Hernández-Lerma, O., Laura-Guarachi, L.R., Mendoza-Palacios, S. and
  González-Sánchez, D. (2023) *An introduction to optimal control theory: the
  dynamic programming approach*. Cham: Springer (Texts in Applied Mathematics, 76).
- Jones, D.R., Schonlau, M. and Welch, W.J. (1998) 'Efficient global optimization
  of expensive black-box functions', *Journal of Global Optimization*, 13(4),
  pp. 455–492.
- Kleywegt, A.J., Shapiro, A. and Homem-de-Mello, T. (2002) 'The sample average
  approximation method for stochastic discrete optimization', *SIAM Journal on
  Optimization*, 12(2), pp. 479–502.
- Lai, T.L. and Robbins, H. (1985) 'Asymptotically efficient adaptive allocation
  rules', *Advances in Applied Mathematics*, 6(1), pp. 4–22.
- Law, A.M. (2015) *Simulation modeling and analysis*. 5th edn. New York:
  McGraw-Hill Education.
- MacKay, D.J.C. (2003) *Information theory, inference, and learning algorithms*.
  Cambridge: Cambridge University Press.
- Muth, J.F. (1960) 'Optimal properties of exponentially weighted forecasts',
  *Journal of the American Statistical Association*, 55(290), pp. 299–306.
- Puterman, M.L. (1994) *Markov decision processes: discrete stochastic dynamic
  programming*. New York: John Wiley & Sons.
- Rabiner, L.R. (1989) 'A tutorial on hidden Markov models and selected
  applications in speech recognition', *Proceedings of the IEEE*, 77(2),
  pp. 257–286.
- Robbins, H. and Monro, S. (1951) 'A stochastic approximation method', *The Annals
  of Mathematical Statistics*, 22(3), pp. 400–407.
- Särkkä, S. (2013) *Bayesian filtering and smoothing*. Cambridge: Cambridge
  University Press (Institute of Mathematical Statistics Textbooks, 3).
- Scarf, H. (1960) 'The optimality of (S, s) policies in the dynamic inventory
  problem', in Arrow, K.J., Karlin, S. and Suppes, P. (eds) *Mathematical methods
  in the social sciences, 1959*. Stanford, CA: Stanford University Press,
  pp. 196–202.
- Simchi-Levi, D., Chen, X. and Bramel, J. (2014) *The logic of logistics: theory,
  algorithms, and applications for logistics management*. 3rd edn. New York:
  Springer (Springer Series in Operations Research and Financial Engineering).
- Smallwood, R.D. and Sondik, E.J. (1973) 'The optimal control of partially
  observable Markov processes over a finite horizon', *Operations Research*, 21(5),
  pp. 1071–1088.
- Snyder, L.V. and Shen, Z.-J.M. (2019) *Fundamentals of supply chain theory*. 2nd
  edn. Hoboken, NJ: John Wiley & Sons.
- Spall, J.C. (1992) 'Multivariate stochastic approximation using a simultaneous
  perturbation gradient approximation', *IEEE Transactions on Automatic Control*,
  37(3), pp. 332–341.
- Sutton, R.S. and Barto, A.G. (2015) *Reinforcement learning: an introduction*.
  2nd edn. Draft. Cambridge, MA: MIT Press. Page numbers refer to the draft, which
  differs from the published edition.
- Taha, H.A. (2017) *Operations research: an introduction*. 10th edn. Global edn.
  Harlow: Pearson Education.
- Thompson, W.R. (1933) 'On the likelihood that one unknown probability exceeds
  another in view of the evidence of two samples', *Biometrika*, 25(3–4),
  pp. 285–294.
- Tsitsiklis, J.N. and Van Roy, B. (1997) 'An analysis of temporal-difference
  learning with function approximation', *IEEE Transactions on Automatic Control*,
  42(5), pp. 674–690.
- Wasserman, L. (2004) *All of statistics: a concise course in statistical
  inference*. New York: Springer (Springer Texts in Statistics).
- Watkins, C.J.C.H. and Dayan, P. (1992) 'Q-learning', *Machine Learning*, 8(3–4),
  pp. 279–292.
- Williams, R.J. (1992) 'Simple statistical gradient-following algorithms for
  connectionist reinforcement learning', *Machine Learning*, 8(3–4), pp. 229–256.
- Zipkin, P. (2008) 'Old and new methods for lost-sales inventory systems',
  *Operations Research*, 56(5), pp. 1256–1263.
