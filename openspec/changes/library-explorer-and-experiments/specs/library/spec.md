## Purpose

Gives players one place to find, combine, keep and move the scenarios, policies and saved runs they work
with. Built-in and shared work stays intact while the player's own copies save themselves.

## ADDED Requirements

### Requirement: Library explorer
The workbench SHALL show a library explorer below the run's slots, with three lists shown one at a time:
Scenarios, Policies and Saved runs.

- **Scenarios:** grouped by source (Built in, Examples, Classic problems, Mine and Shared with me).
- **Policies:** grouped as described in Policy fit.
- **Groups:** a group SHALL be omitted when it has no items. Groups SHALL be expandable and collapsible.
- **Items:** each item SHALL show its name, and its one-line description when selected.
- **Current items:** the lists SHALL mark the items currently filling the run's slots.
- **Access:** the lists SHALL be usable with the keyboard alone, and SHALL expose their structure to
  assistive technology as a tab list of trees.

#### Scenario: Built-in content listed
- **WHEN** a new visitor opens the workbench
- **THEN** the Scenarios list shows the five Mars starter scenarios under Built in and the classic templates
  under Classic problems, and the Policies list shows the naive and supply-to-demand policies

#### Scenario: Keyboard navigation
- **WHEN** the player focuses a list and uses the arrow keys and Enter
- **THEN** focus moves between groups and items, groups expand and collapse, and Enter uses the focused item

### Requirement: Run slots
The workbench SHALL show the current run as slots.

- **Slots:** one Scenario slot and one Policy slot. In the batch view with comparison on, also a Compare slot.
- **Selecting and using:** clicking an item SHALL only select it and show its details. Double-clicking it,
  pressing Enter, or its Use action SHALL use it: a scenario fills the Scenario slot; a policy fills the Policy
  slot, or the Compare slot while that slot is being chosen.
- **Choosing a slot:** choosing a slot SHALL show the list of that slot's kind, until an item is used or the
  choice is cancelled. The batch view SHALL offer choosing the Compare slot next to policy B.
- **Changing slots:** changing a slot SHALL NOT run anything.

#### Scenario: Selecting does not change the run
- **WHEN** the player clicks the supply-to-demand policy once
- **THEN** its description is shown and the Policy slot and the editor are unchanged

#### Scenario: Use a policy
- **WHEN** the player double-clicks the supply-to-demand policy
- **THEN** the Policy slot shows supply-to-demand, the policy editor shows its source, and the Scenario slot is
  unchanged

#### Scenario: Choose a comparison policy
- **WHEN** the player, in the batch view with comparison on, chooses policy B and uses the naive policy
- **THEN** the Compare slot shows naive and the Policy slot is unchanged

### Requirement: Scenario lessons
The Scenario slot SHALL show what the scenario teaches and offer the policy that goes with it.

- **Starter scenarios:** a link to the documentation page that explains why the baseline fails, and a Try the
  suggested fix action that fills the Policy slot with the fix that page suggests.
- **Classic templates:** a link to the problem's page, the template's parameters, and a Use the reference
  policy action that fills the Policy slot with the reference policy for the current parameters.
- **Other scenarios:** no lesson actions are shown.

#### Scenario: Try the suggested fix
- **WHEN** the Scenario slot holds `storm-shock` and the player chooses Try the suggested fix
- **THEN** the Policy slot holds the policy from the Disruption recovery page and no run starts

#### Scenario: Use the reference policy
- **WHEN** the Scenario slot holds `classic.reorder` and the player chooses Use the reference policy
- **THEN** the Policy slot holds the reorder reference policy for the template's current parameters

### Requirement: Policy fit
The Policies list SHALL order and mark policies by how they fit the scenario in the Scenario slot.

- **For this scenario:** first, the policies written for it: its suggested fix, its reference policy, and
  documentation examples that run on it.
- **Then:** Built in, Mine and Shared with me.
- **Other examples:** last, and collapsed.
- **Unfit policies:** a policy that defines no hook the scenario calls, such as only `on_review` on a scenario
  without reviews, or only `on_stop` on a scenario without vehicles, SHALL be shown dimmed with the reason.
  It SHALL still be usable.

#### Scenario: Examples for the current scenario come first
- **WHEN** the Scenario slot holds `storm-shock`
- **THEN** For this scenario lists the Disruption recovery fix and the documentation examples that run on
  `storm-shock`, above the built-in policies

#### Scenario: A policy that cannot act here is marked
- **WHEN** the Scenario slot holds `two-station` and the Policies list is shown
- **THEN** a policy that defines only `on_review` is dimmed with a reason saying the scenario has no reviews

### Requirement: Experiments
An experiment SHALL record a snapshot of a run's setup:

- the scenario and its template parameters;
- the policy, and the comparison policy when present;
- the seed, the batch seed count, base seed and comparison setting;
- the view.

