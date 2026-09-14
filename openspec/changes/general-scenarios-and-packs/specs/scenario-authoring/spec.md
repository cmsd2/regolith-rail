## Purpose

Lets players and pack authors write scenarios concisely as sandboxed Lua scripts that call a library of
constructs and evaluate to a validated scenario document.

## ADDED Requirements

### Requirement: Scenario scripts
A scenario script SHALL be Lua source that returns a scenario built from constructs. Evaluating a script
SHALL produce a scenario document in the current format, which SHALL then be validated like any other
scenario document. Scripts SHALL be subject to the same portable language subset and sandbox as policies,
and SHALL have no access to policy hooks, randomness or the current time.

#### Scenario: Script evaluates to a document
- **WHEN** a script returns a line of two stations, one train, a producer and a consumer built from
  constructs
- **THEN** evaluation produces a scenario document that passes validation and can be run

#### Scenario: Randomness at authoring time
- **WHEN** a script calls `math.random()`
- **THEN** evaluation fails with an error stating that scenario randomness belongs in demand and event
  processes

### Requirement: Deterministic evaluation
Evaluating the same script SHALL always produce the same scenario document, byte for byte, in Node and in
every supported browser.

#### Scenario: Repeat evaluation
- **WHEN** a script that builds stations in a loop over a table is evaluated twice
- **THEN** both evaluations produce identical documents, including the order of stations and resources

### Requirement: Errors at script lines
Syntax errors, runtime errors and invalid construct parameters SHALL be reported at the script line that
caused them. Validation errors in the resulting document SHALL be reported at the line of the construct
call that produced the invalid part, together with the document path.

#### Scenario: Invalid parameter
- **WHEN** line 7 of a script calls a station construct with a negative capacity
- **THEN** the error names line 7, the construct and the parameter

#### Scenario: Reference to an unknown station
- **WHEN** a route built on line 12 lists a station that no construct defines
- **THEN** the validation error is reported at line 12 with the path of the route stop

### Requirement: Construct library
A core construct library SHALL be available to every script, covering every part of the scenario format:
resources, stations, arcs, lines, vehicles and routes, producers, consumers, converters, suppliers,
demand processes, events and costs. Constructs SHALL take a table of named parameters, apply documented
defaults, and return plain tables that a script can modify before returning the scenario.

#### Scenario: Defaults applied
- **WHEN** a script creates a station without a capacity
- **THEN** the resulting document states the documented default capacity

#### Scenario: Modifying a construct's result
- **WHEN** a script builds a line with a construct and then changes one station's capacity in the returned
  table
- **THEN** the resulting document has the changed capacity

### Requirement: Units in scripts
Constructs SHALL accept quantities in whole or decimal units and durations with explicit units, including
minutes, hours, sols, days and weeks, and SHALL convert them exactly to the integer units of the scenario
format. A value that cannot be represented exactly SHALL be rejected with an error naming the value and the
nearest representable values.

#### Scenario: Durations with units
- **WHEN** a script sets a lead time of `sols(1.5)`
- **THEN** the document states a lead time of 129600000 ms

#### Scenario: Unrepresentable quantity
- **WHEN** a script sets a capacity of 0.0005 units
- **THEN** evaluation fails, stating that quantities have a resolution of 0.001 units

### Requirement: Evaluation limits
Script evaluation SHALL be limited by an instruction budget and by limits on document size, including the
number of stations, arcs, vehicles and events. Exceeding a limit SHALL fail evaluation with an error
naming the limit.

#### Scenario: Runaway script
- **WHEN** a script loops forever
- **THEN** evaluation stops and reports that the instruction budget was exceeded

### Requirement: Construct reference data
Every construct and every construct parameter SHALL be described once, with its type, default and summary.
That description SHALL drive editor completion and hover help, the scenario construct reference
documentation, and a check that the construct library and its description match.

#### Scenario: Undescribed parameter
- **WHEN** a parameter is added to a construct without a description
- **THEN** the construct reference check fails and names the construct and parameter

### Requirement: Script editing
The scenario editor SHALL offer a script mode with Lua highlighting, language subset diagnostics while
typing, completion and hover help for constructs, and a read-only view of the evaluated document. A player
SHALL be able to convert a JSON scenario into an equivalent script and to view any script's evaluated
document as JSON.

#### Scenario: Hover help for a construct
- **WHEN** the player hovers over a construct call in a script
- **THEN** a summary of the construct and its parameters appears with a link to its documentation page

#### Scenario: Evaluated document shown
- **WHEN** the player opens the evaluated view of a valid script
- **THEN** the complete scenario document it produces is shown and cannot be edited there
