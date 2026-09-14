## Why

A run needs two things, a scenario and a policy, plus a second policy when comparing. The workbench offers
them in three unrelated places:

- a scenario drop-down in the toolbar;
- a drawer of saved policies under the editor;
- a policy B selector that only appears in the batch view.

Built-in policies cannot be opened in a single run at all. Example policies from the scenario kit and the
documentation have no home: opening a docs example replaces the player's policy with an unsaved
`example.lua`. A new player is unsure where to start.

A plain file tree does not fix this. A tree opens one document, but a run combines items of different kinds,
and a policy can come from a built-in, an example, a share link, a file or the player's own editing. This
change separates browsing (a library) from combining (the run's slots), and names the saved combination an
experiment. Share links already are experiments, and each scenario's lesson, why the baseline fails and
what fixes it, moves onto the scenario itself. It belongs to M9, whose guides must take a new player from nothing to a shared result, and
replaces the local saving delivered in M5.

## What Changes

- **This run.** Three slots at the top of a new left-hand column hold the run's Scenario, Policy and, in the
  batch view with comparison on, Compare policy.
  - **Scenario lessons:** the Scenario slot carries what the scenario teaches. A starter shows why the baseline
    fails and offers its suggested fix. A classic template shows its parameters and offers its reference
    policy.
  - **Choosing:** choosing a slot shows the matching list. The batch view offers choosing policy B too.
- **Library explorer.** Below the slots, three lists shown one at a time:
  - **Scenarios**, grouped by source: Built in, Examples, Classic problems, Mine and Shared with me.
  - **Policies**, grouped by fit to the current scenario. Its fix or reference policy comes first, then
    built-in, Mine and shared policies, with other fixes and reference policies collapsed last. Documentation
    snippets are not listed; they open from their pages. Policies that define no hook
    the scenario calls are dimmed with the reason.
  - **Saved runs**, the player's and shared experiments.
  - **Selecting and using:** clicking an item only selects it and shows its description and actions.
    Double-clicking, Enter or Use puts it in its slot, so browsing never swaps the editor's contents.
- **Experiments.** An experiment is a saved snapshot of the slots, the seed, the batch settings and the view.
  - The player can save the current run as an experiment, open it later from Saved runs, and update it.
  - A share link opens as an experiment under Shared with me, and opening the same link again does not add a
    duplicate.
- **Copy on edit.** Built-in, example, classic and shared items never change.
  - Editing one creates a copy under Mine, and the slot switches to the copy.
  - Mine items save automatically.
  - They can be renamed, duplicated, deleted and exported.
- **Import and export.** A policy or scenario can be imported from a `.lua` or `.json` file on disk into Mine.
  Items and experiments can be exported as files.
- **Removals.**
  - **BREAKING (interface only):** the toolbar scenario drop-down, the saved-work drawer and the batch view's
    policy B selector are replaced by the library and slots.
  - Template parameters and the documentation link stay with the scenario.
  - Share links keep their format.
  - Saved policies, saved scenarios and drafts from earlier releases are moved into Mine on first load.
- **Documentation examples.** "Open in workbench" fills the slots with the example's policy and scenario as
  read-only Examples items, so opening an example no longer overwrites the player's own work.

## Capabilities

### New Capabilities
- `library`: the library explorer and its lists, run slots and scenario lessons, policy fit, experiments and
  saved runs, copy on edit, automatic saving, and import and export of files.

### Modified Capabilities
- `run-explorer`: scenario and policy selection moves from the toolbar and drawer to the library and slots;
  first visit fills the slots with `two-station` and the naive baseline.
- `sharing`: local saving becomes the library; share links open as experiments under Shared with me; saved
  work and drafts from earlier releases are migrated.
- `batch-comparison`: policy B is chosen through the Compare slot.
- `documentation`: runnable examples open as read-only example items without replacing the player's work.

## Impact

- **App.**
  - **Workbench store:** holds slots that refer to library items instead of a policy, policy B and scenario
    draft.
  - **New code:** a library store and catalogue, and explorer, This run and import/export components.
  - **Removed components:** `ScenarioControls` picker, `SavedWork`, the policy B selector in `BatchView`.
  - **Changed flows:** the session start (draft restore, share links) and docs `open-example`.
  - **Layout:** a fourth, optional column.
- **Storage.** A new IndexedDB layout for library items, experiments and slot state, with a one-time
  migration from saved items and drafts. When storage is unavailable, the library works for the session
  only.
- **Scenario kit and policy API.** Their example and reference policies are exposed as catalogue entries,
  with names and descriptions. No engine or Policy API change, so golden hashes are unaffected.
- **Docs.** Getting started, the sharing guide and a new page on the library and experiments.
- **Tests.** Unit tests for the library, migration and copy on edit; end-to-end tests for the explorer,
  slots, experiments, import and export, and migration.
- **Dependencies.** None new. Must be applied after `general-scenarios-and-packs` is archived, because it
  modifies requirements that change adds.
