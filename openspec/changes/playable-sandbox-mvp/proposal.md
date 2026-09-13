## Why

dustline has a roadmap but no software. The quickest way to test the central
claim — that stock-balancing train dispatch fails in predictable ways — and to
find out whether players want to write their own policies is a playable sandbox
on the public web. It should show the problem, let players write and compare
policies, and share them with a link, while deferring scoring, reports and the
mod.

This change covers slices of roadmap stages M0 (foundations), M2 (engine), M3
(policy runtime), M4 (`ops` v1, reduced), M5 (single-run app), M6 (batch
comparison, reduced), M7 (docs, reduced) and the hosting part of M9. It does not
wait for M1 (game research); where M1 answers are missing it states assumptions
and labels the baseline as observed, not verified.

## What Changes

- pnpm workspace with `engine`, `policy-api`, `lua-runtime`, `cli`, `app` and
  `docs` packages, plus lint, type-check, test and cross-browser determinism
  jobs in CI.
- A validated scenario format and starter scenarios that demonstrate the half
  capacity limit, operating at the edge, relay dead stock, ping-pong and double
  dispatch.
- A deterministic simulation engine for a single line: stations with
  per-resource capacity, one or more shuttling trains, producers and consumers
  with seeded randomness, storm events, an event log and core metrics.
- A sandboxed Lua policy runtime with Policy API v1: stop hook, snapshot limited
  to the `local` or `line` information level, load, unload, log and record
  actions, persistent serialisable memory, instruction budget, and shuffled
  unordered iteration.
- The naive baseline as `naive.lua`, cross-checked against a TypeScript
  reference.
- A reduced `ops` library: the policy pipeline with balance, manual roles,
  order-up-to, min-max, drain, fill and pass-through targets, inventory position
  with reservations, downstream lookahead, priority and proportional allocation,
  and decision traces.
- A single-run web view: Lua editor with diagnostics and hover help, scenario
  picker, line map, stock and metric charts, timeline scrubber and stop
  inspector.
- Batch comparison: Monte Carlo runs across workers, metric distributions with
  confidence intervals, and a paired A/B comparison of two policies on identical
  seeds.
- Share links carrying policy and scenario in the URL, and local saving.
- Essential documentation inside the app and as static pages: getting started,
  language and sandbox rules, generated Policy API and `ops` reference,
  failure-mode explanations, metric definitions, game mechanics assumptions,
  and a non-affiliation notice.
- A host-agnostic static build that works on GitHub Pages or S3 without server
  rewrites or special headers, deployed to GitHub Pages from CI, with S3
  deployment documented.

Out of scope for this change: benchmark suites, bounds and scores; Reddit
reports, result cards and verify links; parameter tuning and the form builder;
the `line+history` and `colony` information levels; estimation, statistical
and control blocks; parameter sweeps; the game mod; the research track.

## Capabilities

### New Capabilities

- `scenarios`: scenario file format, validation rules and the starter scenario
  set.
- `simulation-engine`: deterministic single-line simulation, randomness, event
  log, run outputs and core metrics.
- `policy-runtime`: sandboxed Lua execution of policies, Policy API v1,
  information levels, memory, budget and the naive baseline.
- `ops-library`: the policy pipeline, the MVP building blocks, inventory
  position and decision traces.
- `run-explorer`: editing a policy, running one scenario and seed, and
  inspecting the result visually.
- `batch-comparison`: Monte Carlo runs and paired comparison of two policies.
- `sharing`: share links and local persistence of policies and scenarios.
- `documentation`: in-app and static documentation, generated reference and
  documentation checks.
- `static-hosting`: host-agnostic build output, deployment to GitHub Pages and
  documented S3 deployment.

### Modified Capabilities

None; there are no existing specs.

## Impact

- New code in every workspace package; `mod` and `bench` are not created yet.
- New runtime dependencies: React, Zustand, Radix UI, CodeMirror 6, uPlot,
  Observable Plot, Comlink, Zod, a Lua VM compiled to WebAssembly, MDX tooling,
  KaTeX, Shiki and MiniSearch.
- CI grows from a file check to lint, type-check, unit and property tests,
  Playwright determinism tests on three browsers, documentation checks, build
  and deploy.
- GitHub Pages must be enabled for the repository. Pages on a private
  repository needs a paid GitHub plan; otherwise the repository must be public
  before the first deploy.
- The Lua version and vanilla dispatch rules are assumptions until M1; the
  Policy API and baseline may change in a later versioned release.
