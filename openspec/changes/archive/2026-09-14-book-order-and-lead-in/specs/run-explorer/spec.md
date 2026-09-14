## MODIFIED Requirements

### Requirement: Charts
The view SHALL chart stock over time per station and resource, cargo over time
per train, every series recorded by the policy, and a summary of the run's
metrics with links to their definitions. Below the metrics it SHALL tabulate the run's
long-run averages: for each station and resource, the average stock, the flow in and out
in units a day, the time a unit stays by Little's law (stock over the outflow), and the
time measured by following each unit that left, first in first out; and for each resource
across the line, the stock at stations and aboard vehicles, the consumption a day, and the
time from arrival to use. The definitions SHALL be documented with the metrics.

#### Scenario: Recorded series charted
- **WHEN** a policy records a series named `target`
- **THEN** a `target` chart appears after the run

#### Scenario: Averages tabulated
- **WHEN** the player runs the `relay` starter with the balancing baseline and opens Metrics
- **THEN** a table lists Mine, Junction and Dome with their average stock, flows a day and
  the two times, and a line row for Metals with its stock including cargo and its time
