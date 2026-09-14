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

A failure-mode explanation SHALL be a Book case study or a page in the Failure modes section. A classic
template's page SHALL be a Book chapter or a page in the Classic problems section.

#### Scenario: Failure-mode page per scenario
- **WHEN** the starter scenarios are listed
- **THEN** each links to an existing failure-mode page or Book case study

#### Scenario: Page per classic template
- **WHEN** the classic problem templates are listed
- **THEN** each links to an existing documentation page or Book chapter

### Requirement: Link integrity
The documentation check SHALL fail on any internal link or anchor that does not resolve. A page that moves
SHALL leave a redirect at its old address to its new address, including the anchor it moved to, so that links
from outside the site keep working.

#### Scenario: Renamed page
- **WHEN** a page is renamed without updating links to it
- **THEN** the documentation check fails and lists the broken links

#### Scenario: Moved page redirects
- **WHEN** someone opens `/docs/failure-modes/double-dispatch` after it moved into chapter 3
- **THEN** they arrive at chapter 3's double dispatch case study
