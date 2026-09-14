## MODIFIED Requirements

### Requirement: Ready on first visit
Opening the application with no saved work and no share link SHALL fill the Scenario slot with `two-station`
and the Policy slot with the naive baseline, show the baseline in the editor, and be ready to run.

#### Scenario: First visit
- **WHEN** a new visitor opens the application
- **THEN** the Scenario slot shows `two-station`, the Policy slot shows the naive baseline, the editor contains
  it, and pressing Run starts a run without further setup

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

## ADDED Requirements

### Requirement: Policy selection
The player SHALL be able to run any policy in the library in a single run, including built-in, example,
classic reference, shared and imported policies, by filling the Policy slot with it. The editor SHALL show
which library item the policy comes from.

#### Scenario: Run a built-in policy
- **WHEN** the player uses the built-in supply-to-demand policy and presses Run
- **THEN** the run uses supply-to-demand on the current scenario, and the editor names supply-to-demand as its
  source
