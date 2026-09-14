## Context

The motivation is in proposal.md. The current state that shapes the approach:

- **Workbench store (`state/workbench.ts`).** Holds the work by value:
  - `policy` and `policyB` as `{ name, source }`;
  - `scenario` as a `ScenarioDraft`: source, kind, starter id, template, and evaluation status and result.

  `restore(content)` replaces all of it. Actions like `selectStarter` and `selectTemplate` rewrite it. Choosing
  a template also replaces the policy with the template's reference policy.
- **Library store (`state/library.ts`).** Lists named `SavedPolicy` and `SavedScenario` items from IndexedDB
  (`lib/storage.ts`, idb-keyval). It knows nothing of the workbench; the `SavedWork` drawer copies between
  them.
- **Session (`state/session.ts`).**
  - Decodes a share fragment, or restores a single draft.
  - Then saves the draft 500 ms after each change to policy, policy B, scenario or seed, and on `pagehide`.
- **Docs examples (`docs/open-example.ts`).**
  - In the workbench tab, they call `restore` directly.
  - From a standalone docs page, they encode a share link and navigate to it, so they look exactly like shared
    work.
- **Built-in catalogue sources today:**
  - starters from `@regolith-rail/engine` and scripts from `scenario-kit`;
  - templates and reference policies from `scenario-kit` `classicTemplates`;
  - `BUILT_IN_POLICIES` from `policy-api`;
  - kit policies `moving-average.lua` and `fill-the-route.lua`, which are not exposed to the app;
  - docs runnable examples, which are extracted at build time.
- **Share links.** Carry one policy, an optional policy B, a scenario record, seed, view and batch settings.
  That is already an experiment.
- **Dependency.** `general-scenarios-and-packs` is not yet archived, and its deltas add the "Scenario
  selection" and "Local saving" text that this change modifies. It must be archived first.

## Goals / Non-Goals

**Goals:**
- One model where every scenario or policy the workbench shows is a library item, and the run refers to
  items rather than owning copies.
- Behaviour a player can predict: read-only items never change, and edits always land in Mine without an
  explicit save.
- Keep the share link format, the engine, the Policy API and golden hashes unchanged.
- Keep simulation and evaluation off the main thread, and keep high-frequency rendering out of React state.

**Non-Goals:**
- Folders, tags or search inside Mine. Grouping by kind and source is enough for now.
- Syncing across devices, or any server storage.
- Version history of Mine items beyond the last saved state.
- Changing how batch results, the map or inspectors work.
- Parameter sweeps.

## Decisions

### 1. Items are the unit of content; slots hold item ids

A library item is `{ id, kind, source, name, description?, content, origin?, createdAt, updatedAt }`:

- `kind` is `scenario`, `policy` or `experiment`;
- `source` is `builtin`, `example`, `classic`, `mine` or `shared`;
- `content` is a `ScenarioSource`, a policy source string, or an `ExperimentContent`;
- `origin` is the id of the item a copy was made from.

The workbench keeps `slots: { scenario: ItemId; policy: ItemId; compare: ItemId | null }` and derives the
editor contents from the items. Scenario evaluation status stays in the workbench, keyed by the slot's
current content, so it is never persisted into items.

*Alternative considered:* keep owning copies in the workbench and link them to items loosely. That keeps
today's code, but brings back the "which copy am I editing" question the change exists to remove, and makes
copy on edit and restoring slots ad hoc.

### 2. Read-only catalogue items are generated, not stored

Built-in, example and classic items are built in memory at startup from the packages that own them, with
stable ids:

- Mars starter scenarios: `builtin:scenario:<starter id>`.
- Built-in policies: `builtin:policy:<name>`.
- Kit example policies: `example:policy:<file>`.
- Documentation runnable examples: `example:policy:docs/<page>#<n>`.
- Classic templates at their defaults: `classic:scenario:<template>`.
- Classic reference policies at the template defaults: `classic:policy:<template>`.
- Built-in experiments: `classic:experiment:<template>` for each template with its reference policy, and
  `builtin:experiment:<failure mode>` for each failure-mode page's suggested fix.

Failure-mode fixes and docs examples come from the documentation's runnable examples. The docs build
already extracts those with their scenario, so they need no second copy. `scenario-kit` exports its example
policies with names and one-line descriptions. The docs check fails if a catalogue entry lacks a
description.

*Alternative considered:* seed IndexedDB with built-ins. Rejected: they would go stale when the site updates
and would need their own migrations.

### 3. Copy on edit in the store, not the editor

Every edit goes through one store action, `editSlot(slot, change)`.

- **Read-only item:** the action creates a Mine item with a fresh id, `origin` set to the original, a unique
  name (`"naive (copy)"`, `"naive (copy 2)"`), and the change applied. It then points the slot at the copy
  in the same state update, so the editor never shows a moment where the edit belongs to the built-in item.
- **Mine item:** the action updates the item's content and `updatedAt`.
- **Template parameters:** changing them is an edit to the scenario slot.
- **Reference policy follows its template:** when the policy slot holds `classic:policy:<same template>`, the
  slot is rewritten to a transient read-only item for the new parameters. The id encodes the template and a
  stable hash of the parameters, generated on demand like the catalogue. It is marked not listed, so the
  explorer does not grow an entry per parameter change. Editing it forks to Mine like any read-only item.

*Alternative considered:* ask the player "Save a copy?" on the first edit. Rejected: it interrupts typing and
reintroduces unsaved state.

### 4. Automatic saving replaces drafts

The session subscribes to Mine items and slots, and writes changed items and the slot record to storage
500 ms after the last change and on `pagehide`, as drafts do today. The storage layout:

