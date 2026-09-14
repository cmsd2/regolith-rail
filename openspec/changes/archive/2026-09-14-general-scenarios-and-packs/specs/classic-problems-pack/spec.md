## Purpose

Provides ready-made, parameterised versions of well-known operations research problems, so players can
explore the techniques the documentation teaches and the engine can be checked against known results.

## ADDED Requirements

### Requirement: Classic templates
A `classic` construct library SHALL be available to scenario scripts with templates that each return a
complete scenario from named parameters with documented defaults:

- `newsvendor`: one station whose unsold stock expires at each review, facing random demand per period.
- `reorder`: one station replenished from an external supplier after a lead time, facing deterministic
  or random demand, with holding, ordering and shortage costs, suited to economic order quantity, (s, S) and
  base-stock policies.
- `serial_chain`: stations in series, each ordering from the one upstream with a shipping lead time, with
  customer demand at the last, in the style of the beer game.
- `fixed_route_delivery`: a depot supplied externally and customers visited by vehicles on a fixed loop.

#### Scenario: Template with defaults
- **WHEN** a script returns `classic.newsvendor {}`
- **THEN** the evaluated document is valid and describes one station with expiring stock, a demand
  distribution per period and a daily review

#### Scenario: Template with parameters
- **WHEN** a script returns `classic.serial_chain { stages = 4, lead_time = weeks(2) }`
- **THEN** the evaluated document has four stations in series, each supplied by the previous one with a
  two-week lead time

### Requirement: Reference results
Where a template has a known analytic result, the template SHALL provide it for the chosen parameters. A test
SHALL run the template with the matching reference policy over many seeds and check that the engine's mean
agrees with the analytic value within its confidence interval.

#### Scenario: Newsvendor optimum
- **WHEN** `newsvendor` is run with an order-up-to policy at the critical-ratio quantity over 400 seeds
- **THEN** the analytic expected cost per period lies within the 99% confidence interval of the simulated
  mean cost per period

#### Scenario: Economic order quantity
- **WHEN** `reorder` with deterministic demand and zero lead time is run with the economic order quantity
- **THEN** the simulated cost per sol equals the analytic cost to within one cost unit per sol

### Requirement: Classic reference policies
The pack SHALL ship a reference policy for each template, written with `ops` or plain Lua, so that a player
can run any template immediately and compare their own policy with it.

#### Scenario: Run a template at once
- **WHEN** a player picks the `reorder` template and presses Run
- **THEN** the run uses the template's reference policy without further setup

### Requirement: Classic problem pages
Each template SHALL have a documentation page that states the problem, its assumptions, the reference
result and policy, where the simulator's setting differs from the textbook setting, and references to the
literature listed in the roadmap.

#### Scenario: Template links to its page
- **WHEN** a player selects a classic template in the scenario picker
- **THEN** the picker shows a link to that template's documentation page
