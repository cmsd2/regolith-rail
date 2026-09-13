## 1. Workspace and CI foundations

- [x] 1.1 Create the pnpm workspace with `engine`, `policy-api`, `lua-runtime`, `cli`, `app` and `docs` packages, strict TypeScript configs (no DOM types in `engine` and `lua-runtime`), and verify `pnpm install` and `pnpm -r typecheck` succeed on a clean checkout
- [x] 1.2 Add Biome lint and format with a rule banning `Math.random`, `Date`, `Math.exp`, `Math.log`, `Math.pow` and trigonometric functions in `engine`, and verify a deliberate violation fails `pnpm lint`
- [x] 1.3 Add Vitest and fast-check to the workspace and verify an empty test suite passes with `pnpm test`
- [x] 1.4 Add `.gitattributes` for LF line endings and `.editorconfig`, and verify `git add --renormalize .` produces no changes afterwards
- [x] 1.5 Replace the CI workflow with lint, type-check and test jobs on pushes and pull requests, and verify all jobs pass on a pull request

## 2. Scenario format

- [x] 2.1 Define the scenario schema covering document fields, line topology, trains, producers and consumers, events, information level and defaults, and verify the minimal valid scenario and default capacity tests pass
- [x] 2.2 Implement validation errors for unknown fields, duplicate ids, unknown references, invalid quantities, unsupported levels and format versions, all reported together with document paths, and verify each error case has a passing test
- [x] 2.3 Generate and publish the JSON Schema from the scenario definition, and verify every test scenario that passes validation also validates against the published schema
- [x] 2.4 Write the five starter scenarios with descriptions and documentation slugs, and verify they all pass validation
- [x] 2.5 Change rates to milli-units per sol and replace storm events with events that have supply and demand effects in the scenario schema, and verify the event validation scenarios pass and the published schema is regenerated
- [x] 2.6 Dropped on 2026-09-13: the placeholder values are close enough to show the failures, so exact game values are no longer a goal. Original task: Retune the starter scenarios to game-typical values (station sizes of 30 or 60 units, and rates, speeds and times recorded on the game mechanics page), with `storm-shock` as a storm followed by a maintenance surge, and verify the game-scale station size test passes and each scenario still shows its failure against the naive baseline

## 3. Simulation engine

- [x] 3.1 Implement the xoshiro128** generator, stream seeding by name hash, integer uniform and burst distributions, and batch seed derivation, and verify output matches recorded reference values
- [x] 3.2 Implement the event queue with deterministic tie-breaking and the one-game-minute production and consumption tick with integer remainders, and verify rates below one milli-unit per tick are exact over a long run
- [x] 3.3 Implement train movement, reversal at terminals, travel time and dwell time, with trains not blocking one another, and verify the reversal and dwell scenarios pass
- [x] 3.4 Implement production, consumption, stalled production and unmet demand, and verify the full and empty station scenarios pass
- [x] 3.5 Implement world events with supply and demand effects, fixed and random schedules, effect offsets and multiplicative overlap, leaving trains unaffected, and verify the event scenarios in the scenarios and engine specs pass
- [x] 3.6 Implement the policy interface, ordered action application, clamping with warnings, unknown-resource warnings and policy failure handling, and verify the stops, actions and failure scenarios pass
- [x] 3.7 Implement the TypeScript reference naive policy, and verify it runs every starter scenario to completion
- [x] 3.8 Implement run output: event log, sampled series, and stock and cargo at every tick, and verify state at arbitrary times rebuilt from output equals state captured during the run
- [x] 3.9 Implement the metrics, and verify the oscillation and priority-weighting scenarios pass
- [x] 3.10 Add property tests for conservation, stock and cargo bounds, repeatability and stream independence over generated scenarios and random policies, and verify they pass with at least 500 cases each

## 4. Command-line runner and determinism tests

- [x] 4.1 Implement the CLI to run a scenario with a policy for one seed or a seed range and write JSON output, and verify the headless run and invalid scenario scenarios pass
- [x] 4.2 Add a result hash over event log, series and metrics, and a CLI command that writes golden hashes for the starter scenarios on seeds 1 to 20, and verify two consecutive invocations produce identical files
- [x] 4.3 Add a minimal browser test page and Playwright tests that run the same matrix in Chromium, Firefox and WebKit and compare with golden hashes, and verify the CI job passes and fails when one engine constant is changed

## 5. Policy API definition

- [x] 5.1 Describe every Policy API v1 `ctx` member with type, information level, summary and documentation slug in `policy-api`, and verify the engine's snapshot types are generated from it and type-check
- [x] 5.2 Generate the LuaLS annotation file, editor completion and hover data, and reference documentation data, and verify generation is reproducible and checked in CI for staleness