| Store | Keys |
| --- | --- |
| `items` | item id |
| `experiments` | item id (experiments are items, but kept apart so listing them stays cheap) |
| `session` | one record: slots, view, seed, batch settings |

The draft status indicator becomes a saving indicator on the This run panel.

### 5. Experiments are snapshots by value

`ExperimentContent` holds:

- the scenario source and its template;
- the policy source, and the compare policy source when present;
- for each part, the `origin` item id and name, for display;
- seed, view and batch settings.

Opening an experiment:

1. Each part is exposed as a read-only transient item, `experiment:<id>/scenario`, `/policy` or `/compare`,
   listed under the experiment in the explorer.
2. The slots point at those items.
3. The seed, view and batch settings are restored.

Editing a part forks it to Mine like any read-only item, so the experiment itself stays a snapshot. "Update
experiment" rewrites a Mine experiment from the current slots. "Save as experiment" creates one.

A share link maps one to one onto `ExperimentContent`. Share links keep the v1 format. The experiment's name
is derived from its scenario and policy names, such as "two-station · supply-to-demand".

*Alternative considered:* experiments that reference items by id. Rejected: renaming or deleting an item would
silently change or break an experiment. Share links can't carry references anyway.

### 6. Shared items are deduplicated by content

A shared experiment's id is `shared:experiment:<hash>`, a SHA-256 over the canonical JSON of its content,
without the app version. Opening the same link again finds the same id and just fills the slots. Hashing uses
Web Crypto on the main thread. It runs once per link opening, not in a simulation path, so it does not affect
determinism.

### 7. Docs examples hand over through their own fragment

A docs example opened from a standalone docs page navigates to `/#example.<page>.<n>` rather than to a share
link. The workbench looks up the generated catalogue item and fills the slots. This keeps examples out of
Shared with me and keeps the fragment short. Unknown example references show a notice and change nothing.

### 8. Import and export

- **Import:** a file input scoped to the group the player chose (Import policy…, Import scenario…, Import
  experiment…).
  - **Checks:** files over 1 MB or failing UTF-8 decoding are rejected before any item is created.
  - **Scenarios:** a `.json` file is a JSON scenario; a `.lua` file is a script. Evaluation happens when opened,
    as for any scenario, so errors show in place.
  - **Experiments:** these import from `.json` files with `{ "regolithRail": "experiment", "version": 1, ... }`.
- **Export:** creates a Blob and a temporary object URL with a `download` attribute. Nothing is sent anywhere.

### 9. Layout

The workbench grid becomes explorer | editor | views | docs. Column widths are CSS custom properties set by
drag handles: pointer events, plus arrow-key resizing on focus. Widths and the explorer's collapsed state are
kept in `localStorage`, wrapped in try/catch, not in IndexedDB. They are per-browser view preferences, not
work. Below 800 px wide:

- the explorer becomes a Radix Dialog drawer opened from a toolbar button;
- choosing an item closes the drawer.

The explorer tree uses the ARIA tree pattern (`role="tree"`, `treeitem`, roving tabindex) rather than a new
dependency.

### 10. Migration from saved work and drafts

`openStorage` opens database version 2.

1. If version 1 stores exist, each saved policy or scenario becomes a Mine item with the same name.
2. The draft is compared with the catalogue by content. Parts equal to a built-in item point their slot at
   that item; other parts become Mine items named "Draft policy" or "Draft scenario".
3. The version 1 records are deleted in a later transaction, after the new ones commit.

A migration failure leaves version 1 intact and shows a notice. The library then runs in memory for the
session.

## Risks / Trade-offs

- **[Mine fills with copies from casual edits]** → Copies are only made on the first real edit, are named
  after their origin, and are grouped under Mine with most recent first. Deleting is one action. Renaming is
  offered on the slot. Nothing is deleted automatically. A clean-up aid can follow if it proves needed.
- **[Four columns are cramped on laptops]** → The explorer collapses to a rail. Docs and explorer widths are
  resizable and remembered. The docs panel stays optional.
- **[Transient items for reference policies and experiment parts confuse the tree]** → They are listed only
  under their experiment, or not at all for reference policies. Slots show a clear origin label, such as
  "Reference policy · classic.newsvendor".
- **[Automatic saving writes on every keystroke burst]** → Debounced to 500 ms and one transaction per flush,
  as drafts today.
- **[Migration loses work]** → Old records are deleted only after new ones commit. Unit tests cover migration
  from each shape of saved item and draft, including pre-script drafts. An end-to-end test seeds version 1
  data.
- **[Docs examples extracted at build time drift from the pages]** → They come from the same extraction the
  docs check runs. The check fails on an example without a scenario or name.
- **[Removing the toolbar drop-down breaks existing end-to-end tests and muscle memory]** → Tests move to
  explorer helpers. The first-visit guide and Getting started page point at the explorer.

## Migration Plan

1. Archive `general-scenarios-and-packs` after its task 11.2, so this change's deltas apply to current specs.
2. Land the library model, catalogue, storage version 2 and migration behind the existing interface. The old
   picker and drawer keep working, reading from items. Deploy.
3. Land the explorer, This run panel, experiments, import and export, and remove the old picker, drawer and
   policy B selector. Deploy.
4. Update Getting started, the sharing guide and the new library page in the same release as step 3.

**Rollback:** a redeploy of the previous commit through the manual deploy workflow. Version 1 records are
deleted only after migration succeeds, so an older release opened after migration sees no saved work. The
work is still present in version 2, and returns when the newer release is redeployed. This is acceptable for a
static site with one live version, and the release notes say so.

## Open Questions

- The exact wording and order of the source groups. Copy can be tuned during review without changing specs.
