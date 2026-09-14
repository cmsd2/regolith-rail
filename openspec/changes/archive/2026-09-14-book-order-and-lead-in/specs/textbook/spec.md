## ADDED Requirements

### Requirement: Chapter order
No chapter SHALL depend on a later chapter. A chapter SHALL NOT use a result, a term or a policy that a later
chapter introduces, except by deriving it itself. Cross-references SHALL point to the chapter that introduces
the thing referred to.

#### Scenario: Base stock after the newsvendor
- **WHEN** a reader reaches the base-stock level in chapter 6
- **THEN** the critical fractile it uses refers back to chapter 5, where it was derived

#### Scenario: Randomness before inventory
- **WHEN** a reader runs chapter 3's comparison
- **THEN** the policies compared are ones chapter 1 introduced, and no inventory term from Part II is needed
  to follow it

### Requirement: Working shown
Where a chapter states a numeric result derived from the model, the text SHALL show the relation it is derived
from before the check that verifies it. A check SHALL verify a derivation, not stand in for one.

#### Scenario: Steady cycle in chapter 1
- **WHEN** a reader reaches the steady-cycle load and trip time in chapter 1's case study
- **THEN** the two equations that determine them are displayed before the result

## MODIFIED Requirements

### Requirement: Chapters of Parts I and II
The Book SHALL contain these chapters, in this order:

- **Part I, Foundations:**
  1. Modelling operations: decisions, objectives, constraints, and a policy as a model of decisions.
  2. Flows, rates and Little's law: throughput, flow balance, capacity as a bound on flow, and stock as flow
     times time.
  3. Randomness and simulation: random arrivals, Monte Carlo estimation, confidence intervals and common
     random numbers.
- **Part II, Inventory:**
  4. Order quantities: the economic order quantity and (s, S) policies.
  5. One period under uncertainty: the newsvendor and the critical ratio.
  6. Reviews, lead times and base-stock: inventory position, the protection interval and order-up-to
     policies.
  7. Safety stock and service levels: cycle service level, fill rate, and variable demand and lead times.
  8. Forecasting: moving averages, exponential smoothing, trend and seasonality, and forecast error.

Deterministic chapters SHALL precede the random ones they lead to, and the single-period problem SHALL
precede the multi-period one. Chapter page addresses SHALL NOT change when chapters are renumbered.

#### Scenario: Chapters present
- **WHEN** the Book section is listed
- **THEN** chapters 1 to 8 exist with these titles under their parts

#### Scenario: Old address after renumbering
- **WHEN** someone opens the address chapter 3 had when it was Reviews, lead times and base-stock
- **THEN** they arrive at that chapter, now numbered 6

### Requirement: A scenario for every chapter
Every chapter SHALL name at least one scenario that demonstrates its topic, and SHALL offer an action that
opens it in the workbench. Every chapter's simulator section SHALL ask the reader to run at least two policies
or parameter settings on that scenario, and SHALL state what the reader will see, verified by a simulator
check.

- Chapter 1 SHALL use the `two-station` starter.
- Chapter 2 SHALL use the `relay` starter.
- Chapter 3 SHALL use the `two-station` starter, comparing the policies chapter 1 introduced over many seeds.
- Chapters 4 and 6 SHALL use `classic.reorder`.
- Chapter 5 SHALL use `classic.newsvendor`.
- Chapter 7 SHALL use `classic.safety_stock`.
- Chapter 8 SHALL use `classic.forecasting`.

#### Scenario: Open a chapter's scenario
- **WHEN** a reader chooses to open chapter 7's scenario
- **THEN** the workbench's Scenario slot holds `classic.safety_stock` and its Policy slot holds the reference
  policy

#### Scenario: Chapter without a scenario
- **WHEN** a chapter names no scenario
- **THEN** the documentation check fails and names the chapter

#### Scenario: Something to compare
- **WHEN** a reader follows chapter 7's simulator section
- **THEN** it asks them to compare two order-up-to levels, or a fixed with a variable lead time, and states
  the difference they will measure, with a check

### Requirement: Case studies
The failure modes that belong to Parts I and II SHALL be told as case studies inside their chapters:

- Half capacity SHALL appear in chapter 1.
- Dead stock SHALL appear in chapter 2, as stock held where nothing flows out.
- Double dispatch SHALL appear in chapter 6, as a failure to use inventory position.
- Storm shock SHALL appear in chapter 7, as safety stock on a line.

The starter scenarios SHALL link to those chapters' case studies, and each former failure-mode page SHALL
redirect to its case study. A failure mode whose part is not yet written SHALL stay in the Failure modes
section, and the documentation index SHALL say which part it waits for.

#### Scenario: Starter lesson links to its chapter
- **WHEN** a player puts `storm-shock` in the Scenario slot and follows Why the baseline fails
- **THEN** the documentation opens at chapter 7's storm shock case study

#### Scenario: Failure mode waiting for its part
- **WHEN** a reader opens the documentation index
- **THEN** ping-pong is listed as a lesson that Part III will take up

### Requirement: Exercises with checked answers
Every chapter SHALL end with at least two exercises. At least one SHALL ask the reader to change a policy or a
parameter and run it in the workbench. Each SHALL have an answer the reader can reveal. Every numeric or
symbolic answer SHALL refer to a check, as described in Checked claims, and the answer to a simulator
exercise SHALL refer to a simulator check.

#### Scenario: Revealed answer
- **WHEN** a reader reveals the answer to an exercise in chapter 5
- **THEN** the answer is shown with a link to the check that verifies it

#### Scenario: Simulator exercise
- **WHEN** a reader reveals the answer to chapter 4's simulator exercise
- **THEN** it states what the run or batch shows, and links to the test that verifies it
