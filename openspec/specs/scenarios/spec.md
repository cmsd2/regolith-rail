# scenarios Specification

## Purpose
Defines the scenario file that describes a world to simulate, how scenarios are
validated, and the starter scenarios that demonstrate the failures of
stock-balancing dispatch.

## Requirements

### Requirement: Scenario document
A scenario SHALL be a single JSON document containing a format version, an id, a title, a description, a run
duration, resources, stations, arcs, vehicles, flows, events, costs, an information level and a base
seed. This version SHALL write format 2 and SHALL read formats 1 and 2.

Quantities SHALL be integers in milli-units (1 unit = 1000 milli-units), times SHALL be integers in
milliseconds of game time, distances SHALL be integers, and rates SHALL be integers in milli-units per sol,
where one sol is 24 game hours (86,400,000 ms of game time).

#### Scenario: Minimal valid scenario
- **WHEN** a format 2 scenario defines two stations joined by an arc, one resource, one vehicle on a
  shuttle route, one producer, one consumer, a duration and a base seed
- **THEN** validation succeeds and every omitted optional field takes its documented default

#### Scenario: Default station capacity
- **WHEN** a station stores a resource without stating a capacity
- **THEN** that station's capacity for the resource is 30000 milli-units

### Requirement: Producers and consumers
Each station SHALL be able to define producers and consumers per stored resource. Each SHALL have a
demand or production process, which is one of:

- a base rate with a variability of fixed, uniform range, or on/off bursts;
- Poisson arrivals at a rate per sol, each of a fixed size or a size drawn from a discrete distribution;
- an amount per period drawn from a discrete distribution with integer weights;
- a recorded trace of amounts per period.

Any process SHALL be able to carry a profile of multipliers over time, stated in thousandths and
interpolated linearly between points, to describe ramps and seasons.

#### Scenario: Uniform variability
- **WHEN** a consumer has a base rate of 8000 per sol and a uniform range of ±20%
- **THEN** the effective rate in every period lies between 6400 and 9600 per sol

#### Scenario: Poisson demand
- **WHEN** a consumer has Poisson arrivals at 24 per sol, each of 1000 milli-units
- **THEN** validation succeeds and over many sols the mean demand is 24000 milli-units per sol

#### Scenario: Demand ramp
- **WHEN** a consumer's profile rises from 1000 at the start of the run to 2000 at the end
- **THEN** its rate at the midpoint of the run is one and a half times its base rate

#### Scenario: Producer on a resource the station does not enable
- **WHEN** a producer is defined for a resource the station does not store
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
The application SHALL ship starter scenarios, each written as a Mars pack script, each with a description of
the failure it demonstrates and a link to the documentation page explaining it:

- `two-station`: the half capacity limit and operating at the edge.
- `relay`: dead stock at a station with no producers or consumers.
- `two-trains`: double dispatch.
- `mixed-line`: ping-pong and missing priorities across several resources.
- `storm-shock`: a storm that stops production, followed by a maintenance surge in demand.

Starter scenarios SHALL use station capacities of 30 or 60 units per resource. Their rates, speeds and times
SHALL be chosen to show each failure clearly and SHALL NOT be required to match exact game values.

#### Scenario: Starter scenarios are valid
- **WHEN** the starter scenarios are evaluated and validated
- **THEN** every one passes validation

#### Scenario: Game-scale station sizes
- **WHEN** the starter scenarios' station capacities are listed
- **THEN** every capacity is 30000 or 60000 milli-units

#### Scenario: Starter scenario shows its failure
- **WHEN** `two-station` is run with the balancing baseline while consumption is raised above half of what the
  train can carry per round trip
- **THEN** unmet demand is greater than zero while the supply station's production stalls

### Requirement: Network topology
A format 2 scenario SHALL describe stations and the arcs between them, in `stations` and `arcs`. Each station SHALL have a
unique id and the resources it stores, each with a capacity that is either an integer or unlimited, and
optionally stock that expires at each review. Each arc SHALL join two stations with a positive distance
and SHALL be usable in both directions. A line SHALL be expressible as stations joined in order by arcs.

#### Scenario: Line as a network
- **WHEN** stations A, B and C are joined by arcs A–B of 400 and B–C of 600
- **THEN** validation succeeds and the distance along the arcs from A to C is 1000

