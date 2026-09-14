## MODIFIED Requirements

### Requirement: Batch configuration
The player SHALL be able to set up a batch from the run's slots and a few settings:

- the scenario in the Scenario slot;
- policy A in the Policy slot;
- an optional policy B in the Compare slot, filled from any policy in the library;
- a base seed;
- a number of seeds from 1 to 1000, defaulting to 100.

#### Scenario: Default batch
- **WHEN** the player opens batch mode
- **THEN** the current scenario and policy are selected as A with 100 seeds

#### Scenario: Compare with a library policy
- **WHEN** the player turns on comparison and fills the Compare slot with Policies › Built in › naive
- **THEN** the batch compares the Policy slot's policy as A with naive as B on the same seeds
