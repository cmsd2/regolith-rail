## Purpose

Runs player-written Lua policies safely and reproducibly against Policy API v1,
so that one policy file behaves the same in every run and can later run in the
game.

## ADDED Requirements

### Requirement: Policy module
A policy SHALL be Lua source that returns a table with an `on_stop(ctx)`
function and optionally an `on_start(ctx)` function. `on_start` SHALL be called
once at the start of each run and `on_stop` at every train stop.

#### Scenario: Missing stop hook
- **WHEN** a policy returns a table without `on_stop`
- **THEN** loading fails with an error stating that `on_stop` is required

#### Scenario: Syntax error
- **WHEN** a policy contains a syntax error
- **THEN** loading fails with the error message and line number, and no run
  starts

### Requirement: Portable language subset
Policies SHALL be restricted to Lua syntax that is valid in Lua 5.1. Integer
division, bitwise operators, `goto` and labels, and variable attributes SHALL be
rejected when the policy is loaded, with the line number and a suggested
alternative.

#### Scenario: Integer division rejected
- **WHEN** a policy uses `a // b`
- **THEN** loading fails at that line with a message suggesting `math.floor(a / b)`

### Requirement: Sandbox
Policies SHALL have no access to `io`, `os`, `debug`, `package`, `require`,
`load`, `loadstring`, `dofile`, `loadfile`, `collectgarbage`, `math.random` or
`math.randomseed`. Accessing any of them SHALL raise an error that names the
permitted alternative where one exists. Policies SHALL have no access to the
host application, the network, other runs or other policies.

#### Scenario: Random number access
- **WHEN** a policy calls `math.random()`
- **THEN** it raises an error directing the author to `ctx.rand()`

#### Scenario: Fresh state per run
- **WHEN** a policy sets a global variable during one run
- **THEN** the variable does not exist at the start of the next run

### Requirement: Instruction budget
Each hook call SHALL be limited to a fixed instruction budget. A call that
exceeds the budget SHALL be stopped and reported as a budget overrun with the
policy line that was executing.

#### Scenario: Infinite loop
- **WHEN** `on_stop` contains `while true do end`
- **THEN** the call is stopped, a budget overrun is reported for that stop, and
  the run continues

### Requirement: Context
The `ctx` argument SHALL provide:

- `now`: game time in milliseconds.
- `train`: id, direction, capacity, and cargo and free space per resource.
- `station`: id, position on the line, enabled resources, stock and capacity per
  resource.
- `line`: the ordered stations with their ids, positions, enabled resources and
  distances, and functions giving distance and travel time between two
  stations.
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

### Requirement: Information levels
At the `local` level, stock and capacity of stations other than the current one
SHALL NOT be readable. At the `line` level, stock and capacity of every station
on the line SHALL be readable. Reading a field above the scenario's level SHALL
raise an error naming the level required.

#### Scenario: Local level
- **WHEN** a policy reads another station's stock in a `local` scenario
- **THEN** it raises an error stating that the `line` level is required

#### Scenario: Line level
- **WHEN** the same policy runs in a `line` scenario
- **THEN** it reads the other station's current stock

### Requirement: Persistent memory
Memory tables SHALL keep their contents between hook calls within a run. After
each call, memory SHALL contain only booleans, numbers, strings and tables with
string or number keys, without cycles. A call that leaves other values in
memory SHALL be reported as an error.

#### Scenario: Function stored in memory
- **WHEN** a policy stores a function in `ctx.memory`
- **THEN** an error is reported for that stop naming the offending key

### Requirement: Save and reload test mode
A run option SHALL reload the policy from source at seeded random times during
the run, restoring only the memory tables, to reproduce what happens when a
game is saved and reloaded.

#### Scenario: State outside memory is lost
- **WHEN** a policy counts stops in a module-level local and the run uses save
  and reload test mode
- **THEN** the count restarts after each reload while a count kept in
  `ctx.memory` does not

### Requirement: Unordered iteration
The order in which `pairs` and `next` visit table keys SHALL vary with the seed
and SHALL be the same for the same seed.

#### Scenario: Order depends on seed
- **WHEN** a policy logs the key order of a table with ten keys on seeds 1 and 2
- **THEN** the orders differ, and repeating seed 1 gives the original order

### Requirement: Error reporting
Every load error, runtime error, budget overrun and memory error SHALL report
the message, the policy line, and where applicable the train, station and game
time.

#### Scenario: Runtime error location
- **WHEN** a policy indexes a nil value on line 14 at a stop
- **THEN** the reported error includes line 14, the train id, the station id
  and the time of the stop

### Requirement: Naive baseline
The application SHALL ship `naive.lua`, which at each stop moves every enabled
resource at the station towards the floor of the mean stock of that resource
across the stations on the line that enable it. Its results SHALL be identical
to the built-in reference implementation of the same rule on every starter
scenario and seed. Its documentation SHALL state that it reflects observed game
behaviour that has not yet been verified.

#### Scenario: Matches the reference
- **WHEN** `naive.lua` and the reference implementation run every starter
  scenario on seeds 1 to 50
- **THEN** their event logs are identical

### Requirement: Policy API version
The Policy API SHALL carry a version number that is recorded in every run
output and share link.

#### Scenario: Version in output
- **WHEN** a run completes
- **THEN** its output states Policy API version 1
