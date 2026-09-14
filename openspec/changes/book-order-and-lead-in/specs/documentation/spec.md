## ADDED Requirements

### Requirement: Entry into the book
The documentation index SHALL lead with Getting started and the Book, SHALL list each starter scenario's
lesson under the chapter that tells it, and SHALL name any lesson that waits for a later part. Getting started
SHALL use the book's unit of time, day, and SHALL say once that the game calls it a sol.

#### Scenario: Index lists lessons by chapter
- **WHEN** a reader opens the documentation index
- **THEN** half capacity, dead stock, double dispatch and storm shock are listed under their chapters, and
  ping-pong is listed as waiting for Part III

#### Scenario: Getting started in days
- **WHEN** a reader follows Getting started
- **THEN** run lengths are given in days, with sol explained once

## MODIFIED Requirements

### Requirement: Sections
The documentation SHALL include:

- Getting started, and Language and sandbox rules;
- the Book;
- Policy API reference and `ops` reference;
- Writing scenario scripts, and the scenario construct reference for the core library, the Mars pack and the
  classic problems pack;
- a failure-mode explanation for every starter scenario;
- a page for every classic problem template;
- metric definitions, scenario format reference and game mechanics assumptions;
- About, with the licence and non-affiliation statement.

A failure-mode explanation SHALL be a Book case study, or a page in the Failure modes section only while the
part of the Book it belongs to is unwritten. A classic template's page SHALL be a Book chapter or a template
reference page in the Reference section. The main text of a template reference page SHALL NOT name the game.

#### Scenario: Failure-mode page per scenario
- **WHEN** the starter scenarios are listed
- **THEN** each links to an existing Book case study, or to a Failure modes page for a failure mode whose part
  is unwritten

#### Scenario: Page per classic template
- **WHEN** the classic problem templates are listed
- **THEN** each links to an existing Book chapter or template reference page

#### Scenario: Template page without the game
- **WHEN** a reader opens the fixed-route delivery reference page
- **THEN** its main text describes the problem in operations research terms without naming the game
