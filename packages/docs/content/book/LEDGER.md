# Concept ledger

Not published. Lists, per chapter, the terms, results, notation, and `ops` blocks and simulator features each chapter introduces and uses. Authors update a chapter's rows when they rewrite it.

## Uses before introduction

Audited against the second edition, 2026-11-09. "Forward pointer" marks a sentence that names a later chapter's term and defers to that chapter. No chapter relies on a later result in a proof.

- ch 1: Remark 1.13 cites Proposition 2.4 and Corollary 2.3 for results that hold under every policy (forward pointer).
- ch 4: "Chapter 6 does so" defers the stock on order, and Remark 4.16 defers the variation in demand to chapters 6 and 7 (forward pointers).
- ch 5: "chapter 6 reduces a problem with many periods to it" (forward pointer).
- ch 6: Example 6.11 names the safety stock, which chapter 7 defines (forward pointer).
- ch 8: Remark 8.17 names Winters' method and does not define it.

## Chapter 1: Modelling operations

Second edition, in the mathematical register, 2026-11-09.

**Statements**
- Definition 1.1 (Model) `def-model`
- Definition 1.2 (Feasible and optimal solutions) `def-feasible`
- Proposition 1.3 `prop-one-stop`
- Example 1.4 `ex-one-stop`
- Remark 1.5 `rem-proxy`
- Definition 1.6 (State equation) `def-state-equation`
- Lemma 1.7 (Conservation) `lem-conservation`
- Definition 1.8 (Policy) `def-policy`
- Assumption 1.9 (The line) `asm-line`
- Definition 1.10 (Cycle) `def-cycle`
- Proposition 1.11 (Capacity of the line) `prop-capacity`
- Example 1.12 `ex-capacity`
- Remark 1.13 `rem-every-policy`
- Definition 1.14 (Steady state) `def-steady-state`
- Proposition 1.15 (Load that meets demand) `prop-needed-load`
- Example 1.16 `ex-needed-load`
- Definition 1.17 (Drain-and-fill policy) `def-drain-fill`
- Definition 1.18 (Balancing policy) `def-balancing`
- Proposition 1.19 (Drain-and-fill meets demand) `prop-drain-fill`
- Proposition 1.20 (Capacity that balancing requires) `prop-balancing-capacity`
- Example 1.21 `ex-balancing-capacity`
- Proposition 1.22 (Steady state under balancing) `prop-balancing-steady`
- Example 1.23 `ex-balancing-steady`
- Corollary 1.24 `cor-capacity-factor`
- Example 1.25 `ex-half-capacity`

**Introduces besides**
- Terms: proxy objective, state, action, disturbance, lost demand, unmet demand, feedback policy, throughput of a cycle, capacity of the line, sensitivity, site, role, target, baseline, starter, scenario script, seed, stop inspector.
- Notation: a, a*, (y)^+, x_k, a_k, ξ_k, w_k, π, J_n(π), x̄, κ, τ, t₀, t₁, u, v, T(a), f(a), ā, x̄_min, a_B; m, d, c, s, s′, q local.
- ops and simulator: `ops.policy { classify, target }`, `ops.roles.manual` with `"supply"` and `"demand"`, `ops.drain`, `ops.fill`, `ops.balance`; built-in `balance-stock`; `two-station` starter; editing the scenario script (variability, distances, duration, `mars.large_station`); seeds; Metrics.

**Uses from earlier chapters**
- None. No replications, confidence intervals or batch comparisons. Forward references to Proposition 2.4 and Corollary 2.3 for results that hold under every policy.

## Chapter 2: Flows, rates and Little's law

Second edition, in the mathematical register, 2026-11-09.

