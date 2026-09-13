## ADDED Requirements

### Requirement: Network topology
A format 2 scenario SHALL describe stock points and the arcs between them. Each stock point SHALL have a
unique id and the resources it stores, each with a capacity that is either an integer or unlimited, and
optionally stock that expires at each review. Each arc SHALL join two stock points with a positive distance
and SHALL be usable in both directions. A line SHALL be expressible as stock points joined in order by arcs.

#### Scenario: Line as a network
- **WHEN** stock points A, B and C are joined by arcs A–B of 400 and B–C of 600
- **THEN** validation succeeds and the distance along the arcs from A to C is 1000

#### Scenario: Disconnected route
- **WHEN** a route visits two stock points that no arc joins
- **THEN** validation fails with an error naming the route and the two stock points

#### Scenario: Unlimited capacity
- **WHEN** a stock point stores Metals with unlimited capacity
- **THEN** its Metals stock never limits production, deliveries or unloads

### Requirement: Vehicles and routes
A format 2 scenario SHALL be able to define vehicles, each with a unique id, a route, a speed, a fixed dwell
time per stop, a dwell time per unit transferred, and a cargo capacity that is shared across resources or
stated per resource. A route SHALL be one of:

- `shuttle`: back and forth along a path of stock points, reversing at each end.
- `loop`: around a closed path of stock points, repeatedly.
- `timetable`: along a path from its first stock point at listed departure times, returning to wait at the
  first stock point after each trip.

Routes SHALL be fixed by the scenario. Vehicles choosing their own destinations SHALL NOT be supported.

#### Scenario: Loop route
- **WHEN** a vehicle has a loop route Depot–A–B–Depot
- **THEN** validation succeeds and the vehicle's stops repeat in that order for the whole run

#### Scenario: Timetable departures
- **WHEN** a vehicle has a timetable route from Depot to A and B with departures at hours 0 and 12
- **THEN** validation succeeds, and a departure listed before the previous trip can finish is reported as an
  error naming the departure

### Requirement: Converters
A stock point SHALL be able to define converters. Each converter SHALL take stated amounts of input resources
from the stock point and add stated amounts of output resources to it, in batches at a rate with the same
variability options as producers.

#### Scenario: Converter definition
- **WHEN** a converter at Factory takes 2000 Metals and produces 1000 MachineParts per batch at 12 batches
  per sol
- **THEN** validation succeeds if Factory stores both resources, and fails naming the resource otherwise

### Requirement: Suppliers and lead times
A stock point SHALL be able to name a supplier for a resource. A supplier SHALL be either external, with
unlimited stock, or another stock point that ships from its own stock. Each supplier SHALL state a lead time,
fixed or drawn from a discrete distribution, and optionally a minimum and maximum order size.

#### Scenario: External supplier
- **WHEN** Shop names an external supplier for Beer with a fixed lead time of two days
- **THEN** validation succeeds and orders placed by Shop for Beer are delivered after two days

#### Scenario: Supplier cycle
- **WHEN** A is supplied by B and B is supplied by A for the same resource
- **THEN** validation fails with an error naming the cycle

### Requirement: Reviews
A stock point SHALL be able to define a review schedule with a period and an offset. Reviews are when the
policy decides what to order for that stock point.

#### Scenario: Weekly review
- **WHEN** a stock point has a review period of seven days and an offset of zero
- **THEN** validation succeeds and reviews for that stock point occur at the start of every week of the run

### Requirement: Unmet demand handling
Each consumer SHALL state whether demand that cannot be met from stock is lost or backordered. Backordered
demand SHALL be served before new demand when stock arrives. The default SHALL be lost.

#### Scenario: Backorders declared
- **WHEN** a consumer declares that unmet demand is backordered
- **THEN** validation succeeds and the consumer's unmet demand is carried until stock arrives

### Requirement: Costs
A scenario SHALL be able to state integer costs: holding cost per unit per sol per stock point and resource,
a fixed cost per order and a cost per unit ordered per supplier, a transport cost per unit of distance per
vehicle, a cost per unit of lost demand and per unit per sol of backorders per consumer, and a cost per unit
of stalled production per producer. Costs that are not stated SHALL be zero.

#### Scenario: Costs are optional
- **WHEN** a scenario states no costs
- **THEN** validation succeeds and every cost is zero

### Requirement: Format 1 upgrade
Format 1 documents SHALL continue to be accepted. On load, a format 1 document SHALL be upgraded to an
equivalent format 2 document: stations become stock points, consecutive stations are joined by arcs, and
trains become vehicles on shuttle routes along the line.

#### Scenario: Upgrading a starter scenario
- **WHEN** the format 1 `two-station` document is loaded
- **THEN** it is upgraded to a format 2 document with two stock points, one arc and one vehicle on a shuttle
  route, and validation succeeds

## MODIFIED Requirements

### Requirement: Scenario document
A scenario SHALL be a single JSON document containing a format version, an id, a title, a description, a run
duration, resources, stock points, arcs, vehicles, flows, events, costs, an information level and a base
seed. This version SHALL write format 2 and SHALL read formats 1 and 2.

Quantities SHALL be integers in milli-units (1 unit = 1000 milli-units), times SHALL be integers in
milliseconds of game time, distances SHALL be integers, and rates SHALL be integers in milli-units per sol,
where one sol is 24 game hours (86,400,000 ms of game time).

#### Scenario: Minimal valid scenario
- **WHEN** a format 2 scenario defines two stock points joined by an arc, one resource, one vehicle on a
  shuttle route, one producer, one consumer, a duration and a base seed
- **THEN** validation succeeds and every omitted optional field takes its documented default

#### Scenario: Default station capacity
- **WHEN** a stock point stores a resource without stating a capacity
- **THEN** that stock point's capacity for the resource is 30000 milli-units

### Requirement: Producers and consumers
Each stock point SHALL be able to define producers and consumers per stored resource. Each SHALL have a
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
- **WHEN** a producer is defined for a resource the stock point does not store
- **THEN** validation fails with an error naming the stock point and resource

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
- **WHEN** `two-station` is run with the naive baseline while consumption is raised above half of what the
  train can carry per round trip
- **THEN** unmet demand is greater than zero while the supply station's production stalls

## REMOVED Requirements

### Requirement: Line topology
**Reason**: Scenarios now describe networks of stock points joined by arcs; a line is one kind of network.
**Migration**: Format 1 lines are upgraded on load to stock points joined in order by arcs (see Format 1
upgrade). New scenarios use the network topology directly or the Mars pack's line construct.

### Requirement: Trains
**Reason**: Replaced by vehicles on routes, where a shuttle route is what a train did before.
**Migration**: Format 1 trains are upgraded to vehicles on shuttle routes along the line with the same
speed, dwell times, capacity, start station and direction.
