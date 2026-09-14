## Purpose

Gives players one place to find, combine, keep and move the scenarios, policies and experiments they work
with. Built-in and shared work stays intact while the player's own copies save themselves.

## ADDED Requirements

### Requirement: Library explorer
The workbench SHALL show a library explorer that lists items grouped by kind (Scenarios, Policies,
Experiments) and within each kind by source.

- **Sources:** Built in, Examples, Classic problems, Mine and Shared with me.
- **Groups:** a source group SHALL be omitted when it has no items for that kind. Groups SHALL be expandable
  and collapsible.
- **Items:** each item SHALL show its name, and its one-line description on hover or focus.
- **Current items:** the explorer SHALL mark the items currently filling the run's slots.
- **Access:** the explorer SHALL be usable with the keyboard alone and SHALL expose its structure to
  assistive technology as a tree.

#### Scenario: Built-in content listed
- **WHEN** a new visitor opens the workbench
- **THEN** the explorer lists the five Mars starter scenarios under Scenarios › Built in, the classic templates
  under Scenarios › Classic problems, and the naive and supply-to-demand policies under Policies › Built in

#### Scenario: Keyboard navigation
- **WHEN** the player focuses the explorer and uses the arrow keys and Enter
- **THEN** focus moves between groups and items, groups expand and collapse, and Enter opens the focused item

### Requirement: Run slots
The workbench SHALL show the current run as slots.

- **Slots:** one Scenario slot and one Policy slot. In the batch view with comparison on, also a Compare slot.
- **Filling a slot:** activating a scenario or policy item SHALL fill the Scenario or Policy slot with it and
  show it in the editor. Activating a policy item while choosing the Compare slot SHALL fill Compare
  instead.
- **Choosing a slot:** choosing a slot SHALL narrow the explorer to items of that slot's kind until an item is
  chosen or the choice is cancelled.
- **Changing slots:** changing a slot SHALL NOT run anything.

#### Scenario: Pick a policy
- **WHEN** the player activates Policies › Built in › supply-to-demand
- **THEN** the Policy slot shows supply-to-demand, the policy editor shows its source, and the Scenario slot is
  unchanged

#### Scenario: Pick a comparison policy
- **WHEN** the player, in the batch view with comparison on, chooses the Compare slot and activates the naive
  policy
- **THEN** the Compare slot shows naive, the Policy slot is unchanged, and the explorer shows every kind again

### Requirement: Experiments
An experiment SHALL record a snapshot of a run's setup:

- the scenario and its template parameters;
- the policy, and the comparison policy when present;
- the seed, the batch seed count, base seed and comparison setting;
- the view.

The player SHALL be able to save the current run as a named experiment under Mine and to update a Mine
experiment from the current run. Activating an experiment SHALL fill every slot and restore its seed, batch
settings and view without running anything. Later edits to the items an experiment was made from SHALL NOT
change the experiment.

#### Scenario: Save and reopen an experiment
- **WHEN** the player saves a run of `storm-shock` with a min-max policy on seed 7 as "Storm buffer", then
  changes the scenario and seed, then activates "Storm buffer"
- **THEN** the slots show `storm-shock` and the min-max policy, the seed is 7, and no run starts

#### Scenario: Built-in experiments
- **WHEN** the player opens Experiments › Classic problems
- **THEN** each classic template is listed paired with its reference policy, and activating one fills the
  Scenario slot with the template at its default parameters and the Policy slot with its reference policy

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
- **WHEN** the player opens the naive policy and types a comment into the editor
- **THEN** a policy named "naive (copy)" appears under Policies › Mine with the comment, the Policy slot shows
  it, and Policies › Built in › naive is unchanged

#### Scenario: Automatic saving
- **WHEN** the player edits a Mine policy and closes the tab without any further action
- **THEN** reopening the workbench shows the edited policy in the Policy slot and under Mine

### Requirement: Classic reference policies follow their template
While the Policy slot holds a classic template's unedited reference policy and the Scenario slot holds that
template, changing the template's parameters SHALL replace the policy with the reference policy for the new
parameters. An edited reference policy SHALL NOT be replaced.

#### Scenario: Parameters change the reference policy
- **WHEN** the player activates the `classic.newsvendor` experiment and changes `lost_cost`
- **THEN** the scenario is copied to Mine with the new cost and the Policy slot holds the reference policy's
  order quantity for that cost

### Requirement: Shared items
Opening a share link SHALL add it as an experiment under Experiments › Shared with me.

- **Contents:** its scenario and policies SHALL be listed with it.
- **Duplicates:** opening a link whose contents match an existing shared experiment SHALL reuse that
  experiment instead of adding another.
- **Removal:** shared items SHALL be kept until the player deletes them.

#### Scenario: Same link twice
- **WHEN** the player opens the same share link on two visits
- **THEN** Experiments › Shared with me holds one experiment from that link

### Requirement: Import and export
The player SHALL be able to import a policy from a `.lua` file, and a scenario from a `.lua` script or a
`.json` document, into Mine.

- **Kind:** the kind SHALL be the one the player chose to import.
- **Name:** the item SHALL be named after the file.
- **Scenario errors:** a scenario that fails evaluation or validation SHALL still be imported, with its errors
  shown when it is opened.
- **Rejected files:** a file that is not text, or is larger than 1 MB, SHALL be rejected with a message and
  nothing imported.
- **Export:** the player SHALL be able to export any item as a `.lua` or `.json` file, and any experiment as a
  `.json` file that can be imported back as an experiment.

#### Scenario: Import a policy
- **WHEN** the player imports `buffer.lua` as a policy
- **THEN** a policy named "buffer" appears under Policies › Mine with the file's contents

#### Scenario: Experiment round trip
- **WHEN** the player exports an experiment and imports the file in another browser
- **THEN** an experiment with the same scenario, policies, seed, batch settings and view appears under Mine

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
- **THEN** the explorer is hidden behind a button that opens it as a drawer, and choosing an item closes the
  drawer
