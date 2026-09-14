# run-explorer Specification

## Purpose
Lets a player edit a policy, run it on one scenario and seed, and understand
what happened and why through a map, charts, a timeline and a stop inspector.

## Requirements

### Requirement: Ready on first visit
Opening the application with no saved work and no share link SHALL fill the Scenario slot with `two-station`
and the Policy slot with the balancing baseline, show the baseline in the editor, and be ready to run.

#### Scenario: First visit
- **WHEN** a new visitor opens the application
- **THEN** the Scenario slot shows `two-station`, the Policy slot shows the balancing baseline, the editor contains
  it, and pressing Run starts a run without further setup

### Requirement: Policy editor
The editor SHALL provide Lua syntax highlighting, show load errors and language
subset violations at their lines as the author types, offer completion for the
Policy API and `ops`, and show documentation summaries on hover with a link to
the full page.

#### Scenario: Violation shown while typing
- **WHEN** the author types `goto done`
- **THEN** the line is marked with the subset violation message before any run

#### Scenario: Hover help
- **WHEN** the author hovers over `ops.min_max`
- **THEN** a summary of the block and its parameters appears with a link to its
  documentation page

### Requirement: Scenario selection
The player SHALL be able to choose the scenario from the library, whether a starter scenario, a pack
template or one of their own.

- **Templates:** set a template's parameters in a form, next to the scenario, with their documented defaults
  and ranges.
- **Editing:** edit the scenario in the Scenario slot as a script or as JSON, with errors shown in place.
- **Run options:** choose the seed and run options.
- **Documentation:** the scenario's documentation link SHALL stay next to the scenario.

#### Scenario: Invalid edit
- **WHEN** the player edits a scenario so it fails evaluation or validation
- **THEN** the errors are shown at their locations and Run is disabled until they are fixed

#### Scenario: Template parameters
- **WHEN** the player uses `classic.serial_chain` from the library and sets the number of stages to 3 in the
  parameter form
- **THEN** the scenario is re-evaluated with three stages and the map shows three stations in series

### Requirement: Responsive runs
Runs SHALL execute without blocking the interface, SHALL show progress, and
SHALL be cancellable.

#### Scenario: Cancel a long run
- **WHEN** the player cancels a run in progress
- **THEN** the run stops, the interface remains usable, and the previous result
  stays visible

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

### Requirement: Charts
The view SHALL chart stock over time per station and resource, cargo over time
per train, every series recorded by the policy, and a summary of the run's
metrics with links to their definitions.

#### Scenario: Recorded series charted
- **WHEN** a policy records a series named `target`
- **THEN** a `target` chart appears after the run

### Requirement: Timeline
A timeline SHALL let the player move to any time in the run. The map and charts
SHALL show the state at that time without re-running the simulation. The
timeline SHALL mark stops, warnings, errors and events.

#### Scenario: Jump to an error
- **WHEN** the player selects an error marker on the timeline
- **THEN** the map, charts and inspector show the stop where the error occurred

### Requirement: Stop inspector
Selecting a stop SHALL show the snapshot the policy received, the actions it
requested, the amounts actually applied with any warnings, decision traces
linked to block documentation, log messages, records and errors.

#### Scenario: Clamped action shown
- **WHEN** the player inspects a stop where a load was clamped
- **THEN** the inspector shows the requested and applied amounts and the reason

### Requirement: Error navigation
Every error from a run SHALL be listed, and selecting one SHALL move the
timeline to its stop and the editor to its line.

#### Scenario: Error to source
- **WHEN** the player selects a runtime error on line 14
- **THEN** the editor scrolls to line 14 and highlights it, and the timeline
  moves to the stop

### Requirement: Unsupported browsers
The application SHALL detect browsers lacking the features it needs and show a
message naming the supported browsers instead of failing silently.

#### Scenario: Missing feature
- **WHEN** the application opens in a browser without WebAssembly support
- **THEN** a message explains that the browser is unsupported

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

### Requirement: Policy selection
The player SHALL be able to run any policy in the library in a single run, including built-in, example,
classic reference, shared and imported policies, by filling the Policy slot with it. The editor SHALL show
which library item the policy comes from.

#### Scenario: Run a built-in policy
- **WHEN** the player uses the built-in supply-to-demand policy and presses Run
- **THEN** the run uses supply-to-demand on the current scenario, and the editor names supply-to-demand as its
  source
