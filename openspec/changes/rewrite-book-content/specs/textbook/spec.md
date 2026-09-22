## MODIFIED Requirements

### Requirement: Book structure
The documentation SHALL include a Book section with a contents page and numbered chapters grouped into
numbered parts. The contents page SHALL list every part and chapter in order, followed by the book's
appendices. Planned parts that are not yet written SHALL be listed as coming later, without links. Each
chapter page SHALL show its part and chapter number, and SHALL link to the previous and next chapters. A
Notation appendix SHALL list every symbol the chapters use, with its meaning, units and the chapter that
introduces it.

#### Scenario: Contents lists the parts
- **WHEN** a reader opens the Book contents page
- **THEN** it lists Part I Foundations and Part II Inventory with their chapters linked in order, and
  Parts III Networks, IV Optimisation and V Dynamics marked as coming later

#### Scenario: Moving between chapters
- **WHEN** a reader reaches the end of chapter 3
- **THEN** the page links back to chapter 2 and on to chapter 4

#### Scenario: Notation appendix
- **WHEN** a reader opens the Book contents page
- **THEN** the Notation appendix is listed after the parts, and it gives the meaning of $z$ with a link to
  chapter 5

### Requirement: A scenario for every chapter
Every chapter SHALL name at least one scenario that demonstrates its topic, and SHALL offer an action that
opens it in the workbench. Every chapter's simulator section SHALL ask the reader to run at least two policies
or parameter settings, SHALL state the model's prediction before the run, and SHALL state what the reader will
see, verified by a simulator check.

- Chapter 1 SHALL use the `two-station` starter, first with variability switched off, comparing the
  drain-and-fill rule with balancing.
- Chapter 2 SHALL use the `two-station` starter at two train speeds, and the `relay` starter under balancing
  and under roles.
- Chapter 3 SHALL use the `two-station` starter, comparing the policies chapter 1 introduced over many
  replications, with paired and independent seeds.
- Chapter 4 SHALL use `classic.reorder` with the Shop's parameters, comparing order quantities of half, one
  and two times the economic order quantity.
- Chapter 5 SHALL use `classic.newsvendor`, and a scenario script with normal demand.
- Chapter 6 SHALL use `classic.reorder` with the Shop's parameters, random demand and a lead time, and the
  `two-trains` starter for its case study.
- Chapter 7 SHALL use `classic.safety_stock` with the Shop's demand and costs, and the `storm-shock` starter
  for its case study.
- Chapter 8 SHALL use `classic.forecasting` with the Shop's starting demand.

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

#### Scenario: Prediction before the run
- **WHEN** a reader follows chapter 4's simulator section
- **THEN** the section states that half and double the economic order quantity each cost 25% more before
  asking the reader to run them, and shows the predicted and simulated costs side by side

### Requirement: Chapter order
No chapter SHALL depend on a later chapter. A chapter SHALL NOT use a result, a term or a policy that a later
chapter introduces, except by deriving it itself. Cross-references SHALL point to the chapter that introduces
the thing referred to. Chapters 1 and 2 SHALL NOT state results as averages over replications or as
confidence intervals, which chapter 3 introduces.

#### Scenario: Base stock after the newsvendor
- **WHEN** a reader reaches the base-stock level in chapter 6
- **THEN** the critical fractile it uses refers back to chapter 5, where it was derived

#### Scenario: Randomness before inventory
- **WHEN** a reader runs chapter 3's comparison
- **THEN** the policies compared are ones chapter 1 introduced, and no inventory term from Part II is needed
  to follow it

#### Scenario: Replications after chapter 3
- **WHEN** a reader reads chapter 2's simulator section
- **THEN** each result it states comes from a single run or a run whose outcome does not depend on the seed

### Requirement: Original prose and citations
Chapters SHALL be written in original prose. They SHALL NOT reproduce text, worked examples or exercises
from the referenced books. Sources SHALL be cited in Harvard style with printed page numbers where a specific
result is drawn from them, and each chapter SHALL list its references. Chapters SHALL cite only sources a
reader can obtain, and SHALL NOT cite Open University module material.

#### Scenario: Cited result
- **WHEN** chapter 5 states the critical ratio result
- **THEN** it cites a source with page numbers, and the source appears in the chapter's references

#### Scenario: Standard statistics
- **WHEN** chapter 3 recalls the t-interval
- **THEN** it states it without a citation

## ADDED Requirements

### Requirement: Prerequisites
The contents page SHALL state that the book assumes first-year undergraduate probability and statistics:
common distributions including the Poisson and normal, expectation and variance, the sample mean, the central
limit theorem and the t-interval. Chapters SHALL recall such results where they use them and SHALL NOT teach
them from first principles.

#### Scenario: Recalled, not taught
- **WHEN** chapter 3 uses the Poisson distribution
- **THEN** it states the probability function, mean and variance in one place and moves on to the simulation
  question

### Requirement: Running examples
The book SHALL carry three examples across chapters with fixed base parameters: the two-station line, the
relay line and the Shop. The Shop SHALL have a demand of 10 a day, an order cost of 20, a holding cost of 1 a
unit a day and a backorder cost of 10 a unit a day, and chapters 4, 6, 7 and 8 SHALL use it, each changing one
thing from the chapter before.

#### Scenario: The Shop gains a lead time
- **WHEN** a reader moves from chapter 4 to chapter 6
- **THEN** the Shop has the same demand and costs, and chapter 6 adds random demand and a lead time

### Requirement: Progression within chapters
Each chapter's model section SHALL order its subsections from a deterministic or single-station case to the
general one. Within a subsection, the setting and assumptions SHALL come first, then the derivation, then the
named result, then worked numbers. The first run in a chapter's simulator section SHALL match its first model's
assumptions.

#### Scenario: First run matches the first model
- **WHEN** a reader starts chapter 1's simulator section
- **THEN** the first run has the dome's variability switched off, as the model assumes

### Requirement: Prose style
Book chapters SHALL be written in a neutral, technical register that explains how results arise. The
documentation check SHALL fail on em dashes, tailing negations and the banned words listed in the book's style
guide, outside code and mathematics, unless a line carries an exemption comment.

#### Scenario: Banned construction
- **WHEN** a chapter contains the sentence "That is a fact about the line, not a failure of the rule."
- **THEN** the documentation check fails and names the chapter and the line

### Requirement: Placeholders for missing capabilities
Where a chapter's example needs a simulator capability that does not exist, the chapter SHALL keep the
example's model and its checks, and SHALL show a placeholder in place of the run. The placeholder SHALL name
the capability, say what the run would show, and link to the capability's roadmap entry. The documentation
check SHALL fail on a placeholder whose capability is not in the registry, and SHALL list open placeholders by
chapter. A placeholder SHALL NOT replace a chapter's only runnable comparison.

#### Scenario: Placeholder in chapter 7
- **WHEN** a reader reaches the fill-rate comparison in chapter 7 before the simulator reports fill rates
- **THEN** a placeholder set apart from the text states the predicted fill rates and names the
  `service-level-metrics` capability with a link to the roadmap

#### Scenario: Unknown capability
- **WHEN** a chapter's placeholder names a capability missing from the registry
- **THEN** the documentation check fails and names the chapter and the capability
