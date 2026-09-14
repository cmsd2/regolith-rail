# classic-problems-pack Specification

## Purpose
Provides ready-made, parameterised versions of well-known operations research problems, so players can
explore the techniques the documentation teaches and the engine can be checked against known results.

## Requirements

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
- `safety_stock`: one station reviewed periodically and replenished after a random lead time, facing random
  demand with backorders, with a target cycle service level.
- `forecasting`: one station reviewed periodically, facing demand with a level, a linear trend, an optional
  seasonal pattern and optional random noise, replenished after a lead time.

#### Scenario: Template with defaults
- **WHEN** a script returns `classic.newsvendor {}`
- **THEN** the evaluated document is valid and describes one station with expiring stock, a demand
  distribution per period and a daily review

#### Scenario: Template with parameters
- **WHEN** a script returns `classic.serial_chain { stages = 4, lead_time = weeks(2) }`
- **THEN** the evaluated document has four stations in series, each supplied by the previous one with a
  two-week lead time

#### Scenario: Safety stock with random lead times
- **WHEN** a script returns `classic.safety_stock { lead_time = discrete { { days(1), 1 }, { days(3), 1 } } }`
- **THEN** the evaluated document's supplier has lead times of one and three days with equal weights

#### Scenario: Forecasting with a trend
- **WHEN** a script returns `classic.forecasting { level = 20, trend = 1, noise = false }`
- **THEN** the evaluated document's demand starts at 20 units per day and rises by 1 unit per day each day

### Requirement: Reference results
Where a template has a known analytic result, the template SHALL provide it for the chosen parameters. A test
SHALL run the template with the matching reference policy and check the engine's result against the analytic
value: over many seeds within the confidence interval of the simulated mean for random scenarios, and to within
a stated tolerance for deterministic ones.

#### Scenario: Newsvendor optimum
- **WHEN** `newsvendor` is run with an order-up-to policy at the critical-ratio quantity over 400 seeds
- **THEN** the analytic expected cost per period lies within the 99% confidence interval of the simulated
  mean cost per period

#### Scenario: Economic order quantity
- **WHEN** `reorder` with deterministic demand and zero lead time is run with the economic order quantity
- **THEN** the simulated cost per sol equals the analytic cost to within one cost unit per sol

#### Scenario: Cycle service level
- **WHEN** `safety_stock` is run over 400 seeds with its reference policy's order-up-to level for a target
  cycle service level of 95%
- **THEN** the analytic probability that a review cycle ends without backorders lies within the 99% confidence
  interval of the simulated share of such cycles

#### Scenario: Smoothing lag under a trend
- **WHEN** `forecasting` with a linear trend, no seasonality and no noise is run with its reference policy's
  simple exponential smoothing at weight α
- **THEN** after the warm-up each forecast trails the demand of the period it forecasts by the trend divided
  by α, and the demand just observed by the trend times (1 − α) / α, each to within one unit

### Requirement: Classic reference policies
The pack SHALL ship a reference policy for each template, written with `ops` or plain Lua, so that a player
can run any template immediately and compare their own policy with it.

#### Scenario: Run a template at once
- **WHEN** a player picks the `reorder` template and presses Run
- **THEN** the run uses the template's reference policy without further setup

### Requirement: Classic problem pages
Each template SHALL have a documentation page that states the problem, its assumptions, the reference
result and policy, where the simulator's setting differs from the textbook setting, and references to the
literature listed in the roadmap. The page SHALL be a template reference page or a Book chapter that covers
the template.

#### Scenario: Template links to its page
- **WHEN** a player puts a classic template in the Scenario slot
- **THEN** This run shows an About this problem link to that template's reference page or Book chapter
