# simulation-engine Specification

## Purpose
Simulates one line of stations and trains under a policy, deterministically,
and produces the event log, time series and metrics that every view and
comparison is built on.

## Requirements

### Requirement: Determinism
A run SHALL be fully determined by its scenario, policy source, seed and run
options. The same inputs SHALL produce an identical event log, time series and
metrics in Node and in current Chromium, Firefox and WebKit.

#### Scenario: Repeat run
- **WHEN** the same scenario, policy and seed are run twice
- **THEN** the event logs are byte-for-byte identical

#### Scenario: Cross-environment run
- **WHEN** the starter scenarios are run with the naive baseline on seeds 1 to
  20 in Node, Chromium, Firefox and WebKit
- **THEN** every environment produces the same result hash for every run

### Requirement: Independent randomness
Each source of randomness in a scenario SHALL draw from its own stream derived
from the seed, so that adding, removing or changing one source does not change
the values drawn by any other source.

#### Scenario: Adding a consumer
- **WHEN** a consumer is added at one station and the run is repeated with the
  same seed
- **THEN** the production and consumption amounts of every other producer and
  consumer are unchanged

### Requirement: Train movement
Trains SHALL travel from one end of the line to the other, stop at every
station, and reverse at the terminal stations. Travel time SHALL follow from
distance and speed. Dwell time at a stop SHALL be the fixed dwell plus the
per-unit dwell multiplied by the amount transferred. Trains on the same line
SHALL NOT block one another.

#### Scenario: Reversal at the end
- **WHEN** a train heading towards the last station arrives there
- **THEN** after its stop it departs towards the first station

#### Scenario: Dwell depends on transfer
- **WHEN** a train transfers 12000 milli-units at a stop with a fixed dwell of
  10 s and a per-unit dwell of 1 s
- **THEN** the train departs 22 s after arriving

### Requirement: Production and consumption
Producers SHALL add to their station's stock and consumers SHALL draw from it
at their effective rates: the base rate with its variability, multiplied by the
effects of every active event that applies to the flow. Production and
consumption SHALL be applied once per game minute. Production that does not fit
in the station SHALL be recorded as stalled production. Consumption that cannot
be met from stock SHALL be recorded as unmet demand. Events SHALL NOT change
train movement or dwell.

#### Scenario: Demand shock during an event
- **WHEN** a consumer of 24000 per sol is covered by an active demand effect with
  multiplier 3000 for one game hour
- **THEN** it asks for 3000 milli-units during that hour instead of 1000

#### Scenario: Trains unaffected by events
- **WHEN** a storm is active across the whole line
- **THEN** train arrival and departure times are the same as in the same run
  without the storm

#### Scenario: Full station
- **WHEN** a station's stock of a resource is at capacity and its producer is
  active
- **THEN** stock stays at capacity and stalled production increases by the
  amount that could not be stored

#### Scenario: Empty station
- **WHEN** a station's stock of a resource is zero and its consumer is active
- **THEN** stock stays at zero and unmet demand increases by the amount that
  could not be consumed

### Requirement: Stops and actions
When a train arrives at a station the engine SHALL call the policy, then apply
the returned actions in the order issued. Each load or unload SHALL be clamped
to what is physically possible given station stock, station capacity, train
cargo and train capacity. A clamped action SHALL produce a warning event
recording the requested and applied amounts. An action for a resource the
station does not enable SHALL be ignored with a warning.

#### Scenario: Load more than available
- **WHEN** a policy loads 20000 Metals at a station holding 8000
- **THEN** 8000 is loaded and a warning records 20000 requested and 8000
  applied

#### Scenario: Actions in order
- **WHEN** a train with shared capacity is full of Food at a station with room
  for 5000 Food and 5000 Metals in stock, and the policy unloads 5000 Food and
  then loads 5000 Metals
- **THEN** both actions are applied in full

### Requirement: Policy failures
If the policy raises an error or exceeds its instruction budget at a stop, the
train SHALL perform no transfers at that stop, the engine SHALL record an error
event with the message, station, train and time, and the run SHALL continue.

#### Scenario: Error at one stop
- **WHEN** a policy raises an error at its third stop
- **THEN** that stop transfers nothing, an error event is recorded, and later
  stops are processed normally

### Requirement: Conservation
The total amount of every resource SHALL equal the amount produced minus the
amount consumed, counting station stock and train cargo, at every point in a
run.

#### Scenario: Conservation holds for arbitrary scenarios
- **WHEN** randomly generated valid scenarios are run with randomly behaving
  policies
- **THEN** conservation holds and stock and cargo stay within zero and capacity
  at every event

### Requirement: Run output
A run SHALL produce an event log, time series and metrics. The event log SHALL
include arrivals, departures, transfers, warnings, policy log messages, policy
records, decision traces, errors, and event starts and ends. Time series SHALL
include stock per station and resource and cargo per train and resource,
sampled at a fixed interval.

#### Scenario: Reconstruct state from output
- **WHEN** the state of the line at any time within the run is requested from
  the output
- **THEN** station stock, train positions and train cargo at that time are
  available without re-running the simulation

### Requirement: Metrics
A run SHALL report these metrics, each defined in the documentation:

- Unmet demand, weighted by resource priority.
- Stalled production.
- Demand met: the total amount consumed.
- Empty distance share: distance travelled with no cargo divided by total
  distance travelled.
- Total dwell time.
- Oscillation count: the number of times a resource is loaded at a station
  within one full round trip of the loading train after the same resource was
  unloaded there.
- Policy errors and budget overruns.

#### Scenario: Oscillation counted
- **WHEN** a train unloads Metals at station B and a train loads Metals at B
  before the first train completes its next round trip
- **THEN** the oscillation count increases by one

#### Scenario: Priority weighting
- **WHEN** 1000 milli-units of a priority 3 resource and 1000 of a priority 1
  resource go unmet
- **THEN** weighted unmet demand is 4000

### Requirement: Command-line runner
A command-line runner SHALL run a scenario with a policy and seed, or a range
of seeds, and write the run output and metrics as JSON.

#### Scenario: Headless run
- **WHEN** the runner is given `two-station`, `naive.lua` and seed 7
- **THEN** it writes the metrics and event log for that run and exits
  successfully

#### Scenario: Invalid scenario
- **WHEN** the runner is given a scenario that fails validation
- **THEN** it prints the validation errors and exits with a non-zero status
