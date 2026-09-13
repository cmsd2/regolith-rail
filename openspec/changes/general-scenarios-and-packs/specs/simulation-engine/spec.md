## ADDED Requirements

### Requirement: Vehicle movement
Vehicles SHALL follow their routes, stopping at every stock point on them. Shuttle vehicles SHALL reverse at
each end of their path, loop vehicles SHALL continue from the last stock point of their loop to the first,
and timetable vehicles SHALL depart from the first stock point of their path at each listed time and return
to wait there. Travel time SHALL follow from arc distance and speed. Dwell time at a stop SHALL be the fixed
dwell plus the per-unit dwell multiplied by the amount transferred. Vehicles SHALL NOT block one another.

#### Scenario: Reversal at the end
- **WHEN** a shuttle vehicle heading towards the last stock point of its path arrives there
- **THEN** after its stop it departs towards the first stock point of its path

#### Scenario: Loop continues
- **WHEN** a loop vehicle on Depot–A–B–Depot finishes its stop at B
- **THEN** it travels to Depot and then to A

#### Scenario: Dwell depends on transfer
- **WHEN** a vehicle transfers 12000 milli-units at a stop with a fixed dwell of 10 s and a per-unit dwell
  of 1 s
- **THEN** the vehicle departs 22 s after arriving

### Requirement: Converters in operation
A converter SHALL run a batch only when its stock point holds all of the batch's inputs and has room for all
of its outputs. It SHALL record time starved of inputs and time blocked by full outputs.

#### Scenario: Starved converter
- **WHEN** a converter needs 2000 Metals per batch and its stock point holds 1000
- **THEN** no batch runs, Metals stock is unchanged and starved time increases

### Requirement: Reviews and orders
At each review of a stock point the engine SHALL call the policy's review hook and apply the orders it
returns. An order to an external supplier SHALL arrive after the supplier's lead time. An order to a stock
point supplier SHALL ship from that stock point's stock, as much as it holds, with the rest backordered
there and shipped as stock arrives, and each shipment SHALL arrive after the lead time. Orders outside a
supplier's minimum or maximum size SHALL be clamped with a warning. Deliveries that do not fit SHALL be
recorded as overflow.

#### Scenario: Delivery after lead time
- **WHEN** a stock point orders 5000 Beer from an external supplier with a lead time of two days at hour 0
- **THEN** 5000 Beer is added to its stock at hour 48

#### Scenario: Upstream shortage
- **WHEN** a stage orders 8000 from an upstream stage holding 3000
- **THEN** 3000 ships immediately, 5000 is backordered at the upstream stage, and the rest ships when the
  upstream stage receives stock

### Requirement: Expiring stock
At each review of a stock point whose stock expires, the stock of the expiring resources SHALL be removed
before the review hook is called and recorded as expired.

#### Scenario: Unsold stock expires
- **WHEN** a newsvendor stock point holds 3000 at its review
- **THEN** expired stock increases by 3000 and the review hook sees zero stock

### Requirement: Cost accounting
When a scenario states costs, a run SHALL accumulate them exactly as integers and report the total and each
component: holding, ordering, transport, lost demand, backorders and stalled production.

#### Scenario: Holding cost
- **WHEN** a stock point holds 2000 milli-units for one sol with a holding cost of 3 per unit per sol
- **THEN** holding cost increases by 6

### Requirement: Format 1 results unchanged
Running an upgraded format 1 scenario SHALL produce the same event log, time series and values for every
metric that existed before format 2 was introduced. New output fields MAY be added, and the golden result
file MAY be regenerated once they are, provided the fields that existed before are unchanged.

#### Scenario: Golden hashes
- **WHEN** the golden matrix of starter scenarios, policies and seeds is run after this change, and each
  result is hashed without the output fields added by this change
- **THEN** every hash equals the golden hash recorded before this change

## MODIFIED Requirements

