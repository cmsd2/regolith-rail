## 1. Planning documents

- [x] 1.1 Confirm `general-scenarios-and-packs` is archived and its specs synced. Verify `openspec validate library-explorer-and-experiments --strict` passes against the synced specs.
- [x] 1.2 Add the library explorer and experiments to the M9 deliverables in `docs/roadmap.md`, and note that local saving delivered in M5 is replaced. Verify every stage reference in the document still resolves.

## 2. Library model and catalogue

- [x] 2.1 Define library item, experiment content and slot types in the app, with stable id helpers for each source. Verify unit tests cover id round trips and the name-uniqueness helper ("naive (copy)", "naive (copy 2)").
- [x] 2.2 Export example policies from `scenario-kit` with names and one-line descriptions read from their opening comments. Expose the documentation's runnable examples, named after their pages, with their page and scenario, as a committed `generated/examples.json` in the docs package. Verify the docs check fails when that index is out of date or an example names an unknown scenario.
- [x] 2.3 Build the read-only catalogue from the packages: starters, built-in policies, kit and docs examples, classic templates, reference policies, and classic and failure-mode experiments. Verify a unit test lists every expected item with a description and no duplicate ids.
- [x] 2.4 Generate transient items for classic reference policies at given parameters and for experiment parts. Verify unit tests show equal parameters give equal ids and the reference policy matches `classicTemplates` for those parameters.

## 3. Storage and migration

- [x] 3.1 Implement storage version 2 with `items`, `experiments` and `session` stores, and memory and unavailable variants. Verify storage unit tests cover save, list, rename, duplicate and delete for items and experiments.
- [x] 3.2 Migrate version 1 saved policies, saved scenarios and the draft into version 2. Built-in content maps to catalogue ids. Old records are deleted only after the new ones commit. Verify unit tests cover each saved item shape, a pre-script draft, an unedited-starter draft, and a failed write that leaves version 1 intact.

## 4. Slots, copy on edit and automatic saving

- [x] 4.1 Replace the workbench's policy, policy B and scenario fields with slots that refer to items. Keep evaluation status keyed by content, and derive editor contents and run requests from the slots. Verify the existing workbench unit tests pass after being updated to slots, and golden hashes are unchanged.
- [x] 4.2 Implement `editSlot` with copy on edit for read-only items and in-place updates for Mine items, including template parameter changes. Verify unit tests: the first edit of naive creates "naive (copy)" and re-points the slot, a second edit updates the copy, and the built-in item is unchanged.
- [x] 4.3 Implement reference policies that follow their template's parameters, and stop following once edited. Verify the newsvendor `lost_cost` unit test and an edited-reference test pass.
- [x] 4.4 Save Mine items and the session record automatically 500 ms after changes and on `pagehide`, with a saving indicator. Restore slots on start. Verify session unit tests for automatic saving, restoring slots, storage unavailable, and a slot whose item was deleted.

## 5. Experiments and sharing

- [x] 5.1 Implement save as experiment, update experiment, and open experiment (slots, seed, view and batch settings, no run). Verify unit tests: opening restores everything, and editing a part forks it without changing the experiment.
- [x] 5.2 Map share links to and from experiment content without changing the link format. Open links as `shared:experiment:<hash>` items, deduplicated by content. Verify unit tests: a link round trip, the same link twice gives one item, and links from the first release still open.
- [x] 5.3 Hand docs examples over through `#example.<page>.<n>` fragments. Fill slots with example items in the workbench tab. Verify unit tests: an example leaves Mine items unchanged, and an unknown example shows a notice.

## 6. Import and export

- [x] 6.1 Import policies, scenarios and experiments from files into Mine, with the kind taken from the chosen group. Reject files over 1 MB or not valid UTF-8. Verify unit tests for each kind, an invalid scenario that imports with errors shown when opened, and both rejections.
- [x] 6.2 Export items as `.lua` or `.json`, and experiments as versioned `.json`. Verify a unit test that exporting then importing an experiment gives equal content.

## 7. Explorer and This run panel

- [ ] 7.1 Replace the built-in experiments in the catalogue with scenario lessons: each starter records its failure-mode page and suggested fix, and each classic scenario its page and reference policy. Verify catalogue unit tests find a lesson for every starter and template, and list no built-in experiments.
- [ ] 7.2 Build the explorer lists: Scenarios by source, Policies by fit, and Saved runs, one shown at a time in a tab list, each an ARIA tree. Grouping, empty-group omission and keyboard moves are pure functions. Verify their unit tests.
- [ ] 7.3 Judge policy fit from each policy's hooks and the scenario's vehicles and reviews, using the checker worker and caching by source hash, and group For this scenario, Built in, Mine, Shared and Other examples. Verify unit tests for grouping around `storm-shock` and `classic.reorder`, and for dimming an `on_review`-only policy on `two-station`.
- [ ] 7.4 Build the This run panel with Scenario, Policy and batch-only Compare slots, origin labels, the scenario's documentation link, template parameters, Try the suggested fix and Use the reference policy, and slot choosing, which shows the matching list and can start from the batch view. Clicking an item selects it; double-click, Enter or Use fills its slot. Verify end-to-end tests for selecting without changing the run, using an item, each lesson action, and choosing and cancelling a slot.
- [ ] 7.5 Add item actions (rename, duplicate, delete, export) in a fixed-height details area, and list actions (import, save as experiment, update experiment). Verify end-to-end tests for each action's effect on the library.
- [ ] 7.6 Remove the toolbar scenario picker, the saved-work drawer and the batch view's policy B selector. Verify no remaining references in the app and the full check passes.

## 8. Layout

- [ ] 8.1 Lay the workbench out as explorer, editor, views and optional docs columns, with drag and keyboard resizing and a collapsible explorer. Remember widths and collapsed state in `localStorage` with safe fallbacks. Verify an end-to-end test that collapses the explorer, reloads, and finds it still collapsed with the editor widened.
- [ ] 8.2 Below 800 px, open the explorer as a drawer that closes when an item is chosen. Verify an end-to-end test at 375 px wide.

## 9. Documentation

- [ ] 9.1 Write a "Library and experiments" guide covering sources, slots, copy on edit, experiments, share links, and import and export, and link it from the explorer. Verify the docs check and link check pass.
- [ ] 9.2 Update Getting started and the sharing guide to use the explorer and slots instead of the drop-down and drawer. Verify their runnable examples still open and the docs check passes.

## 10. End-to-end tests and verification

- [ ] 10.1 Replace the `scenario-picker` and saved-work helpers in the end-to-end tests with explorer helpers, and update affected tests. Verify the full end-to-end suite passes on Chromium, Firefox and WebKit.
- [ ] 10.2 Add end-to-end tests for the spec scenarios. Verify they pass on Chromium, Firefox and WebKit:
  - built-in content listed, and keyboard navigation;
  - use a policy, and run a built-in policy;
  - choose a comparison policy;
  - try the suggested fix, and use the reference policy;
  - examples for the current scenario come first, and an unfit policy is marked;
  - edit a built-in policy, then reload;
  - save and reopen an experiment, listed under Saved runs;
  - the same share link twice;
  - import a policy, and an experiment round trip between browsers;
  - an example keeps the player's work;
  - migration from seeded version 1 data.
- [ ] 10.3 Run the full check, documentation check, determinism tests and end-to-end tests in CI on a pull request. Verify every blocking job passes and golden hashes are unchanged.
