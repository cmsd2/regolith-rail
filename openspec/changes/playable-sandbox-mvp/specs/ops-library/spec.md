## Purpose

Lets players build policies from operations research building blocks instead of
raw Lua, with explanations for every decision, while keeping custom Lua
available for any part of the pipeline.

## ADDED Requirements

### Requirement: Declarative policies
A global `ops` library SHALL be available to every policy. `ops.policy{...}`
SHALL return a policy module that can be returned directly from a policy file.

#### Scenario: One-line baseline
- **WHEN** a policy file contains `return ops.policy { target = ops.balance {} }`
- **THEN** its event log, ignoring decision traces, is identical to that of
  `naive.lua` on every starter scenario and seed from 1 to 50

### Requirement: Pipeline stages
A declarative policy SHALL run the stages classify, target, plan and allocate
at every stop, in that order, followed by execution of the resulting loads and
unloads. `target` SHALL be required. When `classify` is omitted every site
SHALL have the role `any`; when `plan` is omitted no cargo SHALL be reserved
for other stations; when `allocate` is omitted each site's load or unload SHALL
be issued in the order the station lists its resources, as the naive baseline
does, leaving the engine to clamp them. When an allocation block is given, all
unloads SHALL be issued before loads.

#### Scenario: Missing target
- **WHEN** `ops.policy{}` is called without `target`
- **THEN** loading fails with an error stating that `target` is required

### Requirement: Roles
`ops.roles.manual` SHALL assign the roles `supply`, `demand`, `relay` or `any`
to stations, either for all resources or per resource. `target` SHALL accept
either one block for every site or a table of blocks keyed by role.

#### Scenario: Targets by role
- **WHEN** station A is `supply` with target `ops.drain{}` and station C is
  `demand` with target `ops.fill{}`
- **THEN** trains load everything they can at A and unload everything they can
  at C

#### Scenario: Role without a target
- **WHEN** a station has the role `relay` and `target` has no `relay` entry
- **THEN** loading fails with an error naming the role

### Requirement: Target blocks
The library SHALL provide these target blocks, each producing a target amount
for a site; the engine clamps the resulting transfers:

- `balance{}`: the floor of the mean stock across stations that enable the
  resource.
- `order_up_to{level}`: the stated level.
- `min_max{min, max}`: `max` when the site's inventory position is below `min`;
  otherwise no change.
- `drain{}`: zero.
- `fill{}`: the site's capacity.
- `pass_through{}`: no transfers at the site.

#### Scenario: Min-max above minimum
- **WHEN** a site with `min_max{min = 5000, max = 25000}` has an inventory
  position of 9000
- **THEN** the policy issues no transfer for that site

#### Scenario: Min-max below minimum
- **WHEN** the same site has an inventory position of 3000 and the train carries
  30000 of the resource
- **THEN** the policy unloads 22000

### Requirement: Inventory position
The library SHALL track, for every site, the amount reserved for it on trains
heading towards it. Targets SHALL compare against inventory position, which is
station stock plus inbound reservations. Reservations SHALL be released when the
reserving train stops at the site, and SHALL be kept in persistent memory under
`ctx.memory.ops`.

#### Scenario: No double dispatch
- **WHEN** two trains stop at a supply station in succession and one demand
  station needs 10000 with nothing reserved
- **THEN** the first train reserves 10000 for it and the second train reserves
  nothing more for that site

#### Scenario: Reservations survive reload
- **WHEN** a run uses save and reload test mode
- **THEN** reservations after each reload equal those before it

### Requirement: Downstream lookahead
`ops.lookahead{}` SHALL, before unloading at a stop, keep on the train the cargo
needed to cover shortfalls at stations further along the train's current
direction, nearest first, and SHALL load at supply sites up to the total of
those shortfalls.

#### Scenario: Cargo kept for further station
- **WHEN** a train carrying 20000 Metals stops at relay B on its way to demand
  station C with a shortfall of 15000
- **THEN** at most 5000 Metals is unloaded at B and 15000 is reserved for C

### Requirement: Allocation
When requested loads exceed what a train can carry or a station can supply,
`ops.priority{}` SHALL satisfy resources in descending priority and
`ops.proportional{}` SHALL share the available amount in proportion to the
requests, rounding down and giving remainders in priority order.

#### Scenario: Proportional split
- **WHEN** a train with 12000 free shared capacity is asked to load 10000 Food
  and 20000 Metals under `ops.proportional{}`
- **THEN** it loads 4000 Food and 8000 Metals

### Requirement: Custom stages
Every stage SHALL accept a Lua function in place of a block, with a documented
signature. Errors raised inside a custom function SHALL identify the stage.

#### Scenario: Custom target
- **WHEN** `target` is a function returning 2 × a site's capacity ÷ 3
- **THEN** each site is moved towards two thirds of its capacity

### Requirement: Decision traces
Every block SHALL record a trace for each site it decides on, stating the block,
the site, the inputs it used and the result. Traces SHALL be part of the run
output and attached to the stop.

#### Scenario: Trace for a target
- **WHEN** `order_up_to{level = 20000}` decides on Metals at station C with
  position 12000
- **THEN** the stop has a trace naming `order_up_to`, Metals at C, position
  12000, level 20000 and target 20000

### Requirement: Information requirements
Every block SHALL declare the lowest information level it needs. Loading a
declarative policy whose blocks need a higher level than the scenario provides
SHALL fail before the run starts, naming the block and the level.

#### Scenario: Balance at local level
- **WHEN** a policy using `ops.balance{}` is loaded for a `local` scenario
- **THEN** loading fails with an error stating that `balance` needs the `line`
  level

### Requirement: Same restrictions as policies
The `ops` library SHALL itself satisfy the portable language subset and sandbox
rules that apply to policies, and its instructions SHALL count towards the
policy's instruction budget.

#### Scenario: Library passes the policy checks
- **WHEN** the `ops` library source is checked with the policy language checker
- **THEN** no violations are reported
