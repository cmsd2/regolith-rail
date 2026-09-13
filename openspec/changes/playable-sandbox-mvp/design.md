## Context

The repository contains a licence, README, roadmap, OpenSpec setup and a CI
workflow that only checks files exist. There is no code. See proposal.md for
motivation and scope, and the specs for required behaviour.

Constraints that shape the approach:

- Results must be identical in Node, Chromium, Firefox and WebKit.
- Hosting is static and host-agnostic: no rewrites, no custom headers, so no
  cross-origin isolation and therefore no `SharedArrayBuffer`.
- The game's Lua version and exact dispatch rules are unknown until roadmap M1.
- Policies must be written so they can later run inside the game.

## Goals / Non-Goals

**Goals:**

- A package structure that later stages (benchmark, reports, mod) extend rather
  than restructure.
- Determinism by construction, verified in CI from the first engine commit.
- A Lua runtime whose language restrictions and budget do not depend on which Lua
  VM is used, so the VM can be swapped after M1.
- An interface that stays responsive during runs and batches on ordinary
  laptops.

**Non-Goals:**

- Performance tuning beyond keeping a 100-seed batch of a starter scenario
  comfortably interactive.
- Mobile layouts. The application targets desktop browsers; documentation pages
  are readable on mobile.
- Accessibility beyond what Radix primitives and semantic HTML provide by
  default. A dedicated pass comes before public launch.

## Decisions

### D1. Workspace packages

`engine`, `policy-api`, `lua-runtime`, `cli`, `app` and `docs` as pnpm
workspace packages. `engine` and `lua-runtime` compile without DOM types, so
the compiler rejects browser APIs in simulation code. `bench` and `mod` are not
created until their stages.

*Alternative:* one package with folders. Rejected because nothing would stop
UI code leaking into the engine, and the CLI and doc checks need the engine
without the app.

### D2. Time model

Hybrid discrete-event simulation. Train arrivals, departures and scenario events
are scheduled in a priority queue keyed by (time, event kind order, entity id).
Production and consumption are integrated on a fixed one-game-minute tick,
also scheduled through the queue, with integer remainders carried between ticks
so rates below one milli-unit per tick are exact over time. A minute is fine
enough for rates stated per sol and keeps full-detail replay data small over
runs of several sols (1,440 rows per sol).

*Alternatives:* pure fixed tick (simple, but train timing is quantised and slow
for long runs); pure event-driven with analytic production (exact, but stock
crossing capacity or zero mid-interval makes events complex). The hybrid keeps
train timing exact and production simple.

### D3. Integer quantities

Stock, cargo and capacity in milli-units; time in milliseconds of game time;
rates in milli-units per sol, as the game states them (for example about 8
Metals per sol from an extractor). All engine arithmetic is integer and stays
below 2⁵³.
The milli-unit scale matches the resource scale used in the original game's
public source, which reduces translation in the future mod; M1 will confirm it
for Relaunched.

### D4. Randomness

A small xoshiro128\*\* generator using only 32-bit integer operations. Each
stream is seeded by hashing the run seed with a stable stream name such as
`consumer:station-b:Food`, which gives the independence the engine spec
requires. Distributions use only integer arithmetic: uniform ranges by rejection
sampling, on/off bursts by per-tick Bernoulli trials with probabilities in parts
per million. No `Math.random`, `Date`, `exp`, `log`, `pow` or trigonometry in
simulation code; a lint rule enforces this in `engine`.

Batch seed lists are derived by the same hash from the base seed and index.

### D4a. World events as states

Events are windows during which the world is in a different state, as the
game's disasters are, rather than impulses that change stock directly. Each
event has a schedule (fixed, or random checks with a probability) and effects;
each effect has a type (`supply` or `demand`), a station and resource selection,
a multiplier in thousandths, and optionally its own offset and duration relative
to the event start. At each tick a flow's rate is its variable base rate times
the product of every active effect covering it, computed with integer
arithmetic in thousandths. Event start and end are logged per event, and each
effect's activation is derived from the event's start, so replay needs no extra
state.

