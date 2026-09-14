## ADDED Requirements

### Requirement: Ordering at reviews
A policy returned by `ops.policy` SHALL also handle reviews when its specification includes a `review` table
with a `target`, which accepts the same target blocks as stops. At a review, for each resource the stock
point has a supplier for, the policy SHALL order the target minus the inventory position, where the position
is stock plus orders on the way minus backorders, and SHALL order nothing when that difference is not
positive. `ops.min_max` at a review SHALL therefore behave as an (s, S) policy and `ops.order_up_to` as a
base-stock policy. Each ordering decision SHALL produce a decision trace.

#### Scenario: Base-stock order
- **WHEN** a station with stock 3000, 2000 on order and 1000 backordered is reviewed by
  `ops.policy { review = { target = ops.order_up_to { level = 10000 } } }`
- **THEN** it orders 6000 and records a trace naming `order_up_to`, position 4000 and target 10000

#### Scenario: (s, S) holds off
- **WHEN** the same station is reviewed by `review = { target = ops.min_max { min = 2000, max = 10000 } }`
- **THEN** it orders nothing, because its position of 4000 is not below the minimum
