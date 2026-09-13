## Purpose

Defines the scenario file that describes a world to simulate, how scenarios are
validated, and the starter scenarios that demonstrate the failures of
stock-balancing dispatch.

## ADDED Requirements

### Requirement: Scenario document
A scenario SHALL be a single JSON document containing a format version, an id,
a title, a description, a run duration, resources, stations, trains, station
producers and consumers, events, an information level and a base seed.

Quantities SHALL be integers in milli-units (1 unit = 1000 milli-units), times
SHALL be integers in milliseconds of game time, distances SHALL be integers,
and rates SHALL be integers in milli-units per minute.

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
- **WHEN** a consumer has a base rate of 600 and a uniform range of ±20%
- **THEN** the effective rate in every period lies between 480 and 720

#### Scenario: Producer on a resource the station does not enable
- **WHEN** a producer is defined for a resource the station does not enable
- **THEN** validation fails with an error naming the station and resource

### Requirement: Events
A scenario SHALL be able to define storm events that multiply production rates
at chosen stations for a time window, either at a fixed time or at random times
with a stated probability.

#### Scenario: Scheduled storm
- **WHEN** a storm with a production multiplier of 0 is scheduled from minute 60
  to minute 90 for all stations
- **THEN** no production occurs anywhere on the line during that window

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
- `storm-shock`: recovery after production stops.

#### Scenario: Starter scenarios are valid
- **WHEN** the starter scenarios are validated
- **THEN** every one passes validation

#### Scenario: Starter scenario shows its failure
- **WHEN** `two-station` is run with the naive baseline while consumption is
  raised above half of what the train can carry per round trip
- **THEN** unmet demand is greater than zero while the supply station's
  production stalls