Trains are deliberately untouched by events. Diverted traffic from grounded
shuttles is deferred to the roadmap; when added it will be further supply and
demand effects, not a new mechanism.

*Alternative:* a fixed list of disaster types with built-in consequences.
Rejected because the game's consequences for rail freight vary by colony, and
effects compose to express storms, maintenance surges and later diverted traffic
with one mechanism.

### D5. Policy interface inside the engine

The engine calls a policy through a synchronous interface that takes a stop
snapshot and returns a list of actions, traces, logs, records and an optional
error. Two implementations exist: the Lua runtime and a TypeScript reference
naive policy used only for cross-checking and tests.

Engine and Lua runtime run together in the same worker, so a stop costs one
call into the VM, not a message between threads.

### D6. Lua VM

wasmoon (Lua 5.4 compiled to WebAssembly) for this change. Floating-point
operations inside WebAssembly are deterministic across browsers, including the
`math` library, which is compiled into the module.

*Alternative:* Fengari (Lua 5.3 in JavaScript). Avoids the WebAssembly boundary
but is slower for compute-heavy policies and less actively maintained.
Revisited after M1 alongside the confirmed game Lua version.

### D7. Language restrictions and budget by source analysis

Policy source is parsed in the Lua 5.1 grammar with luaparse before loading.
The parse rejects syntax outside 5.1 with line numbers. The same syntax tree is
used to:

- insert a budget counter call at the start of every function body and loop
  body, which enforces the instruction budget independently of the VM's debug
  hooks;
- give editor diagnostics identical to load-time errors, by running the same
  checker in the editor's worker.

The sandbox environment is built by a Lua prelude that removes banned globals
(replacing them with erroring stubs that name alternatives), replaces `pairs`
and `next` with seeded shuffled versions, and wraps the snapshot in read-only
proxy tables whose `__index` raises information-level errors.

*Alternative:* VM debug hook for the budget. Rejected for now because it ties
the budget to one VM's API and counts differently across VMs.

### D8. Snapshots and memory

The engine builds each stop's snapshot as plain data, filtered to the scenario's
information level, and passes it into Lua in one call. Actions are collected in a
Lua table and returned in one call. Memory tables live in the Lua state between
calls; after each call the prelude walks them to enforce the serialisable rule.
Save and reload test mode serialises memory, creates a fresh Lua state, reloads
the policy and restores memory.

Each run creates a fresh Lua state, which guarantees no state leaks between runs.

### D9. `ops` library

Written in Lua under the policy restrictions, stored as source files in
`policy-api`, bundled as strings and loaded by the prelude as the global `ops`
(since `require` is banned). Blocks are tables with a declared information level,
a parameter schema and a decide function. `ops.policy` checks levels and
parameters at load time and returns a normal policy module. Traces are emitted
through an internal channel that the prelude exposes only to `ops`.

The pipeline for this change is classify → target → plan → allocate → execute.
Stage names for estimate and control are reserved so later blocks do not change
existing policies.

### D10. Single source for the Policy API

`policy-api` holds a TypeScript description of every `ctx` member and `ops`
block: type, information level, summary, parameters and documentation slug. A
generator produces the TypeScript types used by the engine, a LuaLS annotation
file, the editor's completion and hover data, and the reference documentation
data. The documentation check fails when a description lacks documentation.

### D11. Workers and results

The app uses Comlink over module workers. A single run executes in one worker;
a batch uses a pool sized to `navigator.hardwareConcurrency` (capped at 8), each
worker running whole seeds.

Run output is columnar: typed arrays for time series and event fields, plus a
string table, transferred to the main thread without copying. State at any time
is rebuilt from checkpoints taken every simulated minute plus the events since,
so the timeline can move instantly without re-running.

Batches keep only metrics and downsampled series (200 points per run) for
distribution and fan charts; opening a seed re-runs it in full, which the batch
consistency requirement guarantees gives the same result.

### D12. App structure

React with Zustand stores for policy sources, scenario, run results, playhead
and batch state. Radix UI primitives with CSS Modules. CodeMirror 6 in a thin
wrapper with the legacy Lua mode, a lint source calling the checker worker, and
completion and hover sources from the generated API data.

