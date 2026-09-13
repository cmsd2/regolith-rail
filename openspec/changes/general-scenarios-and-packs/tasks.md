## 1. Planning documents

- [x] 1.1 Update `docs/roadmap.md`: add the principle of a general core with domain packs and Surviving Mars as the flagship, add stage M7a for this change before M8, allow networks of stock points in §9 while keeping Surviving Mars colonies to one line, move free vehicle routing to the research track, and point §8 techniques at their classic templates; verify every stage reference in the document still resolves
- [x] 1.2 Update the project context in `openspec/config.yaml` to describe the core model, packs and scenario scripts, and verify `openspec validate --specs --strict` still passes

## 2. Format 2 schema and upgrade

- [x] 2.1 Define the format 2 schema: stock points, arcs, vehicles with shuttle, loop and timetable routes, costs, and the existing events and information level; verify the minimal valid format 2 scenario, default capacity, unlimited capacity, disconnected route and timetable overlap tests pass
- [x] 2.2 Add converters, suppliers with fixed and discrete lead times and order limits, review schedules, expiring stock and per-consumer lost or backordered demand to the schema; verify the converter, external supplier, supplier cycle, weekly review and backorder validation tests pass
- [x] 2.3 Add the Poisson, discrete per-period, trace and profile processes to the schema; verify validation tests for each process, including an out-of-range profile error with its document path
- [x] 2.4 Implement the format 1 to format 2 upgrade at validation time, keeping station ids, flow order and train ids; verify all five starter scenarios upgrade and validate, and a property test shows that any valid format 1 document upgrades to a valid format 2 document
- [x] 2.5 Regenerate the published JSON Schema for format 2 with format 1 still accepted; verify every test scenario that passes validation also validates against the published schema

## 3. Engine on format 2 with unchanged format 1 results

- [x] 3.1 Switch the engine to run only format 2 documents, with stations and trains renamed to stock points and vehicles internally; verify the golden matrix passes unchanged in Node
- [x] 3.2 Generalise train movement to shuttle routes over arcs, then add loop and timetable routes; verify the golden matrix passes unchanged, plus the reversal, loop continuation, timetable departure and dwell tests
- [x] 3.3 Generalise the oscillation metric to one full round of the loading vehicle's route; verify the golden matrix passes unchanged and a loop oscillation test passes
- [ ] 3.4 Implement unlimited capacities and backordering consumers with backlogs served first; verify the backorders-served-first and unchanged lost-sales tests pass and backorder metrics are reported
- [ ] 3.5 Implement the discrete per-period, trace and profile processes and the binomial-substep Poisson process using integer arithmetic only; verify the determinism lint passes, the Poisson mean test passes over many sols, and the demand ramp test passes
- [ ] 3.6 Implement converters with starved and blocked time; verify the starved converter test and conservation for converter scenarios pass
- [ ] 3.7 Extend the fast-check scenario generators to format 2 features and the conservation invariant to deliveries, conversion, expiry and overflow; verify the property tests pass

## 4. Reviews, orders and costs

- [ ] 4.1 Add delivery and review events with the ordering eventCheck < delivery < review < tick < departure < arrival; verify the golden matrix passes unchanged
- [ ] 4.2 Implement external orders with lead times drawn from supplier streams, order size clamping with warnings, and overflow; verify the delivery-after-lead-time and clamped order tests pass
- [ ] 4.3 Implement stock point suppliers that ship what they hold and backlog the rest; verify the upstream shortage test passes
- [ ] 4.4 Implement expiring stock at reviews; verify the unsold stock expires test passes
- [ ] 4.5 Implement BigInt cost accounting for every cost component, skipped when no costs are stated; verify the holding cost test, a test for each other component, and that a 100-seed `two-station` batch takes no longer than before
- [ ] 4.6 Add backorder, expiry, overflow, converter and cost metrics to every run's output and to the metric definitions; verify metric tests, that hashing output without the new fields reproduces the recorded golden file, then regenerate the golden file and verify batch distributions include the new metrics

## 5. Policy API v2 and ops reviews

- [ ] 5.1 Add Policy API v2 to the single API description: `on_review`, the review context, `ctx.order`, `ctx.route`, `ctx.network` and backorders in station snapshots; verify generated types, annotations and editor data are regenerated and the staleness tests pass
- [ ] 5.2 Implement the review hook, order action and route context in the Lua runtime, with hook requirements checked at load; verify the order at review, missing review hook, missing stop hook and route-ahead-on-a-loop tests pass
- [ ] 5.3 Verify Policy API v1 compatibility by running `naive.lua` unchanged against the golden matrix in Node and in the browser determinism test
- [ ] 5.4 Add the `review` specification to `ops.policy` with inventory position from stock, orders on the way and backorders, and decision traces; verify the base-stock order and (s, S) hold-off tests pass
- [ ] 5.5 Compute mod-ready status from the loaded policy's hooks and the evaluated scenario in the worker; verify tests for a mod-ready Mars pairing and for pairings blocked by a review hook, converters and suppliers

