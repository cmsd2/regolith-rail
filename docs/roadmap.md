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
  decision trees emitted as readable Lua.
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
- Axsäter, S. (2015) *Inventory control*. 3rd edn. Cham: Springer (International
  Series in Operations Research and Management Science, 225).
- Boyd, S. and Vandenberghe, L. (2004) *Convex optimization*. Cambridge: Cambridge
  University Press.
- Brémaud, P. (2020) *Markov chains: Gibbs fields, Monte Carlo simulation and
  queues*. 2nd edn. Cham: Springer (Texts in Applied Mathematics, 31).
- Deisenroth, M.P., Faisal, A.A. and Ong, C.S. (2020) *Mathematics for machine
  learning*. Cambridge: Cambridge University Press.
- Dorf, R.C. and Bishop, R.H. (2011) *Modern control systems*. 12th edn. Upper
  Saddle River, NJ: Prentice Hall.
- Eiselt, H.A. and Sandblom, C.-L. (2022) *Operations research: a model-based
  approach*. 3rd edn. Cham: Springer (Springer Texts in Business and Economics).
- Hernández-Lerma, O., Laura-Guarachi, L.R., Mendoza-Palacios, S. and
  González-Sánchez, D. (2023) *An introduction to optimal control theory: the
  dynamic programming approach*. Cham: Springer (Texts in Applied Mathematics, 76).
- Law, A.M. (2015) *Simulation modeling and analysis*. 5th edn. New York:
  McGraw-Hill Education.
- MacKay, D.J.C. (2003) *Information theory, inference, and learning algorithms*.
  Cambridge: Cambridge University Press.
- Särkkä, S. (2013) *Bayesian filtering and smoothing*. Cambridge: Cambridge
  University Press (Institute of Mathematical Statistics Textbooks, 3).
- Simchi-Levi, D., Chen, X. and Bramel, J. (2014) *The logic of logistics: theory,
  algorithms, and applications for logistics management*. 3rd edn. New York:
  Springer (Springer Series in Operations Research and Financial Engineering).
- Snyder, L.V. and Shen, Z.-J.M. (2019) *Fundamentals of supply chain theory*. 2nd
  edn. Hoboken, NJ: John Wiley & Sons.
- Sutton, R.S. and Barto, A.G. (2015) *Reinforcement learning: an introduction*.
  2nd edn. Draft. Cambridge, MA: MIT Press. Page numbers refer to the draft, which
  differs from the published edition.
- Taha, H.A. (2017) *Operations research: an introduction*. 10th edn. Global edn.
  Harlow: Pearson Education.
- Wasserman, L. (2004) *All of statistics: a concise course in statistical
  inference*. New York: Springer (Springer Texts in Statistics).