The line map is a Canvas 2D component whose animation loop reads the playhead
from the store directly, so playback does not re-render React. uPlot renders
time series with a cursor synced to the playhead. Observable Plot renders batch
distributions and is loaded only when batch mode opens.

### D13. Confidence intervals

Mean ± t·s/√n with a table of Student t critical values for 95% up to n = 1000,
computed with `Math.sqrt` only. Paired comparison uses per-seed differences.
Batch statistics are computed on the main thread from integer metrics after all
seeds finish, so they do not depend on worker count.

### D14. Share links

The share state is JSON, compressed with the browser's `CompressionStream`
(`deflate-raw`), encoded as base64url, and placed in the fragment as
`#v1.<payload>`. The version prefix allows the format to change later. Decoding
failures fall back to the default view as the sharing spec requires. Local saves
and drafts use IndexedDB through idb-keyval, with drafts written on a debounce.

### D15. Routes, documentation and build

React Router 7 in framework mode with `ssr: false` and prerendering. Routes are
`/` (application) and `/docs/*` (one prerendered HTML file per page), plus a
static `404.html`. The application's own state lives in stores and the fragment,
not in client routes, so no host rewrites are needed.

The base path is a build variable passed to Vite's `base` and the router's
basename. Documentation content is MDX with KaTeX and Shiki at build time;
MiniSearch builds the search index at build time and ships it as a hashed JSON
asset. Fonts are bundled.

The documentation check runs in Node: it extracts runnable examples and executes
them with the Lua runtime and engine (wasmoon runs in Node), checks every
generated reference entry has content, and checks internal links and anchors
against the built output.

### D16. CI and deployment

One workflow with jobs: lint and type-check; unit and property tests; build;
documentation check; Playwright determinism tests against the built site in
Chromium, Firefox and WebKit, comparing result hashes with golden hashes
produced by the CLI in the same job; and deploy.

Deploy runs only on `main` after every other job passes, uploads the build with
`actions/upload-pages-artifact` and publishes with `actions/deploy-pages`. A
`workflow_dispatch` trigger with a ref input redeploys any earlier commit.
The Pages build uses base path `/regolith-rail/`.

S3 deployment is documentation only in this change: an `aws s3 sync` sequence
that uploads hashed assets with long-lived cache headers and HTML with
no-cache, sets `application/wasm` for WebAssembly, and configures `404.html` as
the error document or CloudFront custom error response.

## Risks / Trade-offs

- [WebAssembly boundary cost per stop makes batches slow] → one call in and out
  per stop; measure a 100-seed `mixed-line` batch early and switch to Fengari if
  it is too slow.
- [luaparse in 5.1 mode rejects code the game would accept] → acceptable while
  the game's version is unknown; relax the grammar after M1.
- [Source-instrumented budget can be bypassed by long-running built-in calls,
  such as `string.rep` with a huge count] → cap string sizes in the prelude's
  replacements for affected string functions and rely on the worker being
  terminable by the app.
- [The naive baseline does not match the game] → labelled as observed
  behaviour throughout; baselines are versioned so a corrected one does not
  invalidate the mechanism.
- [GitHub Pages is unavailable for a private repository on the current plan] →
  make the repository public before the first deploy or upgrade the plan; the
  build is host-agnostic, so S3 remains an option.
- [Observable Plot and CodeMirror increase bundle size] → lazy-load batch views
  and documentation widgets; keep the first run path small.
- [`CompressionStream` missing in an older browser] → the unsupported-browser
  check includes it.
- [Checkpoint memory for long runs] → checkpoint interval is adjustable per run
  length; the starter scenarios are sized to stay small.

## Migration Plan

There is nothing to migrate. First deployment: enable GitHub Pages with the
Actions source, resolve repository visibility, merge to `main`, and confirm the
deploy job publishes. Rollback: run the deploy workflow manually with the ref
of the last good commit.

## Open Questions

- Whether to use a custom domain instead of the default Pages URL. Changing it
  later only changes the base path build variable.
- The instruction budget value. It is a constant tuned once real policies exist
  and does not change behaviour beyond when a budget overrun is reported.
