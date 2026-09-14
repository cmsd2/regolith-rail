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
Opening a share link SHALL add it to the library as a shared experiment, fill the run's slots from it and
select its view, but SHALL NOT run it. The player SHALL see the policy source before choosing to run it.

#### Scenario: Open a link
- **WHEN** a player opens a share link
- **THEN** the slots show its scenario and policies, the experiment is listed under Shared with me, and no
  simulation starts until Run is pressed

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
Players' own policies, scenarios (including scenario scripts) and experiments SHALL be kept in the browser as
Mine items in the library. They SHALL save automatically after each edit. The run's slots SHALL be restored
on the next visit.

#### Scenario: Draft restored
- **WHEN** a player edits a policy and closes the tab without any further action
- **THEN** reopening the application restores the edited policy in the Policy slot and under Mine

#### Scenario: Script saved
- **WHEN** a player edits a scenario script and reopens the application later
- **THEN** the script source is restored and evaluates to the same document

### Requirement: Storage unavailable
When browser storage is unavailable the application SHALL keep working, SHALL tell the player that work will
not be kept, and SHALL still create share links. The library SHALL work for the rest of the session, holding
Mine and Shared with me items in memory.

#### Scenario: Private browsing without storage
- **WHEN** the application cannot access browser storage
- **THEN** a notice says work will not be saved, and running, editing library items and sharing still work
  until the tab is closed

### Requirement: Older links
Share links and saved work created before scenario scripts and format 2 SHALL continue to open, with format 1
scenarios upgraded on load.

#### Scenario: Link from the first release
- **WHEN** a player opens a share link created before this change
- **THEN** the policy and scenario are restored and the scenario is shown upgraded to format 2

### Requirement: Migration of earlier saved work
On the first visit after this change, saved policies, saved scenarios and the draft from earlier releases
SHALL be moved into the library.

- **Saved items:** these SHALL become Mine items with the same names and contents.
- **Draft:** an edited draft SHALL become Mine items that fill the slots. An unedited starter or built-in
  policy in the draft SHALL fill its slot with the built-in item instead.
- **Old records:** SHALL be removed only after the library has been written.

#### Scenario: Saved policy migrated
- **WHEN** a player who saved a policy named "buffer" in an earlier release opens the application
- **THEN** Policies › Mine lists "buffer" with the same source, and nothing else they saved is lost
