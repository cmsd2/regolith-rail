## MODIFIED Requirements

### Requirement: Runnable examples
Code examples marked as runnable SHALL execute during the documentation check, and any stated expected output
SHALL match. Runnable examples SHALL offer an action that opens them in the workbench.

- **Library item:** the example SHALL open as a read-only item under Examples, named after its page.
- **Slot:** the item SHALL fill its slot, and a scenario the example names SHALL fill the Scenario slot.
- **Player's work:** opening an example SHALL NOT change or remove any Mine item.

#### Scenario: Broken example
- **WHEN** a runnable example no longer produces its stated output
- **THEN** the documentation check fails and names the page and example

#### Scenario: Opening an example keeps the player's work
- **WHEN** a player with an edited Mine policy in the Policy slot opens the min-max example from its page
- **THEN** the Policy slot holds the example under Examples, the Mine policy is unchanged under Mine, and
  editing the example creates a new copy under Mine
