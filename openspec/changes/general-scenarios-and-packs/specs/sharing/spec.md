## ADDED Requirements

### Requirement: Older links
Share links and saved work created before scenario scripts and format 2 SHALL continue to open, with format 1
scenarios upgraded on load.

#### Scenario: Link from the first release
- **WHEN** a player opens a share link created before this change
- **THEN** the policy and scenario are restored and the scenario is shown upgraded to format 2

## MODIFIED Requirements

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
