## ADDED Requirements

### Requirement: Review hook
A policy SHALL be able to define `on_review(ctx)`, called at every review of every station that has a
review schedule. Its context SHALL be the shared context, with `ctx.review` numbering the review,
`ctx.here` the reviewed station, and `order(resource, amount)` to order from `ctx.here`'s supplier for
the resource. A scenario with review schedules whose policy has no `on_review` SHALL fail to load with an
error naming the missing hook.

#### Scenario: Order at review
- **WHEN** `on_review` calls `ctx.order("Beer", 5000)` at a station supplied externally with Beer
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
Every hook SHALL receive a context with the same shape:

- `now`: game time in milliseconds, and `information_level`.
- `stations`: every station keyed by id, and `station_order`: their ids in scenario order.
- Each station: `id`, `index`, the ids of the `resources` it stores, `neighbours` (each a station with
  the arc's distance), `stock`, `capacity` and `backorders` per resource, `suppliers`, `on_order` (orders
  placed there and not yet arrived), and a persistent `memory` table.
- `resources`: every resource keyed by id with its priority, and `resource_order`: their ids in scenario
  order.
- `distance(from, to)` and `travel_time(from, to, speed)`: along the shortest path over arcs.
- `memory`: a persistent table for the whole policy.
- `rand()`: a number in [0, 1) from the run's seeded policy stream.
- `log(...)` and `record(name, value)`.

The start context SHALL also provide `vehicles`, keyed by id, with each vehicle's speed, capacity, route
kind and stops. The stop context SHALL also provide `stop`; `here`, the station the vehicle stopped at; and
`vehicle`, with its id, direction, speed, capacity, cargo and free space per resource, `memory`, and
`route` with its kind and the stops `ahead` in visiting order, each giving the station, the distance and
the travel time from here. Stop contexts SHALL provide `load(resource, amount)` and
`unload(resource, amount)`. Stations referred to anywhere in a context SHALL be the same tables as in
`stations`.

Every part of `ctx` other than the memory tables SHALL be read-only.

#### Scenario: Writing to the snapshot
- **WHEN** a policy assigns to `ctx.here.stock.Metals`
- **THEN** it raises an error stating that the snapshot is read-only

#### Scenario: Recorded series
- **WHEN** a policy calls `ctx.record("target", 12000)` at several stops
- **THEN** the run output contains a `target` series with one point per call

#### Scenario: Route ahead on a loop
- **WHEN** a vehicle on the loop Depot–A–B stops at A
- **THEN** `ctx.vehicle.route.ahead` lists B and then Depot with their distances from A, and each entry's
  `station` is the same table as `ctx.stations.B` or `ctx.stations.Depot`

#### Scenario: Same station tables
- **WHEN** a policy compares `ctx.here` with `ctx.stations[ctx.here.id]`
- **THEN** they are the same table

### Requirement: Information levels
At the `local` level, the stock, capacity, backorders and orders of stations other than `ctx.here` SHALL NOT
be readable; ids, resources and neighbours SHALL be. At the `line` level, every station's stock, capacity,
backorders and orders SHALL be readable. Reading a field above the scenario's level SHALL raise an error naming the level required.

#### Scenario: Local level
- **WHEN** a policy reads `ctx.stations.B.stock` at A in a `local` scenario
- **THEN** it raises an error stating that the `line` level is required

#### Scenario: Line level
- **WHEN** the same policy runs in a `line` scenario
- **THEN** it reads the other station's current stock

### Requirement: Policy API version
The Policy API SHALL carry a version number that is recorded in every run output and share link. This version
SHALL be 2. Policies written for version 1 are not supported.

#### Scenario: Version in output
- **WHEN** a run completes
- **THEN** its output states Policy API version 2

#### Scenario: Baseline on version 2
- **WHEN** `naive.lua`, written for Policy API version 2, runs every starter scenario on seeds 1 to 50
- **THEN** its event logs are identical to those of the built-in reference implementation
