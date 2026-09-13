# run-explorer Specification

## Purpose
Lets a player edit a policy, run it on one scenario and seed, and understand
what happened and why through a map, charts, a timeline and a stop inspector.

## Requirements

### Requirement: Ready on first visit
Opening the application with no saved work and no share link SHALL show the
`two-station` scenario with the naive baseline in the editor, ready to run.

#### Scenario: First visit
- **WHEN** a new visitor opens the application
- **THEN** the editor contains the naive baseline, `two-station` is selected,
  and pressing Run starts a run without further setup

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
The player SHALL be able to choose a starter scenario, edit the selected
scenario as JSON with validation errors shown in place, and choose the seed and
run options.

#### Scenario: Invalid edit
- **WHEN** the player edits a scenario so it fails validation
- **THEN** the errors are shown at their locations and Run is disabled until
  they are fixed

### Requirement: Responsive runs
Runs SHALL execute without blocking the interface, SHALL show progress, and
SHALL be cancellable.

#### Scenario: Cancel a long run
- **WHEN** the player cancels a run in progress
- **THEN** the run stops, the interface remains usable, and the previous result
  stays visible

### Requirement: Line map
The map SHALL show the stations in line order with stock and capacity for each
enabled resource, and each train's position, direction and cargo, for the
selected time. Playback SHALL animate the map with play, pause and speed
controls.

#### Scenario: Playback
- **WHEN** the player presses play after a run
- **THEN** trains move along the line and stock levels change in time with the
  simulation

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