## 6. Lua runtime

- [x] 6.1 Integrate wasmoon in a worker-compatible module that runs in Node and browsers, and verify a trivial policy returns actions in both
- [x] 6.2 Implement the Lua 5.1 subset checker with line numbers and suggested alternatives, and verify integer division, bitwise operators, `goto` and attributes are each rejected with the expected message
- [x] 6.3 Implement source instrumentation for the instruction budget, and verify the infinite loop scenario reports a budget overrun with the executing line and the run continues
- [x] 6.4 Implement the sandbox prelude removing banned globals with guidance messages, and verify every banned name raises its expected error and state does not persist between runs
- [x] 6.5 Implement read-only snapshot proxies and information-level enforcement, and verify the writing-to-snapshot, local-level and line-level scenarios pass
- [x] 6.6 Implement `load`, `unload`, `log`, `record` and `rand`, and verify the recorded series scenario passes and `rand` is repeatable per seed
- [x] 6.7 Implement memory tables with the serialisable check, and verify the function-in-memory scenario reports the offending key
- [x] 6.8 Implement seeded shuffled `pairs` and `next`, and verify the key order scenario passes
- [x] 6.9 Implement save and reload test mode, and verify the module-local versus `ctx.memory` scenario passes
- [x] 6.10 Implement error reporting with message, line, train, station and time for load, runtime, budget and memory errors, and verify the runtime error location scenario passes
- [x] 6.11 Record the Policy API version in run output, and verify it appears as version 1

## 7. Naive baseline

- [x] 7.1 Write `naive.lua` implementing the documented rule, and verify its event logs equal the TypeScript reference on every starter scenario for seeds 1 to 50
- [x] 7.2 Add the naive baseline and reference cross-check to the golden hash matrix, and verify the Playwright determinism job covers it
- [x] 7.3 Measure a 100-seed `mixed-line` batch with `naive.lua` in Node and Chromium, record the timings in the design notes, and verify the decision to keep wasmoon or switch to Fengari is recorded

## 8. `ops` library

- [x] 8.1 Implement `ops.policy` with stage defaults, the required target, parameter validation and information-level checks at load, and verify the missing-target and balance-at-local-level scenarios pass
- [x] 8.2 Implement `ops.roles.manual` and role-keyed targets, and verify the targets-by-role and role-without-target scenarios pass
- [x] 8.3 Implement the target blocks `balance`, `order_up_to`, `min_max`, `drain`, `fill` and `pass_through`, and verify the min-max scenarios pass and the one-line baseline matches `naive.lua` on every starter scenario for seeds 1 to 50
- [x] 8.4 Implement reservations and inventory position kept in memory, and verify the no-double-dispatch and reservations-survive-reload scenarios pass
- [x] 8.5 Implement `ops.lookahead`, and verify the cargo-kept-for-further-station scenario passes
- [x] 8.6 Implement `ops.priority` and `ops.proportional`, and verify the proportional split scenario passes
- [x] 8.7 Implement custom functions for every stage with stage-attributed errors, and verify the custom target scenario passes
- [x] 8.8 Implement decision traces for every block, and verify the order-up-to trace scenario passes
- [x] 8.9 Run the policy checker over the `ops` source in CI, and verify it reports no violations
- [x] 8.10 Write an example supply-to-demand policy using roles, inventory position and lookahead, and verify it has lower mean unmet demand and oscillation count than the baseline on `two-trains` and `mixed-line` over 100 seeds

## 9. Application shell

- [x] 9.1 Set up the React Router 7 app with prerendering, the base path build variable, CSS Modules, Radix UI and the footer with non-affiliation notice and build version, and verify the built site loads at `/` and under `/regolith-rail/`
- [x] 9.2 Add Zustand stores for policies, scenario, run results, playhead and batch state, and verify store unit tests pass
- [x] 9.3 Add the worker layer with Comlink for single runs and a batch pool, with progress and cancellation, and verify cancelling a long run keeps the previous result and the interface responsive in a Playwright test
- [x] 9.4 Add the unsupported-browser check for WebAssembly, module workers and `CompressionStream`, and verify the message appears when those features are stubbed out in a test

## 10. Policy editor and scenario controls

- [x] 10.1 Embed CodeMirror 6 with Lua highlighting and a lint source using the subset checker in a worker, and verify the violation-while-typing scenario in a component test
- [x] 10.2 Add completion and hover from the generated API data with documentation links, and verify the hover help scenario
- [x] 10.3 Add the scenario picker, JSON scenario editor with in-place validation errors, seed and run options including save and reload test mode, and verify the invalid edit scenario disables Run
- [x] 10.4 Load `two-station` and `naive.lua` on first visit, and verify the first visit scenario in Playwright

