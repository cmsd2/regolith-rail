## MODIFIED Requirements

### Requirement: Sections
The documentation SHALL include: Getting started; Language and sandbox rules; Policy API reference; `ops`
reference; Writing scenario scripts; scenario construct reference for the core library, the Mars pack and the
classic problems pack; one failure-mode page per starter scenario; one page per classic problem template;
metric definitions; scenario format reference; game mechanics assumptions; and About, with the licence and
non-affiliation statement.

#### Scenario: Failure-mode page per scenario
- **WHEN** the starter scenarios are listed
- **THEN** each links to an existing failure-mode page

#### Scenario: Page per classic template
- **WHEN** the classic problem templates are listed
- **THEN** each links to an existing documentation page

### Requirement: Complete reference
Every member of the Policy API, every `ops` block and block parameter, and every scenario construct and
construct parameter SHALL have reference documentation. A build SHALL fail if any is missing.

#### Scenario: Undocumented parameter
- **WHEN** a parameter is added to an `ops` block without documentation
- **THEN** the documentation check fails and names the parameter

#### Scenario: Undocumented construct parameter
- **WHEN** a parameter is added to a Mars pack construct without documentation
- **THEN** the documentation check fails and names the construct and parameter