#### Scenario: Disconnected route
- **WHEN** a route visits two stations that no arc joins
- **THEN** validation fails with an error naming the route and the two stations

#### Scenario: Unlimited capacity
- **WHEN** a station stores Metals with unlimited capacity
- **THEN** its Metals stock never limits production, deliveries or unloads

### Requirement: Vehicles and routes
A format 2 scenario SHALL be able to define vehicles, each with a unique id, a route, a speed, a fixed dwell
time per stop, a dwell time per unit transferred, and a cargo capacity that is shared across resources or
stated per resource. A route SHALL be one of:

- `shuttle`: back and forth along a path of stations, reversing at each end.
- `loop`: around a closed path of stations, repeatedly.
- `timetable`: along a path from its first station at listed departure times, returning to wait at the
  first station after each trip.

Routes SHALL be fixed by the scenario. Vehicles choosing their own destinations SHALL NOT be supported.

#### Scenario: Loop route
- **WHEN** a vehicle has a loop route Depot–A–B–Depot
- **THEN** validation succeeds and the vehicle's stops repeat in that order for the whole run

#### Scenario: Timetable departures
- **WHEN** a vehicle has a timetable route from Depot to A and B with departures at hours 0 and 12
- **THEN** validation succeeds, and a departure listed before the previous trip can finish is reported as an
  error naming the departure

### Requirement: Converters
A station SHALL be able to define converters. Each converter SHALL take stated amounts of input resources
from the station and add stated amounts of output resources to it, in batches at a rate with the same
variability options as producers.

#### Scenario: Converter definition
- **WHEN** a converter at Factory takes 2000 Metals and produces 1000 MachineParts per batch at 12 batches
  per sol
- **THEN** validation succeeds if Factory stores both resources, and fails naming the resource otherwise

### Requirement: Suppliers and lead times
A station SHALL be able to name a supplier for a resource. A supplier SHALL be either external, with
unlimited stock, or another station that ships from its own stock. Each supplier SHALL state a lead time,
fixed or drawn from a discrete distribution, and optionally a minimum and maximum order size.

#### Scenario: External supplier
- **WHEN** Shop names an external supplier for Beer with a fixed lead time of two days
- **THEN** validation succeeds and orders placed by Shop for Beer are delivered after two days

#### Scenario: Supplier cycle
- **WHEN** A is supplied by B and B is supplied by A for the same resource
- **THEN** validation fails with an error naming the cycle

### Requirement: Reviews
A station SHALL be able to define a review schedule with a period and an offset. Reviews are when the
policy decides what to order for that station.

#### Scenario: Weekly review
- **WHEN** a station has a review period of seven days and an offset of zero
- **THEN** validation succeeds and reviews for that station occur at the start of every week of the run

### Requirement: Unmet demand handling
Each consumer SHALL state whether demand that cannot be met from stock is lost or backordered. Backordered
demand SHALL be served before new demand when stock arrives. The default SHALL be lost.

#### Scenario: Backorders declared
- **WHEN** a consumer declares that unmet demand is backordered
- **THEN** validation succeeds and the consumer's unmet demand is carried until stock arrives

### Requirement: Costs
A scenario SHALL be able to state integer costs: holding cost per unit per sol per station and resource,
a fixed cost per order and a cost per unit ordered per supplier, a transport cost per unit of distance per
vehicle, a cost per unit of lost demand and per unit per sol of backorders per consumer, and a cost per unit
of stalled production per producer. Costs that are not stated SHALL be zero.

#### Scenario: Costs are optional
- **WHEN** a scenario states no costs
- **THEN** validation succeeds and every cost is zero

### Requirement: Format 1 upgrade
Format 1 documents SHALL continue to be accepted. On load, a format 1 document SHALL be upgraded to an
equivalent format 2 document: stations become stations, consecutive stations are joined by arcs, and
trains become vehicles on shuttle routes along the line.

#### Scenario: Upgrading a starter scenario
- **WHEN** the format 1 `two-station` document is loaded
- **THEN** it is upgraded to a format 2 document with two stations, one arc and one vehicle on a shuttle
  route, and validation succeeds