## 6. Scenario scripts

- [ ] 6.1 Create the `scenario-kit` package with a TypeScript description of every construct and parameter and generation of editor data, annotations and embedded Lua sources; verify the generated files and staleness tests pass
- [ ] 6.2 Implement the scenario evaluator in the Lua runtime with the policy checker, budget, sandbox without randomness, fixed iteration order and JSON output; verify the script-evaluates-to-a-document, randomness-at-authoring-time, repeat evaluation and runaway script tests pass
- [ ] 6.3 Implement caller line capture and the document path to line source map, with validation errors mapped to the longest path prefix; verify the invalid parameter and unknown station tests report the right lines
- [ ] 6.4 Implement unit helpers with exact conversion and nearest-value errors, and evaluation size limits; verify the durations-with-units, unrepresentable quantity and size limit tests pass
- [ ] 6.5 Write the core construct library for every format 2 part, with defaults and modifiable results, and a test that its constructs and parameters match the description; verify the defaults-applied and modifying-a-construct's-result tests pass
- [ ] 6.6 Add script and template support to the command-line runner; verify the template run and invalid script tests pass

## 7. Mars pack

- [ ] 7.1 Write the `mars` library with line, small and large station, train, extractor, farm, factory, dome and dust storm constructs and their descriptions; verify the line-in-game-terms, station sizes, overriding a building rate and dust storm tests pass
- [ ] 7.2 Record the Mars building defaults on the game mechanics page with evidence levels; verify the documentation check passes
- [ ] 7.3 Rewrite the five starter scenarios as Mars scripts; verify each evaluates to a document whose golden hashes equal the recorded ones in Node and in browsers, and the starter failure tests still pass

## 8. Classic problems pack

- [ ] 8.1 Write the `classic.newsvendor` template, its reference policy and analytic reference; verify the template-with-defaults test and the newsvendor optimum test over 400 seeds pass
- [ ] 8.2 Write the `classic.reorder` template for deterministic and random demand with lead times and costs, its reference policies and analytic references; verify the economic order quantity test and a base-stock expected cost test pass
- [ ] 8.3 Write the `classic.serial_chain` template and its reference policy; verify the template-with-parameters test, conservation, and that order variance grows upstream under a moving-average order-up-to policy
- [ ] 8.4 Write the `classic.fixed_route_delivery` template and its reference policy; verify it validates, runs with its reference policy without errors, and matches a hand-computed short trace

## 9. Workbench

- [ ] 9.1 Store scenarios as script or JSON source with the evaluated document and source map, evaluated in the worker; verify store tests for script edits, JSON edits and evaluation errors disabling Run
- [ ] 9.2 Add the script editor mode with Lua highlighting, subset diagnostics, construct completion and hover, a read-only evaluated view, and conversion from JSON; verify the hover help for a construct and evaluated document scenarios in Playwright
- [ ] 9.3 Add the pack and template picker with parameter forms that write one-line template scripts, a Classic problems group and documentation links; verify the template parameters and template-links-to-its-page scenarios in Playwright
- [ ] 9.4 Move the map to projected coordinates with the line, loop, layered and circular layouts, backorders and shipments in transit; verify the Mars line looks unchanged against a screenshot and the loop-drawn-as-a-network scenario passes
- [ ] 9.5 Add review markers and the review inspector to the timeline; verify the inspect-a-review scenario in Playwright
- [ ] 9.6 Show mod-ready status and its reason in the workbench; verify the classic-template-is-not-mod-ready scenario in Playwright
- [ ] 9.7 Carry scenario kind and source in share links, saves and drafts, with older links upgraded; verify the script round trip, script saved and link-from-the-first-release scenarios in Playwright

## 10. Documentation

- [ ] 10.1 Generate the scenario construct reference for the core, Mars and classic libraries and extend the completeness check to constructs; verify the check fails on an undocumented construct parameter
- [ ] 10.2 Write the Writing scenario scripts guide with runnable examples; verify the documentation check runs its examples
- [ ] 10.3 Write a page per classic template with the problem, assumptions, reference result and policy, differences from the textbook setting and references; verify the page-per-classic-template scenario
- [ ] 10.4 Update the scenario format reference for format 2 and the metrics page for the new metrics, including the Poisson approximation; verify the link and anchor check passes

## 11. Release

- [ ] 11.1 Run the full check, documentation check, determinism tests and end-to-end tests in CI on a pull request; verify every job passes and golden hashes are unchanged
- [ ] 11.2 On the deployed site, run a Mars starter, a classic template with its reference policy, a script edit, and share a script link to another browser; record the result in the change notes
