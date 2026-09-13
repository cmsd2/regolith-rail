## ADDED Requirements

### Requirement: Review hook
A policy SHALL be able to define `on_review(ctx)`, called at every review of every stock point that has a
review schedule. Its context SHALL provide `now`, the stock point with its stock, capacity, backorders and
orders on the way for each resource, the stock point's suppliers with their lead times and order limits,
`memory` and the stock point's memory, `rand()`, `log(...)`, `record(name, value)` and
`order(resource, amount)`. A scenario with review schedules whose policy has no `on_review` SHALL fail to
load with an error naming the missing hook.

#### Scenario: Order at review
- **WHEN** `on_review` calls `ctx.order("Beer", 5000)` at a stock point supplied externally with Beer
- **THEN** the review's actions contain an order for 5000 Beer to that supplier

#### Scenario: Missing review hook
- **WHEN** a policy without `on_review` is loaded for a scenario with review schedules
- **THEN** loading fails with an error stating that `on_review` is required

### Requirement: Mod-ready marking
The application SHALL mark a policy and scenario pairing as mod-ready when the policy defines only
`on_start` and `on_stop`, and the scenario is a single shuttle line at the `local` or `line` information
level with no reviews, converters or suppliers.

#### Scenario: Review hook is not mod-ready
- **WHEN** a policy defines `on_review`
- **THEN** the application does not mark it as mod-ready and says which hook prevents it

## MODIFIED Requirements

### Requirement: Policy module
A policy SHALL be Lua source that returns a table with any of the hooks `on_start(ctx)`, `on_stop(ctx)` and
`on_review(ctx)`. `on_start` SHALL be called once at the start of each run, `on_stop` at every vehicle stop
and `on_review` at every review. A hook the scenario needs SHALL be required: `on_stop` when the scenario has
vehicles and `on_review` when it has review schedules.

#### Scenario: Missing stop hook
- **WHEN** a policy without `on_stop` is loaded for a scenario with vehicles
- **THEN** loading fails with an error stating that `on_stop` is required

#### Scenario: Syntax error
- **WHEN** a policy contains a syntax error
- **THEN** loading fails with the error message and line number, and no run starts

### Requirement: Context
The `ctx` argument to `on_stop` SHALL provide:

- `now`: game time in milliseconds.
- `train`: the stopped vehicle's id, direction, capacity, and cargo and free space per resource.
- `station`: the stock point's id, position on the route, stored resources, stock, capacity and backorders
  per resource.
- `route`: the vehicle's route kind and its stock points in visiting order from the current stop, with
  distances and travel times to each.
- `line`: for shuttle routes, the ordered stock points of the path with their ids, positions, stored
  resources and distances, and functions giving distance and travel time between two stock points.
- `network`: the arcs joining stock points, at the `line` information level; the stock points
  themselves are in `line.stations`.
- `memory`, `station.memory` and `train.memory`: persistent tables.
- `rand()`: a number in [0, 1) from the run's seeded policy stream.
- `load(resource, amount)`, `unload(resource, amount)`: transfer actions.
- `log(...)`: a message attached to the stop.
- `record(name, value)`: a named numeric series for the run.

Every part of `ctx` other than the memory tables SHALL be read-only.

#### Scenario: Writing to the snapshot
- **WHEN** a policy assigns to `ctx.station.stock.Metals`
- **THEN** it raises an error stating that the snapshot is read-only

#### Scenario: Recorded series
- **WHEN** a policy calls `ctx.record("target", 12000)` at several stops
- **THEN** the run output contains a `target` series with one point per call

#### Scenario: Route ahead on a loop
- **WHEN** a vehicle on the loop Depot–A–B stops at A
- **THEN** `ctx.route` lists B and then Depot with their distances from A

### Requirement: Information levels
At the `local` level, stock, capacity and backorders of stock points other than the current one SHALL NOT be
readable. At the `line` level, stock, capacity and backorders of every stock point in the scenario SHALL be
readable. Reading a field above the scenario's level SHALL raise an error naming the level required.

#### Scenario: Local level
- **WHEN** a policy reads another station's stock in a `local` scenario
- **THEN** it raises an error stating that the `line` level is required

#### Scenario: Line level
- **WHEN** the same policy runs in a `line` scenario
- **THEN** it reads the other station's current stock

### Requirement: Policy API version
The Policy API SHALL carry a version number that is recorded in every run output and share link. This version
SHALL be 2. Policies written for version 1 SHALL run unchanged.

#### Scenario: Version in output
- **WHEN** a run completes
- **THEN** its output states Policy API version 2

#### Scenario: Version 1 policy
- **WHEN** `naive.lua` from Policy API version 1 runs on an upgraded format 1 scenario
- **THEN** it loads without changes and its results equal the recorded golden results
