## Why

Regolith Rail was built to show dispatch policies for Surviving Mars shuttle lines, but its engine can
teach much more. Today a scenario can only be one line of shuttling trains with independent producers
and consumers, written as verbose JSON in milli-units. That rules out the well-known operations
research problems behind the techniques the roadmap now plans to showcase (§8), and makes even
Surviving Mars scenarios tedious to write. This change keeps Surviving Mars as the flagship use case
while making the model general and scenarios short to write.

## What Changes

- **Scenario format 2.** A general core model:
  - a network of stock points joined by arcs, with a line as a special case;
  - converters that turn inputs into outputs at a capacity;
  - external suppliers that fill orders after a lead time;
  - a per-site choice of lost sales or backorders;
  - holding, ordering, transport and shortage costs;
  - more demand processes: Poisson and compound arrivals, per-period discrete distributions, ramps and
    seasonality, and recorded traces;
  - vehicles on fixed routes: shuttles, loops and timetables.
  Format 1 documents are still accepted and upgraded on load.
- **Engine.** The engine simulates format 2. Format 1 scenarios, once upgraded, give the same results
  as today: golden result hashes do not change.
- **Policy API version 2.** Adds an `on_review(ctx)` hook, called on a fixed period at a stock point,
  with a `ctx.order(resource, amount)` action for replenishment decisions. It also gives vehicles
  route-aware context. Policy API v1 policies keep working unchanged. A policy that uses only
  `on_start` and `on_stop` on a shuttle line is marked mod-ready.
- **`ops` for ordering.** `ops.policy` pipelines can drive review decisions, so classic ordering
  policies such as base-stock and (s, S) are one-liners.
- **Scenario scripts.** Scenarios can be written as sandboxed Lua scripts that call a constructs
  library and evaluate to a validated format 2 document. Errors point at script lines. The workbench
  edits, saves and shares scripts, and JSON stays available.
- **Mars pack.** Constructs in game vocabulary and game units: small and large stations, extractors,
  domes, factories, trains, dust storms and other disasters. The starter scenarios are rewritten with
  it and keep their failures.
- **Classic problems pack.** Parameterised templates:
  - the newsvendor problem;
  - single-location reorder policies (economic order quantity, (s, S) and base-stock with lead time);
  - a serial supply chain in the style of the beer game;
  - fixed-route inventory routing.
  Where a template has a known analytic result, a test checks the engine against it and the
  documentation page quotes it.
- **Views.** The map draws networks and loops as well as lines. The scenario picker offers packs,
  templates and their parameters.
- **Documentation.** A generated reference for scenario constructs. A page per classic problem linked
  to the §8 techniques. A guide to writing scenario scripts.
- **Roadmap.** Records a general core model with domain packs, adds a stage for this work before the
  benchmark (M8), moves networks of stock points into scope, and moves free vehicle routing to the
  research track.
- **Not in this change:** vehicles that choose their own destinations (free routing), catchments with
  drones and depots, and multi-line Surviving Mars colonies.

## Capabilities

### New Capabilities

- `scenario-authoring`: Lua scenario scripts, the constructs library they call, how scripts evaluate
  to validated scenario documents, and how the workbench edits, saves and shares them.
- `mars-pack`: Surviving Mars vocabulary and units for scenarios, and the starter scenarios built
  with it.
- `classic-problems-pack`: templates for well-known operations research problems, with their
  reference results and documentation.

### Modified Capabilities

- `scenarios`: format 2 adds:
  - networks, converters, suppliers with lead times, and backorders;
  - costs, new demand processes, and vehicle routes;
  - the upgrade of format 1 documents;
  - starter scenarios written with the Mars pack.
- `simulation-engine`: simulates format 2:
  - vehicle movement on shuttles, loops and timetables;
  - converters, orders and lead times, and backorders;
  - review hooks, and cost metrics;
  - unchanged results for upgraded format 1 scenarios.
- `policy-runtime`: Policy API v2 adds the review hook and order action and route-aware context,
  keeps v1 compatibility, and marks policies mod-ready.
- `ops-library`: pipelines can make ordering decisions at reviews.
- `run-explorer`: the map shows networks and loops. Scenario selection covers packs, templates,
  parameters and scripts.
- `sharing`: share links and saved work carry scenario scripts, and older links still open.
- `documentation`: the reference covers scenario constructs. New sections cover classic problems and
  scenario authoring.

## Impact

- **`packages/engine`:** a new schema version and upgrade path, network and route movement,
  converters, orders and backorders, costs, demand processes, review events and metrics.
- **`packages/policy-api`:** v2 hook, action and context types, generated annotations and editor data.
- **`packages/lua-runtime`:** a review hook entry point, and a sandboxed evaluator for scenario scripts
  that has no policy hooks.
- **Pack libraries in Lua:** the Mars and classic packs, plus the ops review integration, shipped as
  embedded sources like `ops`.
- **`packages/app`:**
  - network map rendering;
  - pack and template picker, and a script editor mode;
  - share and save formats;
  - review events on the timeline.
- **`packages/docs`:** construct reference generation and new content pages.
- **`packages/cli`:** runs scripts and templates.
- **Tests:** golden hashes stay fixed for upgraded format 1 scenarios. There are new analytic
  validation tests for the classic templates.
- **Planning documents:** `docs/roadmap.md` and the project context in `openspec/config.yaml`, which
  currently describes a scenario as one line.
- **Dependencies:** none expected.
