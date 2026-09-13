# scenarios Specification

## Purpose
Defines the scenario file that describes a world to simulate, how scenarios are
validated, and the starter scenarios that demonstrate the failures of
stock-balancing dispatch.

## Requirements

### Requirement: Scenario document
A scenario SHALL be a single JSON document containing a format version, an id,
a title, a description, a run duration, resources, stations, trains, station
producers and consumers, events, an information level and a base seed.

Quantities SHALL be integers in milli-units (1 unit = 1000 milli-units), times
SHALL be integers in milliseconds of game time, distances SHALL be integers,
and rates SHALL be integers in milli-units per sol, where one sol is 24 game
hours (86,400,000 ms of game time), matching how the game states production
and consumption.

#### Scenario: Minimal valid scenario
- **WHEN** a scenario defines two stations, one enabled resource, one train, one
  producer, one consumer, a duration and a base seed
- **THEN** validation succeeds and every omitted optional field takes its
  documented default

#### Scenario: Default station capacity
- **WHEN** a station enables a resource without stating a capacity
- **THEN** that station's capacity for the resource is 30000 milli-units

### Requirement: Line topology
A scenario SHALL describe exactly one line as an ordered list of at least two
stations, each with a unique id, the resources it enables, and the distance to
the next station.

#### Scenario: Station order defines the line
- **WHEN** stations A, B and C are listed in that order with distances 400 and
  600
- **THEN** the line runs A–B–C and the distance from A to C is 1000

#### Scenario: Too few stations
- **WHEN** a scenario lists one station
- **THEN** validation fails with an error stating that a line needs at least two
  stations

### Requirement: Trains
A scenario SHALL define one or more trains, each with a unique id, a start
station, a start direction, a speed, a fixed dwell time per stop, a dwell time
per unit transferred, and a cargo capacity that is either shared across
resources or stated per resource.

#### Scenario: Shared capacity
- **WHEN** a train declares a shared capacity of 30000
- **THEN** the train's total cargo across all resources never exceeds 30000

#### Scenario: Per-resource capacity
- **WHEN** a train declares a capacity of 10000 for Metals and 5000 for Food
- **THEN** each resource is limited independently to its stated capacity

### Requirement: Producers and consumers
Each station SHALL be able to define producers and consumers per enabled
resource, each with a base rate and a variability of fixed, uniform range, or
on/off bursts.

#### Scenario: Uniform variability
- **WHEN** a consumer has a base rate of 8000 per sol and a uniform range of ±20%
- **THEN** the effective rate in every period lies between 6400 and 9600 per sol

#### Scenario: Producer on a resource the station does not enable
- **WHEN** a producer is defined for a resource the station does not enable
- **THEN** validation fails with an error naming the station and resource

### Requirement: Events
A scenario SHALL be able to define events: states of the world that are active
for a time window, scheduled either at a fixed time or at random times with a
stated probability. Each event SHALL have an id, a label and one or more
effects. While an effect is active it SHALL multiply the production (a
`supply` effect) or consumption (a `demand` effect) of the listed resources at
the listed stations, or of all resources or all stations. Multipliers SHALL be
stated in thousandths, from 0 upwards. An effect SHALL be active for its event's
window unless it states its own start offset from the event start and its own
duration. Where effects overlap on the same flow their multipliers SHALL
combine by multiplication. A storm is an event with a label, not a separate
kind. Events SHALL NOT change train speed, capacity or dwell time.

#### Scenario: Storm stops production
- **WHEN** a storm with a supply effect of multiplier 0 for all resources is
  scheduled from hour 2 to hour 3 for all stations
- **THEN** no production occurs anywhere on the line during that window

#### Scenario: Maintenance surge
- **WHEN** an event has a demand effect for Metals at station Dome with
  multiplier 4000
- **THEN** consumption of Metals at Dome is four times its rate while the event
  is active and unchanged at other stations and for other resources

#### Scenario: Effect starting after its event
- **WHEN** a storm lasting one hour has a demand effect with a start offset of
  30 minutes and a duration of two hours
- **THEN** the demand effect is active from 30 minutes after the storm starts
  until 2 hours 30 minutes after it starts

#### Scenario: Overlapping effects
- **WHEN** two active events apply supply multipliers of 500 and 500 to the same
  producer
- **THEN** that producer runs at a quarter of its rate

#### Scenario: Unknown resource in an effect
- **WHEN** an effect lists a resource the scenario does not define
- **THEN** validation fails with an error naming the resource and the effect's
  path

### Requirement: Information level
A scenario SHALL declare the information level available to policies. This
version SHALL accept `local` and `line` and SHALL reject `line+history` and
`colony` as not yet supported.

#### Scenario: Unsupported level
- **WHEN** a scenario declares the `colony` information level
- **THEN** validation fails with an error stating that the level is reserved for
  a later version

### Requirement: Validation errors
Validation SHALL reject unknown fields, duplicate ids, references to unknown
stations or resources, negative or non-integer quantities, and unsupported
format versions. Every error SHALL identify the location in the document.

#### Scenario: Multiple errors reported together
- **WHEN** a scenario has a duplicate station id and a negative rate
- **THEN** validation reports both errors, each with its path in the document

#### Scenario: Unknown format version
- **WHEN** a scenario declares a format version newer than the application
  supports
- **THEN** validation fails with an error naming the supported versions

### Requirement: Published schema
The scenario format SHALL be published as a machine-readable schema that
editors can use for completion and validation.

#### Scenario: Schema matches validation
- **WHEN** a scenario passes validation in the application
- **THEN** it also validates against the published schema

### Requirement: Starter scenarios
The application SHALL ship starter scenarios, each with a description of the
failure it demonstrates and a link to the documentation page explaining it:

- `two-station`: the half capacity limit and operating at the edge.
- `relay`: dead stock at a station with no producers or consumers.
- `two-trains`: double dispatch.
- `mixed-line`: ping-pong and missing priorities across several resources.
- `storm-shock`: a storm that stops production, followed by a maintenance surge
  in demand.

Starter scenarios SHALL use values typical of the game: station capacities of
30 or 60 units per resource, and rates, speeds and times within the ranges
recorded on the game mechanics documentation page.

#### Scenario: Starter scenarios are valid
- **WHEN** the starter scenarios are validated
- **THEN** every one passes validation

#### Scenario: Game-scale station sizes
- **WHEN** the starter scenarios' station capacities are listed
- **THEN** every capacity is 30000 or 60000 milli-units

#### Scenario: Starter scenario shows its failure
- **WHEN** `two-station` is run with the naive baseline while consumption is
  raised above half of what the train can carry per round trip
- **THEN** unmet demand is greater than zero while the supply station's
  production stalls
