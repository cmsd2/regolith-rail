# documentation Specification

## Purpose
Provides the documentation players need to use the sandbox and understand its
results, available inside the application and as linkable static pages, and
checked so it cannot fall out of date.

## Requirements

### Requirement: Two ways to read
Every documentation page SHALL be readable in a panel beside the editor and as a
standalone page with its own URL. Standalone pages SHALL contain their content
in the delivered HTML so they are readable before scripts load.

#### Scenario: Direct link to a page
- **WHEN** someone opens the URL of the `min_max` page directly
- **THEN** the page content is shown without first loading the application

#### Scenario: Panel beside the editor
- **WHEN** a player follows a documentation link from the editor
- **THEN** the page opens in the panel and the editor keeps its contents

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

### Requirement: Complete reference
Every member of the Policy API, every `ops` block and block parameter, and every scenario construct and
construct parameter SHALL have reference documentation. A build SHALL fail if any is missing.

#### Scenario: Undocumented parameter
- **WHEN** a parameter is added to an `ops` block without documentation
- **THEN** the documentation check fails and names the parameter

#### Scenario: Undocumented construct parameter
- **WHEN** a parameter is added to a Mars pack construct without documentation
- **THEN** the documentation check fails and names the construct and parameter

### Requirement: Runnable examples
Code examples marked as runnable SHALL execute during the documentation check, and any stated expected output
SHALL match. Runnable examples SHALL offer an action that opens them in the workbench.

- **Library item:** the example SHALL open as a read-only example item, named after its page. It SHALL be
  listed only when it is a starter's suggested fix.
- **Slot:** the item SHALL fill its slot, and a scenario the example names SHALL fill the Scenario slot.
- **Player's work:** opening an example SHALL NOT change or remove any Mine item.

#### Scenario: Broken example
- **WHEN** a runnable example no longer produces its stated output
- **THEN** the documentation check fails and names the page and example

#### Scenario: Opening an example keeps the player's work
- **WHEN** a player with an edited Mine policy in the Policy slot opens the min-max example from its page
- **THEN** the Policy slot holds the read-only example, the Mine policy is unchanged under Mine, and
  editing the example creates a new copy under Mine

### Requirement: Game mechanics evidence
Every statement about game behaviour SHALL show the game version it refers to
and its evidence level: observed, shadow-mode or game-code.

#### Scenario: Evidence label
- **WHEN** a player reads the page describing station balancing
- **THEN** it shows Surviving Mars: Relaunched with its version and the evidence
  level observed

### Requirement: Links from the application
Editor hover help and diagnostics, stop inspector traces, metric names and
starter scenario descriptions SHALL link to the relevant documentation page.

#### Scenario: Trace to block page
- **WHEN** a player selects the block name in a decision trace
- **THEN** that block's documentation page opens

### Requirement: Search
Documentation SHALL be searchable across all sections, including Policy API
members and `ops` blocks, without contacting a server.

#### Scenario: Search for a block
- **WHEN** a player searches for "lookahead"
- **THEN** the `lookahead` block page is among the first results

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

### Requirement: Non-affiliation notice
Every application view and documentation page SHALL show a notice that Regolith Rail
is not affiliated with or endorsed by Paradox Interactive or Haemimont Games.
No game assets SHALL appear in the application or documentation.

#### Scenario: Notice on a page
- **WHEN** any documentation page or application view is displayed
- **THEN** the non-affiliation notice is visible in its footer