## 11. Run views

- [x] 11.1 Build the Canvas 2D line map with stock bars, trains, direction and cargo, driven from the playhead without React re-renders, and verify playback in a Playwright test and that React render counts stay flat during playback
- [x] 11.2 Build uPlot charts for station stock, train cargo and recorded series with a cursor synced to the playhead, plus the metrics summary with definition links, and verify the recorded series scenario
- [x] 11.3 Build the timeline with stop, warning, error and event markers, and verify moving the playhead updates map and charts without a new run
- [x] 11.4 Build the stop inspector showing snapshot, requested and applied actions, warnings, traces with block links, logs, records and errors, and verify the clamped action scenario
- [x] 11.5 Build the error list linking to timeline and editor line, and verify the error-to-source scenario

## 12. Batch comparison

- [x] 12.1 Build batch configuration with scenario, policies A and B, base seed and seed count, and verify the default batch scenario
- [x] 12.2 Run batches across the worker pool with downsampled series, and verify the same-seeds and different-core-counts scenarios
- [x] 12.3 Compute distribution statistics and paired-difference confidence intervals, and verify against a precomputed fixture and the identical-policies scenario
- [x] 12.4 Build lazy-loaded distribution and fan charts, and verify the metric summary scenario in Playwright
- [x] 12.5 Show failed runs per policy with links to open a seed in the run view, and verify the seed-with-errors and open-a-seed scenarios
- [x] 12.6 Verify the clear improvement scenario by comparing the example supply-to-demand policy with the baseline on `two-station` in an end-to-end test

## 13. Sharing and local saving

- [x] 13.1 Implement share state encoding in the fragment with version prefix and compression, and verify the link round trip scenario in Playwright across two browser contexts
- [x] 13.2 Load share links without running, and handle damaged links, other API versions and over-length links, and verify the no-automatic-execution, corrupt link, older API version and length warning scenarios
- [x] 13.3 Implement saving, listing, opening, renaming and deleting policies and scenarios, and debounced drafts, in IndexedDB, and verify the draft restored scenario
- [x] 13.4 Handle unavailable storage with a notice, and verify the private browsing scenario with storage disabled

## 14. Documentation

- [x] 14.1 Set up MDX pages under `/docs`, the in-app documentation panel, KaTeX, Shiki and the MiniSearch index, and verify the direct link and panel scenarios
- [x] 14.2 Render generated Policy API and `ops` reference pages from the API data, and verify the documentation check fails on an undocumented parameter
- [x] 14.3 Implement the runnable example checker with an "Open in editor" action, and verify the check fails on a broken example
- [x] 14.4 Implement the internal link and anchor checker against the built output, and verify it fails on a deliberately broken link
- [x] 14.5 Write Getting started, Language and sandbox rules, metric definitions and scenario format reference pages, and verify their runnable examples pass
- [x] 14.6 Write one failure-mode page per starter scenario and link each scenario to it, and verify the failure-mode-per-scenario scenario
- [x] 14.7 Write the game mechanics assumptions page with game version and evidence labels, and verify the evidence label scenario
- [x] 14.8 Write the About page with licence, non-affiliation statement and build version, and verify the notice appears on every documentation page and application view
- [x] 14.9 Wire links from diagnostics, hover help, traces, metrics and scenarios into the documentation, and verify the trace-to-block-page scenario and the search-for-a-block scenario

## 15. Static build and deployment

- [x] 15.1 Produce the static build with content-hashed assets, prerendered documentation pages and `404.html`, and verify it works from an unconfigured static file server in Playwright
- [x] 15.2 Verify the application makes no third-party requests during a run, batch and search by asserting on request origins in Playwright
- [x] 15.3 Verify runs and batches work without cross-origin isolation headers in Playwright
- [x] 15.4 Add the documentation check, build and Playwright determinism jobs to CI, and a deploy job to GitHub Pages on `main` gated on all jobs with a manual redeploy-by-ref trigger, and verify a pull request builds without deploying
- [x] 15.5 Write the S3 and CloudFront deployment guide, and verify it by deploying a root-base-path build to a test bucket or recording why this was deferred
- [x] 15.6 Resolve repository visibility or plan for GitHub Pages, enable Pages with the Actions source, and verify the first deployment is live at the Pages URL

## 16. Release check

- [x] 16.1 On the deployed site, run the full journey: first visit, edit, run, inspect, batch comparison against the baseline, share link opened in another browser, and documentation search, and record the result in the change notes
- [x] 16.2 Update `docs/roadmap.md` to mark the delivered parts of M0, M2 to M7 and the hosting part of M9, and verify `openspec validate playable-sandbox-mvp --strict` passes
