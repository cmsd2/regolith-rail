# mars-pack Specification

## Purpose
Lets players describe Surviving Mars rail lines in the game's own vocabulary and units, so the flagship use
case stays the easiest thing to express.

## Requirements

### Requirement: Game vocabulary
A `mars` construct library SHALL be available to scenario scripts. It SHALL provide constructs for a rail
line, small and large stations, trains, resource producers such as extractors and farms, factories that
convert resources, domes and other consumers, and disasters. Every construct SHALL evaluate to core scenario
format parts.

#### Scenario: A line in game terms
- **WHEN** a script builds a line with a small station holding a metals extractor, a large station holding a
  dome, and one train
- **THEN** the evaluated document has two stations joined by an arc, a shuttle route for the train, a Metals
  producer and a consumer at the dome station

### Requirement: Game units and sizes
Mars constructs SHALL take quantities in whole game units and times in sols and hours. A small station SHALL
hold 30 units of each enabled resource and a large station 60.

#### Scenario: Station sizes
- **WHEN** a script adds a large station enabling Metals and Food
- **THEN** the evaluated document gives that station a capacity of 60000 milli-units for each resource

### Requirement: Building defaults
Building constructs SHALL have default rates stated on the game mechanics documentation page with their
evidence level. Any default SHALL be overridable by a parameter.

#### Scenario: Overriding a building rate
- **WHEN** a script adds an extractor with a rate of 5 units per sol
- **THEN** the evaluated producer rate is 5000 milli-units per sol regardless of the default

### Requirement: Disasters as events
Disaster constructs SHALL evaluate to world events. A dust storm SHALL stop production at the stations it
covers while active, and SHALL accept an optional later maintenance surge in demand with its timing and size
as parameters.

#### Scenario: Dust storm with maintenance surge
- **WHEN** a script adds a dust storm for one sol with a surge of two and a half times Metals demand at the
  dome starting half a sol after the storm starts
- **THEN** the evaluated document has one event with a supply effect of multiplier 0 and a demand effect of
  multiplier 2500 with a start offset of 43200000 ms

### Requirement: Mod-portable scenarios
Scenarios built with the Mars pack SHALL be single shuttle lines at the `local` or `line` information level,
so that a policy written for them can later run in the game.

#### Scenario: Mars line is mod-portable
- **WHEN** a policy that defines only `on_start` and `on_stop` is paired with a Mars pack scenario
- **THEN** the application marks the pairing as mod-ready

### Requirement: Starter scenarios as Mars scripts
Every starter scenario SHALL be written as a Mars pack script. Each script SHALL evaluate to a document whose
runs are identical to the runs of the starter scenario it replaces, so golden result hashes do not change.

#### Scenario: Starter results unchanged
- **WHEN** the `two-station` Mars script is run with the naive baseline on seeds 1 to 20
- **THEN** every result hash equals the golden hash recorded before this change
