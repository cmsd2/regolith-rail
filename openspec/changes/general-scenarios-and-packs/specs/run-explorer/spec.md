## ADDED Requirements

### Requirement: Review inspector
Selecting a review on the timeline SHALL show the station's snapshot at that review, the orders requested
and applied, orders on the way, backorders, warnings, decision traces, log messages and errors.

#### Scenario: Inspect a review
- **WHEN** the player selects a review marker for Shop after a run of `classic.reorder`
- **THEN** the inspector shows Shop's stock, the order placed with its arrival time, and the decision trace

### Requirement: Mod-ready indication
The workbench SHALL show whether the current policy and scenario pairing is mod-ready and, when it is not,
what prevents it.

#### Scenario: Classic template is not mod-ready
- **WHEN** the player selects a classic template with reviews
- **THEN** the workbench shows that the pairing is not mod-ready because the scenario has reviews

## MODIFIED Requirements

### Requirement: Scenario selection
The player SHALL be able to choose a starter scenario or a pack template, set a template's parameters in a
form with their documented defaults and ranges, edit the selected scenario as a script or as JSON with
errors shown in place, and choose the seed and run options.

#### Scenario: Invalid edit
- **WHEN** the player edits a scenario so it fails evaluation or validation
- **THEN** the errors are shown at their locations and Run is disabled until they are fixed

#### Scenario: Template parameters
- **WHEN** the player picks `classic.serial_chain` and sets the number of stages to 3 in the parameter form
- **THEN** the scenario is re-evaluated with three stages and the map shows three stations in series

## RENAMED Requirements

- FROM: `### Requirement: Line map`
- TO: `### Requirement: Map`

## MODIFIED Requirements

### Requirement: Map
The map SHALL show the scenario's stations and arcs, laid out as a straight line for a single line and as
a network otherwise, with stock, capacity and backorders for each stored resource, shipments in transit, and
each vehicle's position, direction and cargo, for the selected time. Playback SHALL animate the map with
play, pause and speed controls.

#### Scenario: Playback
- **WHEN** the player presses play after a run
- **THEN** vehicles move along their routes and stock levels change in time with the simulation

#### Scenario: Loop drawn as a network
- **WHEN** the player runs `classic.fixed_route_delivery`
- **THEN** the map shows the depot and customers joined by their arcs and the vehicle moving around the loop
