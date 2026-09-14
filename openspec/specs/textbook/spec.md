# textbook Specification

## Purpose
Teaches operations research as an applied introductory textbook inside the documentation. Each chapter is
tied to a scenario the reader can run, and each stated result can be checked.

## Requirements

### Requirement: Book structure
The documentation SHALL include a Book section with a contents page and numbered chapters grouped into
numbered parts. The contents page SHALL list every part and chapter in order. Planned parts that are not yet
written SHALL be listed as coming later, without links. Each chapter page SHALL show its part and chapter
number, and SHALL link to the previous and next chapters.

#### Scenario: Contents lists the parts
- **WHEN** a reader opens the Book contents page
- **THEN** it lists Part I Foundations and Part II Inventory with their chapters linked in order, and
  Parts III Networks, IV Optimisation and V Dynamics marked as coming later

#### Scenario: Moving between chapters
- **WHEN** a reader reaches the end of chapter 3
- **THEN** the page links back to chapter 2 and on to chapter 4

### Requirement: Chapters of Parts I and II
The Book SHALL contain these chapters:

- **Part I, Foundations:**
  1. Modelling operations: decisions, objectives, constraints, and a policy as a model of decisions.
  2. Randomness and simulation: random arrivals, Monte Carlo estimation, confidence intervals and common
     random numbers.
- **Part II, Inventory:**
  3. Reviews, lead times and base-stock: inventory position, the protection interval and order-up-to
     policies.
  4. One period under uncertainty: the newsvendor and the critical ratio.
  5. Order quantities: the economic order quantity and (s, S) policies.
  6. Safety stock and service levels: cycle service level, fill rate, and variable demand and lead times.
  7. Forecasting: moving averages, exponential smoothing, trend and seasonality, and forecast error.

#### Scenario: Chapters present
- **WHEN** the Book section is listed
- **THEN** chapters 1 to 7 exist with these titles under their parts

### Requirement: Chapter standard
Every chapter SHALL contain, in this order:

1. What the reader will be able to do.
2. The problem, stated in plain operations research terms.
3. The model and its analysis.
4. The chapter's scenario, with at least one runnable example.
5. Where the simulator differs from the model.
6. Exercises.
7. A game side note.
8. References.

A case study SHALL follow the scenario section where a starter scenario's failure mode belongs to the chapter.
The main text SHALL use general operations research language, and SHALL leave game vocabulary to the side
note.

#### Scenario: Missing section
- **WHEN** a chapter page lacks its exercises section
- **THEN** the documentation check fails and names the chapter and the missing section

#### Scenario: Game vocabulary kept aside
- **WHEN** a reader reads chapter 3
- **THEN** the main text speaks of stations, reviews and lead times, and the connection to the rail game
  appears only in the side note

### Requirement: A scenario for every chapter
Every chapter SHALL name at least one scenario that demonstrates its topic, and SHALL offer an action that
opens it in the workbench.

- Chapter 1 SHALL use the `two-station` starter.
- Chapter 2 SHALL use a classic template with random demand, compared over many seeds.
- Chapters 3 and 5 SHALL use `classic.reorder`.
- Chapter 4 SHALL use `classic.newsvendor`.
- Chapter 6 SHALL use `classic.safety_stock`.
- Chapter 7 SHALL use `classic.forecasting`.

#### Scenario: Open a chapter's scenario
- **WHEN** a reader chooses to open chapter 6's scenario
- **THEN** the workbench's Scenario slot holds `classic.safety_stock` and its Policy slot holds the reference
  policy

#### Scenario: Chapter without a scenario
- **WHEN** a chapter names no scenario
- **THEN** the documentation check fails and names the chapter

### Requirement: Case studies
The failure modes that belong to Parts I and II SHALL be told as case studies inside their chapters:

- Half capacity SHALL appear in chapter 1.
- Double dispatch SHALL appear in chapter 3, as a failure to use inventory position.

The starter scenarios SHALL link to those chapters' case studies. Failure-mode pages not yet placed in a
chapter SHALL stay in the Failure modes section.

#### Scenario: Starter lesson links to its chapter
- **WHEN** a player puts `two-trains` in the Scenario slot and follows Why the baseline fails
- **THEN** the documentation opens at chapter 3's double dispatch case study

### Requirement: Exercises with checked answers
Every chapter SHALL end with at least two exercises. Each SHALL have an answer the reader can reveal. Every
numeric or symbolic answer SHALL refer to a check, as described in Checked claims.

#### Scenario: Revealed answer
- **WHEN** a reader reveals the answer to an exercise in chapter 4
- **THEN** the answer is shown with a link to the check that verifies it

### Requirement: Original prose and citations
Chapters SHALL be written in original prose. They SHALL NOT reproduce text, worked examples or exercises
from the referenced books. Sources SHALL be cited in Harvard style with page numbers where a specific result
is drawn from them, and each chapter SHALL list its references.

#### Scenario: Cited result
- **WHEN** chapter 4 states the critical ratio result
- **THEN** it cites a source with page numbers, and the source appears in the chapter's references

### Requirement: Game side notes
Every chapter SHALL have one side note connecting the topic to the rail game, visually set apart from the main
text. Statements about game behaviour in side notes SHALL follow the game mechanics evidence rules.

#### Scenario: Side note in a chapter
- **WHEN** a reader views chapter 5
- **THEN** a side note set apart from the main text describes how its topic appears on a rail line