**Statements**
- Definition 2.1 (Rates of flow) `def-flow-rates`
- Proposition 2.2 (Flow balance) `prop-flow-balance`
- Corollary 2.3 (Throughput of a line) `cor-throughput`
- Proposition 2.4 (Capacity bound) `prop-capacity-bound`
- Definition 2.5 (Utilisation) `def-utilisation`
- Corollary 2.6 `cor-overload`
- Example 2.7 `ex-utilisation`
- Remark 2.8 `rem-utilisation`
- Definition 2.9 (Averages of a system) `def-system-averages`
- Example 2.10 `ex-sample-path`
- Theorem 2.11 (Little's law, finite form) `thm-littles-law`
- Theorem 2.12 (Little's law) `thm-littles-law-limit`
- Remark 2.13 `rem-little`
- Definition 2.14 (Cover) `def-cover`
- Proposition 2.15 (Stock on a balanced line) `prop-balanced-line`
- Example 2.16 `ex-balanced-line`
- Example 2.17 (A line with a relay station) `ex-relay`
- Example 2.18 `ex-dead-stock`

**Introduces besides**
- Terms: place, throughput of a line, effective arrival rate, balanced line, relay station, dead stock, long-run averages table (Stock, In a day, Out a day, Stock ÷ out, Waited, the line's row).
- Notation: I(T), O(T), λ, λ_in, λ_out, D_n, H_n, ℓ_i, δ_i (local), ρ, a_i, d_i, W_i, N(t), A(t), L, L_T, λ_T, W, W_T, S.
- ops and simulator: the `"relay"` role, `ops.pass_through`; the `relay` starter; `speed` on `mars.train`; the extractor's `rate`; the long-run averages table.

**Uses from earlier chapters**
- ch 1: Assumption 1.9 (the line), Lemma 1.7, cycles, T(a), f(a), capacity, Proposition 1.15 (ā), Proposition 1.19 (drain-and-fill's steady state), Example 1.25 (balancing at ρ = 0.47), the two policies and their `ops` forms, scenario script edits, seeds.
- No replications, confidence intervals or batch comparisons.

## Chapter 3: Randomness and simulation

Second edition, in the mathematical register, 2026-11-09.

**Statements**
- Definition 3.1 (Poisson process) `def-poisson-process`
- Example 3.2 (Shortage between deliveries) `ex-shortage`
- Example 3.3 (Demand on the two-station line) `ex-line-demand`
- Definition 3.4 (Replications) `def-replication`
- Proposition 3.5 (Mean and variance of the sample mean) `prop-sample-mean`
- Corollary 3.6 `cor-root-n`
- Definition 3.7 (Confidence interval for a mean) `def-confidence-interval`
- Example 3.8 (A mean that is known) `ex-known-mean`
- Corollary 3.9 (Replications for a given half-width) `cor-replications`
- Example 3.10 (A mean that is not known) `ex-pilot`
- Proposition 3.11 (Estimating a probability) `prop-proportion`
- Example 3.12 `ex-proportion`
- Proposition 3.13 (Variance of a difference) `prop-difference`
- Definition 3.14 (Common random numbers) `def-crn`
- Corollary 3.15 `cor-crn`
- Example 3.16 (Production lost at the mine) `ex-crn`
- Remark 3.17 `rem-crn-negative`
- Remark 3.18 `rem-transient`

**Introduces besides**
- Terms: output of a run, sample mean, sample variance, unbiased estimator, standard error, half-width, pilot batch, paired differences, transient period, base seed, batch, Compare with policy B.
- Notation: A(t) as a count of demand, X, Y, μ_X, σ_X², n, X̄_n, S_n², t_(n−1, 0.975), z, δ, θ, ρ_XY, Z_i, D (total demand), U_j (local).
- ops and simulator: Batch (Seeds, Base seed, Compare with policy B, the B − A column); metrics Demand met, Unmet demand, Stalled production.
- Placeholder: `mars-poisson-consumer`.

**Uses from earlier chapters**
- ch 1: Assumption 1.9, the two policies, unmet demand, lost production, the `two-station` starter, seeds.
- ch 2: the relay line's finite-run averages (Remark on runs of finite length).
- Recalled without proof: the Poisson and normal distributions, the central limit theorem, Student's t.

## Chapter 4: Order quantities: EOQ and (s, S)

Second edition, in the mathematical register, 2026-11-09.

**Statements**
- Assumption 4.1 (The Shop) `asm-shop`
- Definition 4.2 (Plan and average cost) `def-plan`
- Lemma 4.3 (Orders at zero stock) `lem-zero-stock`
- Lemma 4.4 (Equal quantities) `lem-equal-quantities`
- Proposition 4.5 (Average cost of a fixed quantity) `prop-eoq-cost`
- Theorem 4.6 (Economic order quantity) `thm-eoq`
- Corollary 4.7 (Optimality among all plans) `cor-eoq-all-plans`
- Example 4.8 `ex-eoq-shop`
- Corollary 4.9 (Sensitivity) `cor-eoq-sensitivity`
- Example 4.10 `ex-eoq-sensitivity`
- Remark 4.11 `rem-eoq-time`
- Proposition 4.12 (Reorder point) `prop-reorder-point`
- Definition 4.13 (Periodic review and (s, S) policies) `def-s-s-policy`
- Proposition 4.14 `prop-periodic-review`
- Example 4.15 `ex-periodic-review`
- Remark 4.16 `rem-random-demand`
- Example 4.17 (The interval between trips) `ex-dispatch-interval`

**Introduces besides**
- Terms: order, supplier, order cost, holding cost, plan, average cost, cycle of a plan, economic order quantity, lead time, reorder point, periodic review, review period, reorder level, order-up-to level, (s, S) policy, template, reference policy.
- Notation: D (constant demand rate), K, h, n(T), x(t), Q, Q*, C(Q), x (multiple of Q*), L, r, R, s, S; q, y, q̄, T, F, T* local.
- ops and simulator: the `review` table of `ops.policy`; `ops.min_max { min, max }`; the `classic.reorder` template with steady demand and hourly reviews; scenario script `return classic.reorder {}`; the metric Total cost; order cost charged when an order is placed, holding cost each minute.
- Placeholder: `mars-dispatch-interval`.

**Uses from earlier chapters**
- ch 1: policy, target, thousandths of a unit, binding constraint, vehicle capacity κ.
- ch 2: Theorem 2.12 (Little's law) in Remark 4.11.
- No replications. Recalled without proof: Scarf's theorem on (s, S) policies (Remark 4.16).

## Chapter 5: One period under uncertainty: the newsvendor

Second edition, in the mathematical register, 2026-11-09.

**Statements**
- Assumption 5.1 (The newsvendor) `asm-newsvendor`
- Definition 5.2 (Expected cost) `def-newsvendor-cost`
- Lemma 5.3 (Overage and underage) `lem-overage-underage`
- Proposition 5.4 (Convexity) `prop-newsvendor-convex`
- Theorem 5.5 (Critical ratio, discrete demand) `thm-critical-ratio`
- Example 5.6 (A newspaper stand) `ex-stand`
- Theorem 5.7 (Critical ratio, continuous demand) `thm-critical-ratio-continuous`
- Example 5.8 `ex-uniform-demand`
- Definition 5.9 (Standard normal loss function) `def-loss-function`
- Lemma 5.10 `lem-loss-function`
- Proposition 5.11 (Normal demand) `prop-normal-demand`
- Example 5.12 `ex-normal-demand`
- Remark 5.13 (Salvage value) `rem-salvage`

**Introduces besides**
- Terms: newsvendor problem, expected shortfall, overage cost, underage cost, critical ratio, quantile of the demand, cost of uncertainty, salvage value, expired stock.
- Notation: D (random demand), F, Q, Q*, c, p, C(Q) (expected cost), c_o, c_u, Z, φ, Φ, G(z), μ, σ, z*; v local.
- ops and simulator: `ops.order_up_to { level }`; the `classic.newsvendor` template (discrete demand spread over the day, lost demand, stock that expires at the daily review, 30 days); `lost_cost`; the metric Expired stock.
- Placeholder: `normal-per-period-demand`.

**Uses from earlier chapters**
- ch 1: the identity (y)^+ − (−y)^+ = y of Lemma 1.7.
- ch 3: replications, Definition 3.7 (confidence interval), Batch.
- ch 4: order, review, supplier, template, reference policy, the `review` table.
- Recalled without proof: an expectation of convex functions is convex; the tail-integral formula for an expectation; the normal distribution.

## Chapter 6: Reviews, lead times and base-stock

Second edition, in the mathematical register, 2026-11-09.

**Statements**
- Assumption 6.1 (The Shop with a lead time) `asm-shop-lead-time`
- Definition 6.2 (Inventory level and inventory position) `def-inventory-position`
- Example 6.3 `ex-inventory-position`
- Lemma 6.4 (Level after a lead time) `lem-level-after-lead-time`
- Definition 6.5 (Base-stock policy) `def-base-stock`
- Proposition 6.6 (Level during a cycle) `prop-cycle-level`
- Definition 6.7 (Protection interval) `def-protection-interval`
- Example 6.8 `ex-protection-interval`
- Theorem 6.9 (Base-stock level) `thm-base-stock`
- Remark 6.10 `rem-base-stock-optimal`
- Example 6.11 `ex-base-stock-shop`
- Example 6.12 (Ordering on the stock on hand) `ex-on-hand`

**Introduces besides**
- Terms: backorder, backorder cost, stock on hand, stock on order, inventory level, inventory position, base-stock policy, base-stock level, order cycle, protection interval, cost rate, continuous review, double dispatch, lookahead.
- Notation: λ (Poisson demand rate), R, L, h, p (per unit per day backordered), IL(t), IP(t), D(t, t′], S, τ (time since an arrival), N_u, F_u, g_u(S), S_u, ḡ(S), S*, S_L, S_(R+L); m local.
- ops and simulator: `classic.reorder` parameters `random`, `demand`, `lead_time`, `order_cost`, `initial`, `duration`, `review_period`; `days()`, `hours()`; `ops` review targets compared with the inventory position; the template's exact expected cost for a finite run; plain Lua `on_review(ctx)` with `ctx.here.stock.Goods` and `ctx.order`; the `two-trains` starter; `ops.lookahead` in the `plan` stage.

**Uses from earlier chapters**
- ch 1: roles, `ops.roles.manual`, `ops.drain`, `ops.fill`, the balancing baseline, unmet demand.
- ch 3: Definition 3.1 (Poisson process), replications, confidence intervals, Definition 3.14 (common random numbers), Batch.
- ch 4: Assumption 4.1 (the Shop), review period, lead time, order-up-to level, `classic.reorder`.
- ch 5: Lemma 5.3, Theorem 5.5 (critical ratio), Proposition 5.11 in exercise 3.
- Recalled without proof: optimality of base-stock policies; the level S_(R+L) for costs charged at the end of each period (Remark 6.10).

## Chapter 7: Safety stock and service levels

Second edition, in the mathematical register, 2026-11-09.

**Statements**
- Assumption 7.1 (The Shop with a service target) `asm-shop-service`
- Definition 7.2 (Cycle service level and fill rate) `def-service`
- Proposition 7.3 (Cycle service level of a base-stock level) `prop-csl`
- Definition 7.4 (Safety stock) `def-safety-stock`
- Example 7.5 `ex-csl`
- Proposition 7.6 (Demand over a random interval) `prop-random-interval`
- Example 7.7 `ex-random-interval`
- Proposition 7.8 (Safety stock by the normal approximation) `prop-safety-stock-normal`
- Example 7.9 `ex-safety-stock`
- Proposition 7.10 (Fill rate of a base-stock level) `prop-fill-rate`
- Example 7.11 `ex-fill-rate`

**Introduces besides**
- Terms: service target, order cycle, cycle service level, fill rate, type-1 and type-2 service, safety stock, mixture of Poisson distributions, normal approximation, supply shock, demand shock.
- Notation: T = R + L (random), D_T, CSL(S), σ_T, z_α, α (service target), β(S); ℓ local.
- ops and simulator: the `classic.safety_stock` template (Poisson demand, backorders, weekly reviews, a lead time drawn for each order, 10 weeks); `lead_time = discrete { ... }`; `target_service`; the template rejects lead times that differ by a review period or more; metrics Backorders (average) and Backorders (peak); the `storm-shock` starter; `ops.min_max` as a train's target at a demand station.
- Placeholder: `service-level-metrics`.

**Uses from earlier chapters**
- ch 1: the two-station line, balancing, drain-and-fill, unmet demand.
- ch 3: Poisson process, Proposition 3.11 (estimating a probability), replications, Batch.
- ch 4: (s, S) target, review period.
- ch 5: Definition 5.9 and Proposition 5.11 (loss function, normal demand).
- ch 6: Assumption 6.1, Lemma 6.4, base-stock policy, protection interval, backorders, F_u.
- Recalled without proof: the law of total variance.

## Chapter 8: Forecasting

Second edition, in the mathematical register, 2026-11-09.

**Statements**
- Definition 8.1 (Demand models) `def-demand-models`
- Definition 8.2 (Forecast and forecast error) `def-forecast`
- Definition 8.3 (Moving average) `def-moving-average`
- Definition 8.4 (Exponential smoothing) `def-exponential-smoothing`
- Proposition 8.5 (Smoothing as a weighted average) `prop-smoothing-weights`
- Proposition 8.6 (Variance of a forecast) `prop-forecast-variance`
- Proposition 8.7 (Lag behind a trend) `prop-forecast-lag`
- Example 8.8 `ex-forecast-trade-off`
- Definition 8.9 (Holt's method) `def-holt`
- Proposition 8.10 (Holt's method follows a trend) `prop-holt`
- Example 8.11 `ex-holt`
- Definition 8.12 (Measures of forecast error) `def-error-measures`
- Example 8.13 `ex-error-measures`
- Proposition 8.14 (Shortfall of a lagging forecast) `prop-forecast-shortfall`
- Example 8.15 (The Shop with growing demand) `ex-forecast-shortfall`
- Remark 8.16 `rem-forecast-safety-stock`
- Remark 8.17 `rem-seasonality`

**Introduces besides**
- Terms: level model, trend model, forecast, forecast error, moving average, exponential smoothing, smoothing constant, mean age of the data, unbiased forecast, lag, Holt's method, bias, mean absolute deviation, root mean squared error, shortfall of a forecast, season.
- Notation: d_t, a, b, ε_t, σ², f_(t+1), e_(t+1), M, â_t, α (smoothing constant), γ, b̂_t, k, σ_e; n (periods in the protection interval), j local.
- ops and simulator: the `classic.forecasting` template (`level`, `trend`, `noise`, `safety`, `alpha`, `season_length`, `season_amplitude`; daily reviews, a 2-day lead time, backorders); plain Lua with `ctx.memory`, `ctx.record`, `here.backorders` and `here.on_order`.

**Uses from earlier chapters**
- ch 3: Poisson demand, Batch.
- ch 4: review, lead time, order-up-to level, template, reference policy.
- ch 6: inventory position, backorders, base-stock policy, protection interval, `on_review`, `ctx.order`.
- ch 7: safety stock, Proposition 7.8, z_α.
- Recalled without proof: convergence of Holt's method from inexact initial estimates (Axsäter, 2015, p. 15); Winters' method.

## Symbols with more than one meaning

The notation appendix states each of these in its opening paragraph or in the row for the symbol.

| Symbol | Meanings |
| --- | --- |
| L | ch 2 mean number present (Little's law); ch 4, 6, 7, 8 lead time |
| D | ch 3 total demand over a period (random); ch 4 constant demand rate; ch 5 random demand; ch 6 D(t, t′]; ch 7 D_T |
| S | ch 2 total stock on a line; ch 4 order-up-to level; ch 6, 7 base-stock level |
| a | ch 1 load; ch 2 a_i arrival time; ch 8 level of a demand model |
| T | ch 1 T(a) cycle duration; ch 2, 4 a horizon; ch 4 Example 4.17 interval between trips; ch 7 random protection interval |
| τ | ch 1, 2 leg time; ch 6 time since an order arrived |
| α | ch 7 service target; ch 8 smoothing constant |
| n | ch 1, 2 number of periods or round trips; ch 3 replications; ch 4 number of orders; ch 8 periods in the protection interval |
| λ | ch 2 rate of flow; ch 3, 6, 7 Poisson demand rate; ch 4 Example 4.17 production rate |
| σ | ch 3 σ_X of an output; ch 5 of a normal demand; ch 7 σ_T; ch 8 of ε_t, and σ_e |
| C(Q) | ch 4 average cost; ch 5 expected cost of one period |
| p | ch 5 cost per unit lost; ch 6 cost per unit per day backordered |
| z | ch 3 normal quantile 1.96; ch 5 z*; ch 7 z_α |
| F | ch 4 Example 4.17 cost of a trip; ch 5 distribution function of demand |
| x | ch 1 x_k stock and x̄ capacity; ch 4 x(t) stock, and x as a multiple of Q* |