The player SHALL be able to save the current run as a named experiment under Mine and to update a Mine
experiment from the current run. Using an experiment SHALL fill every slot and restore its seed, batch
settings and view without running anything. Later edits to the items an experiment was made from SHALL NOT
change the experiment.

#### Scenario: Save and reopen an experiment
- **WHEN** the player saves a run of `storm-shock` with a min-max policy on seed 7 as "Storm buffer", then
  changes the scenario and seed, then uses "Storm buffer"
- **THEN** the slots show `storm-shock` and the min-max policy, the seed is 7, and no run starts

### Requirement: Saved runs list
The Saved runs list SHALL show the player's experiments and those from share links, each with its name, its
scenario and policy names, and when it was last saved, newest first, grouped as Mine and Shared with me. It
SHALL NOT show the built-in scenarios and policies, which are reached from the Scenario slot instead.

#### Scenario: Saved runs are listed apart
- **WHEN** the player saves an experiment and opens the Saved runs list
- **THEN** the experiment is listed under Mine with its scenario and policy names, and no built-in scenario or
  policy appears in the list

### Requirement: Copy on edit
Items under Built in, Examples, Classic problems and Shared with me SHALL be read-only.

- **Forking:** the first edit to a read-only item in a slot SHALL create a copy under Mine, with the edit
  applied and a name derived from the original, and SHALL switch the slot to the copy.
- **Template parameters:** changing a classic template's parameters SHALL count as an edit.
- **Mine items:** these SHALL save automatically shortly after each edit and SHALL be restored with the slots
  on the next visit.
- **Managing Mine:** the player SHALL be able to rename, duplicate and delete Mine items and experiments.
  Deleting an item that fills a slot SHALL leave the slot's contents in place as an unsaved copy.

#### Scenario: Editing a built-in policy
- **WHEN** the player uses the naive policy and types a comment into the editor
- **THEN** a policy named "naive (copy)" appears under Mine with the comment, the Policy slot shows it, and
  the built-in naive policy is unchanged

#### Scenario: Automatic saving
- **WHEN** the player edits a Mine policy and closes the tab without any further action
- **THEN** reopening the workbench shows the edited policy in the Policy slot and under Mine

### Requirement: Classic reference policies follow their template
While the Policy slot holds a classic template's unedited reference policy and the Scenario slot holds that
template, changing the template's parameters SHALL replace the policy with the reference policy for the new
parameters. An edited reference policy SHALL NOT be replaced.

#### Scenario: Parameters change the reference policy
- **WHEN** the player uses the Newsvendor scenario, chooses Use the reference policy, and changes `lost_cost`
- **THEN** the scenario is copied to Mine with the new cost and the Policy slot holds the reference policy's
  order quantity for that cost

### Requirement: Shared items
Opening a share link SHALL add it as an experiment under Saved runs › Shared with me.

- **Duplicates:** opening a link whose contents match an existing shared experiment SHALL reuse that
  experiment instead of adding another.
- **Removal:** shared items SHALL be kept until the player deletes them.

#### Scenario: Same link twice
- **WHEN** the player opens the same share link on two visits
- **THEN** Saved runs › Shared with me holds one experiment from that link

### Requirement: Import and export
The player SHALL be able to import a policy from a `.lua` file, a scenario from a `.lua` script or a `.json`
document, and an experiment from an exported `.json` file, into Mine.

- **Kind:** the kind SHALL be the one the player chose to import.
- **Name:** the item SHALL be named after the file.
- **Scenario errors:** a scenario that fails evaluation or validation SHALL still be imported, with its errors
  shown when it is used.
- **Rejected files:** a file that is not text, or is larger than 1 MB, SHALL be rejected with a message and
  nothing imported.
- **Export:** the player SHALL be able to export any item as a `.lua` or `.json` file, and any experiment as a
  `.json` file that can be imported back as an experiment.

#### Scenario: Import a policy
- **WHEN** the player imports `buffer.lua` as a policy
- **THEN** a policy named "buffer" appears under Policies › Mine with the file's contents

#### Scenario: Experiment round trip
- **WHEN** the player exports an experiment and imports the file in another browser
- **THEN** an experiment with the same scenario, policies, seed, batch settings and view appears under Saved
  runs › Mine

### Requirement: Workbench columns
The explorer SHALL be a column to the left of the editor, which sits before the run views and, when open,
the documentation panel.

- **Explorer and docs panel:** the player SHALL be able to collapse and expand the explorer, and resize it and
  the documentation panel.
- **Remembered:** the collapsed state and widths SHALL be remembered in that browser.
- **Narrow screens:** the explorer SHALL open as a drawer over the workbench.

#### Scenario: Collapse the explorer
- **WHEN** the player collapses the explorer and reloads the page
- **THEN** the explorer stays collapsed and the editor and run views use the freed width

#### Scenario: Narrow screen
- **WHEN** the workbench is shown 375 pixels wide
- **THEN** the explorer is hidden behind a button that opens it as a drawer, and using an item closes the
  drawer