### Requirement: Production and consumption
Producers SHALL add to their stock point's stock and consumers SHALL draw from it according to their
processes, multiplied by the effects of every active event that applies to the flow. Rate-based production
and consumption SHALL be applied once per game minute; arrival and per-period processes SHALL be applied at
their arrival and period times. Production that does not fit SHALL be recorded as stalled production.
Consumption that cannot be met from stock SHALL be recorded as unmet demand and, for backordering consumers,
added to their backorders, which SHALL be served first when stock becomes available. Events SHALL NOT change
vehicle movement or dwell.

#### Scenario: Demand shock during an event
- **WHEN** a consumer of 24000 per sol is covered by an active demand effect with multiplier 3000 for one
  game hour
- **THEN** it asks for 3000 milli-units during that hour instead of 1000

#### Scenario: Trains unaffected by events
- **WHEN** a storm is active across the whole network
- **THEN** vehicle arrival and departure times are the same as in the same run without the storm

#### Scenario: Full station
- **WHEN** a stock point's stock of a resource is at capacity and its producer is active
- **THEN** stock stays at capacity and stalled production increases by the amount that could not be stored

#### Scenario: Empty station
- **WHEN** a stock point's stock of a resource is zero and its losing consumer is active
- **THEN** stock stays at zero and unmet demand increases by the amount that could not be consumed

#### Scenario: Backorders served first
- **WHEN** a backordering consumer has 4000 backordered and 6000 arrives at its stock point
- **THEN** the backorder is cleared first and 2000 remains for new demand

### Requirement: Conservation
For every resource, the amount in the system SHALL equal the amounts produced, converted in, and delivered by
external suppliers, minus the amounts consumed, converted out, expired and lost to overflow, counting stock
at stock points, cargo on vehicles and shipments in transit, at every point in a run.

#### Scenario: Conservation holds for arbitrary scenarios
- **WHEN** randomly generated valid format 2 scenarios are run with randomly behaving policies
- **THEN** conservation holds and stock and cargo stay within zero and capacity at every event

### Requirement: Metrics
A run SHALL report these metrics, each defined in the documentation:

- Unmet demand, weighted by resource priority.
- Stalled production.
- Demand met: the total amount consumed.
- Backorders: the time-average backordered amount and the largest backorder.
- Expired stock and delivery overflow.
- Converter starved and blocked time.
- Empty distance share: distance travelled with no cargo divided by total distance travelled.
- Total dwell time.
- Oscillation count: the number of times a resource is loaded at a stock point within one full round of the
  loading vehicle's route after the same resource was unloaded there.
- Total cost and each cost component, when the scenario states costs.
- Policy errors and budget overruns.

#### Scenario: Oscillation counted
- **WHEN** a vehicle unloads Metals at stock point B and a vehicle loads Metals at B before the first vehicle
  completes its next round of its route
- **THEN** the oscillation count increases by one

#### Scenario: Priority weighting
- **WHEN** 1000 milli-units of a priority 3 resource and 1000 of a priority 1 resource go unmet
- **THEN** weighted unmet demand is 4000

### Requirement: Command-line runner
A command-line runner SHALL run a scenario given as a JSON document, a scenario script or a pack template
with parameters, with a policy and a seed or range of seeds, and write the run output and metrics as JSON.

#### Scenario: Headless run
- **WHEN** the runner is given `two-station`, `naive.lua` and seed 7
- **THEN** it writes the metrics and event log for that run and exits successfully

#### Scenario: Template run
- **WHEN** the runner is given the `classic.reorder` template with a lead time parameter and its reference
  policy
- **THEN** it evaluates the template, runs it and writes the metrics including costs

#### Scenario: Invalid scenario
- **WHEN** the runner is given a scenario that fails validation or a script that fails evaluation
- **THEN** it prints the errors and exits with a non-zero status

## REMOVED Requirements

### Requirement: Train movement
**Reason**: Replaced by Vehicle movement, which covers shuttles as before plus loops and timetables.
**Migration**: Trains in format 1 scenarios are upgraded to vehicles on shuttle routes, which move exactly as
trains did.
