# batch-comparison Specification

## Purpose
Runs a policy over many seeds, and compares two policies fairly on the same
seeds, so players can tell real improvements from luck.

## Requirements

### Requirement: Batch configuration
The player SHALL be able to choose a scenario, policy A, an optional policy B,
a base seed and a number of seeds from 1 to 1000, defaulting to 100.

#### Scenario: Default batch
- **WHEN** the player opens batch mode
- **THEN** the current scenario and policy are selected as A with 100 seeds

### Requirement: Paired seeds
The seed list SHALL be derived deterministically from the base seed and count,
and both policies SHALL run on exactly the same seeds.

#### Scenario: Same seeds for both
- **WHEN** a comparison of A and B runs with base seed 42 and 50 seeds
- **THEN** A and B each run on the same 50 seeds, and repeating the comparison
  uses the same seeds

### Requirement: Consistency with single runs
The result for any seed in a batch SHALL be identical to a single run of the
same scenario, policy and seed.

#### Scenario: Open a seed
- **WHEN** the player opens seed 17 from a batch in the run view
- **THEN** its metrics match the batch's values for seed 17

### Requirement: Parallel execution
Batches SHALL use the available processor cores, show progress, stay cancellable
and keep the interface responsive. Results SHALL NOT depend on the number of
cores used.

#### Scenario: Different core counts
- **WHEN** the same batch runs with one worker and with four workers
- **THEN** the results are identical

### Requirement: Distributions
For each metric the batch SHALL show the distribution across seeds: minimum,
lower quartile, median, upper quartile, maximum, mean, and a 95% confidence
interval for the mean. For a chosen station and resource it SHALL show stock
over time as a median with percentile bands.

#### Scenario: Metric summary
- **WHEN** a 100-seed batch completes
- **THEN** every metric shows its distribution chart and summary values

### Requirement: Paired comparison
When two policies are compared, the batch SHALL show for each metric the mean
per-seed difference between B and A with a 95% confidence interval, and SHALL
label a difference as within noise when the interval includes zero.

#### Scenario: Difference within noise
- **WHEN** two identical policies are compared
- **THEN** every metric's difference is zero or labelled within noise

#### Scenario: Clear improvement
- **WHEN** a supply-to-demand policy is compared with the naive baseline on
  `two-station` at a consumption rate the baseline cannot sustain
- **THEN** the reduction in unmet demand is shown with an interval that excludes
  zero

### Requirement: Failed runs
Runs with policy errors or budget overruns SHALL be counted per policy and
listed by seed, and each SHALL open in the run view.

#### Scenario: Seed with errors
- **WHEN** policy B raises errors on 3 of 100 seeds
- **THEN** the batch reports 3 runs with errors for B and lists their seeds
