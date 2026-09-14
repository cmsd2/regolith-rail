# sharing Specification

## Purpose
Lets players share a policy and scenario with a link, and keep their own work in
the browser between visits, without any server.

## Requirements

### Requirement: Share links
The application SHALL create a link that contains the policy source or sources, the scenario as a script or
a document, the seed or batch settings, the view, the Policy API version and the application version. The
contents SHALL be carried in the URL fragment so they are not sent to the host.

#### Scenario: Link round trip
- **WHEN** a player copies a share link for a comparison and opens it in another browser
- **THEN** the same policies, scenario, seeds and view are restored

#### Scenario: Script round trip
- **WHEN** a player shares a scenario written as a script
- **THEN** the link opens with the script's source in the editor, not only its evaluated document

### Requirement: No automatic execution
Opening a share link SHALL load its contents without running them. The player
SHALL see the policy source before choosing to run it.

#### Scenario: Open a link
- **WHEN** a player opens a share link
- **THEN** the policy and scenario are shown and nothing runs until the player
  presses Run

### Requirement: Link problems
A link that cannot be decoded SHALL show an error and open the default view. A
link from a different Policy API version SHALL open with a warning that results
may differ. A link longer than 8000 characters SHALL be created with a warning
that some sites may truncate it.

#### Scenario: Corrupt link
- **WHEN** a player opens a truncated share link
- **THEN** an error explains that the link is damaged, the default view opens,
  and saved work is untouched

#### Scenario: Older API version
- **WHEN** a link records a Policy API version other than the current one
- **THEN** its contents load with a version warning

### Requirement: Local saving
Players SHALL be able to save, list, open, rename and delete named policies and scenarios, including scenario
scripts, in the browser. The editor contents SHALL be saved automatically as a draft and restored on the next
visit.

#### Scenario: Draft restored
- **WHEN** a player edits a policy and closes the tab without saving
- **THEN** reopening the application restores the edited policy as a draft

#### Scenario: Script saved
- **WHEN** a player saves a scenario script under a name and reopens it later
- **THEN** the script source is restored and evaluates to the same document

### Requirement: Storage unavailable
When browser storage is unavailable the application SHALL keep working, SHALL
tell the player that work will not be kept, and SHALL still create share links.

#### Scenario: Private browsing without storage
- **WHEN** the application cannot access browser storage
- **THEN** a notice says work will not be saved, and running and sharing still
  work

### Requirement: Older links
Share links and saved work created before scenario scripts and format 2 SHALL continue to open, with format 1
scenarios upgraded on load.

#### Scenario: Link from the first release
- **WHEN** a player opens a share link created before this change
- **THEN** the policy and scenario are restored and the scenario is shown upgraded to format 2
