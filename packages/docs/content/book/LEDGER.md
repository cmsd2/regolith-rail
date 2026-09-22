# Concept ledger

Not published. Lists, per chapter, the terms, results, notation, and `ops` blocks and simulator features each chapter introduces and uses. Authors update a chapter's rows when they rewrite it.

## Uses before introduction

Line numbers match the chapter files at commit ba71068. Check labels render on the page, so the chapter 1 and 2 entries include them; other entries cite prose only. "Forward pointer" marks a sentence that names a later chapter's term and defers to that chapter.

- ch 3 line 180: "The two policies' empty running moves in opposite directions" uses empty running (ch 1 and 2 call it empty distance), never introduced.
- ch 3 line 189: "Chapter 6 compares two order-up-to levels" uses order-up-to level, introduced in ch 4 (forward pointer).
- ch 4 line 114: "chapter 6 works it out as the protection interval" uses protection interval, introduced in ch 6 (forward pointer).
- ch 4 lines 114 to 115: "it also carries safety stock, which chapter 7 sets" uses safety stock, introduced in ch 7 (forward pointer).
- ch 5 line 174: "A wasted unit now costs $c - s = 1$" uses s as the salvage value, never defined (s is the reorder point in ch 4).
- ch 5 line 187: "$100 + 20z$ with $z \approx 0.2533$" uses z, the standard normal quantile, never defined (the normal approximation arrives in ch 7).
- ch 5 line 217: "Chapter 6 returns to this as the protection interval" uses protection interval, introduced in ch 6 (forward pointer).
- ch 6 line 113: "works out its expected cost tick by tick" uses tick, the simulator's time step, never introduced.
- ch 6 line 205: "more than three times the empty running" uses empty running, never introduced.
- ch 7 line 84: "with $z_{0.95} \approx 1.645$" uses z_{0.95}, never defined.

## Chapter 1: Modelling operations

Rewritten 2026-09-22.

**Introduces**
- Terms: model, decision variable, parameter, constraint, objective, proxy objective, feasible, optimal, binding constraint, slack, state equation, state, action, disturbance, lost demand, unmet demand, policy, feedback (closed-loop) policy, steady state, feasibility check, sensitivity, site, role, target, drain-and-fill rule, balancing, baseline, starter, scenario script, seed, run, stop marker, stop inspector, stalled production, surplus.
- Results: one-stop solution a* = min(m, κ, x̄ − d); state equation x_{k+1} = (x_k + a_k − ξ_k)^+ and unmet w_k = (ξ_k − x_k − a_k)^+, with conservation; slowest round trip 28/3 h and capacity 540/7 a day; surplus 9 a day; balancing loads (m − d)/2; needed steady load ā = 2u(τ + t₀)/(1 − 2ut₁) = 250/19, T = 500/57 h; balancing's steady load a = (x̄ + u(τ + t₀))/(3 − ut₁) = 1450/119 ≈ 12.18, T = 1040/119 h, unmet 33/13 a day, stalls 150/13 a day; smallest station for balancing x̄_min = 2ā + u(τ + t₀ + t₁ā) = 625/19 ≈ 32.89.
- Notation: a (a load), m, d (stock at mine and dome, local), κ, x̄, x_k, a_k, ξ_k, w_k, (y)^+, π, J(π), τ, T, T_max, t₀, t₁ (stop times, local), u (dome's use an hour, local), ā, x̄_min.
- ops and simulator: `ops.policy { classify, target }`, `ops.roles.manual` with `"supply"` and `"demand"`, `ops.drain`, `ops.fill`, `ops.balance`; built-in `balance-stock`; `two-station` starter; the scenario script and editing it (variability, distances, duration, `mars.large_station`); seeds; the timeline's stop markers and the stop inspector; Metrics; `PolicyLink` to put a built-in policy in the run.

**Uses from earlier chapters**
- None (first chapter). No replications, confidence intervals or batch comparisons.

## Chapter 2: Flows, rates and Little's law

Rewritten 2026-09-22.

**Introduces**
- Terms: flow, rate in, rate out, flow balance, greatest flow a vehicle can carry, utilisation, Little's law, average number present, arrival rate, effective arrival rate, average time in a place, cover, balanced line (production equal to demand), sawtooth stock at a drained station, time aboard, dead stock, long-run averages table (Stock, In a day, Out a day, Stock ÷ out, Waited, the line's row with cargo).
- Results: (x(T) − x(0))/T = λ_in − λ_out, at most x̄/T in size; λ_max = 24κ/T_max = 540/7, ρ = 7/15; a four-unit sample path with L = 1.5, λ = 0.5, W = 3; the counting argument ∫N dt = ΣW_i and L = λW; on the balanced line, 30 units and 20 hours a unit, mine and train λT/2 = 125/19 each, dome 30 − λT = 320/19, and at speed 10, 65/19 each and 440/19; relay under roles ā = 4420/343, dome 30 − ā/2 = 8080/343, cover 16.63 h; relay readings (37.5 h and 45.3 h on the line, 9.7 h at the junction).
- Notation: λ, λ_in, λ_out, λ_max, ρ, L, W, N(t), A(T), W_i, T_max, L_mine, L_train, L_dome.
- ops and simulator: the `"relay"` role, `ops.pass_through`; the `relay` starter; `speed` on `mars.train`; the mine's extractor `rate`; Metrics' long-run averages table.

**Uses from earlier chapters**
- ch 1: state equation and its account, κ, x̄, τ, t₀, t₁, T, ā and the needed-load result, T_max, the drain-and-fill rule, balancing, roles, `ops.roles.manual`, `ops.drain`, `ops.fill`, `ops.balance`, scenario script edits, seeds, stalled production, unmet demand.
- No replications, confidence intervals or batch comparisons.

## Chapter 3: Randomness and simulation

**Introduces**
- Terms: random arrivals, Poisson process and distribution, exponential gaps between arrivals, replication, sample mean, standard error, sample standard deviation, 95% confidence interval, Student's t distribution, critical value, degrees of freedom, significance level, estimation by simulation (π example, not called Monte Carlo), paired comparison, common random numbers, correlation between two policies' results, seed, random stream, batch, repeatable run.
- Results: Poisson P(N = k) = e^(−m) m^k / k! with mean = variance = m = λt and standard deviation √m; P(no arrival in s) = e^(−λs), gaps exponential with mean 1/λ; SE(X̄) = σ/√n, so four times the runs halve it; t-interval X̄ ± t_{0.975,n−1} s/√n (t_{0.975,29} ≈ 2.045, t_{0.975,99} ≈ 1.984); Var(D) = σ_A² + σ_B² − 2ρσ_Aσ_B; worked: 7.9 ± 0.28, π with 400 000 points has SE ≈ 0.0026, standard deviation of a difference falls from 1.98 to 0.63 at ρ = 0.9; two-station balancing: unmet demand mean 28.0, SE 0.30, interval 27.4 to 28.6, stalls correlate at about 0.8, paired standard deviation 2.9 against 3.7; exercises: 400 runs halve a 100-run width, ρ = 0.75 needs a quarter of the runs, e^(−4) ≈ 0.0183.
- Notation: λ rate (ch 2: average flow); t time, and t_{0.975,n−1} critical value (ch 8: t_k trend); m = λt Poisson mean (ch 1: mine's stock); N count and k its value (ch 6: N demand over the protection interval; ch 8: N window, k day); s gap length and, from line 73, sample standard deviation (ch 4: reorder point); n number of runs; X̄ sample mean; σ standard deviation of one run's result (ch 7: of demand); SE; α = 0.05 (ch 8: smoothing constant); D = X_B − X_A (ch 4, 5, 7, 8: demand); ρ correlation; σ_A, σ_B.
- ops and simulator: seed and repeatable runs; Poisson arrivals drawn from the seed in whole units; **Batch** (one seed and a number of replications, one stream per replication derived from the seed and the replication's number); batch reports a mean and a median per metric; **Compare** (a second policy on the same streams, paired difference with a 95% interval); two-station demand rate redrawn every two hours; arrivals sampled in at least eight sub-steps a minute, variance lower by 1/2880 at 4 a day (the word "binomial" is not used); t table with conservative critical values; adding replications leaves earlier ones unchanged.

**Uses from earlier chapters**
- ch 1: two-station line, demand varying by 20%, balancing baseline `balance-stock`, drain-and-fill rule and its `ops` policy, unmet demand, stalled production, starter, run.
- Background (first-year statistics): mean, variance, standard deviation, median, correlation, independence, normal distribution.
- From later chapters or never introduced: empty running (never); order-up-to level (ch 4, forward pointer).
- Note: "cost" (lines 13, 60, 226) is a generic run result here; the worked example measures unmet demand, and cost metrics start in ch 4.

## Chapter 4: Order quantities: EOQ and (s, S)

**Introduces**
- Terms: order, supplier, lead time (zero in this chapter), review, review period (reviews on a schedule; "periodic review" is named in ch 6), fixed order cost, holding cost, order quantity, economic order quantity (EOQ), flat bottom (cost insensitive near Q*), reorder point, order-up-to level, (s, S) policy, template, reference policy.
- Results: C(Q) = KD/Q + hQ/2; Q* = √(2KD/h) and C(Q*) = √(2KDh); at Q* ordering and holding cost the same; C(xQ*)/C(Q*) = ½(x + 1/x), so 1.5 times costs 8.3% more and double or half costs 25% more; reorder point = demand expected before the next review, S = s + Q*; worked: Q* = 20, 20 a day, 25 at 10 or 40, 21.67 at 30, s = 417 and S = 20 417 thousandths; exercises: Q* = 20√2 when K doubles, square-root law (Q* doubles when D quadruples), 22.8 a day for 30 at a time in a 20-day run.
- Notation: D demand a day (ch 3: difference; ch 5: random period demand); K order cost; h holding cost a unit a day (same in ch 6); Q order quantity; C(Q) cost a day (ch 5: expected period cost); Q*; x multiple of Q*; s reorder point (ch 3: sample standard deviation; ch 5: salvage value); S order-up-to level (ch 6: base-stock level).
- ops and simulator: `review` table in `ops.policy`; `ops.order_up_to { level }`; `ops.min_max { min, max }`; `on_review` for plain Lua (named, linked to /docs/api/review); `classic.reorder` template with steady-demand defaults; scenario script `return classic.reorder {}`; order cost charged when an order is placed, holding cost each minute; Batch with three policies.

**Uses from earlier chapters**
- ch 1: policy, target, `ops.policy`, thousandths of a unit, station, unmet demand.
- ch 3: Batch, random demand.
- From later chapters or never introduced: protection interval (ch 6), safety stock (ch 7), both forward pointers.

## Chapter 5: One period under uncertainty: the newsvendor

**Introduces**
- Terms: single-period decision, newsvendor problem, unit cost, lost sale, expected shortfall, the one-more-unit (marginal) argument, critical ratio, underage cost, overage cost, expired stock, salvage.
- Results: C(Q) = cQ + p E[(D − Q)⁺]; C(Q + 1) − C(Q) = c − p P(D > Q); the best Q is the smallest with P(D ≤ Q) ≥ (p − c)/p; critical ratio c_u/(c_u + c_o) = (p − c)/p; worked: ratio 3/5, Q = 15, C(15) = 370/9 ≈ 41.11, 430/9 at 10 and 385/9 at 20 (lopsided cost); exercises: expected leftover 20/9, salvage of 1 gives ratio 3/4 and Q = 20, normal demand gives 105.07, lost cost 10 gives ratio 4/5, Q = 20 and 410/9.
- Notation: c unit cost; p lost-sale cost (ch 7: p_ℓ probability); D random demand in a period; Q order quantity; C(Q) expected cost (ch 4: cost a day); E[·] expectation; (x)⁺ = max(x, 0); c_u, c_o; s salvage value (ex 2, undefined); z (ex 3, undefined).
- ops and simulator: `classic.newsvendor` template (discrete demand spread over the day, lost demand, stock expiring at each daily review, supplier with no lead time, 30 days); `lost_cost` parameter; total cost metric; expired stock metric; 99% confidence interval over 400 replications.

**Uses from earlier chapters**
- ch 1: thousandths of a unit (restated at line 131).
- ch 3: replication, confidence interval (99% is new; ch 3 derives 95% and gives the general α form), Batch, Compare, expected cost.
- ch 4: order, review, supplier, lead time, order quantity, `ops.order_up_to`, `review` table, template, reference policy.
- Background: probability distribution, quantile, normal distribution.
- From later chapters or never introduced: salvage value s (never); z (never; the normal approximation arrives in ch 7); protection interval (ch 6, forward pointer).

## Chapter 6: Reviews, lead times and base-stock

**Introduces**
- Terms: stock on hand, stock on order, backorder, inventory position, periodic review, continuous review, protection interval, base-stock policy, base-stock level, critical fractile, backorder cost, the stock-on-hand mistake (ordering the same shortage again), double dispatch, lookahead (cargo reserved for stations further along).
- Results: position = on hand + on order − backorders; protection interval L + R; S* = min{S : P(N ≤ S) ≥ b/(b + h)}; worked: position 10, interval 9/4 days with mean 9, fractile 10/11, S* = 13, 7.97 a day; ordering from stock on hand repeats the shortage over 8 reviews; exercises: daily reviews give 17, b = 20 gives 14, a 1-day lead time gives 8 and 4.81 a day.
- Notation: R review period (same in ch 7); L lead time (ch 1: load; ch 2: average stock); S base-stock level and S*; b backorder cost a unit a day (ch 8: trend); N demand over the protection interval (ch 3: Poisson count; ch 8: window).
- ops and simulator: `classic.reorder` parameters `random`, `demand`, `lead_time`, `review_period`, `order_cost`, `duration`; **random** switch; `days()`, `hours()`; the template's analytic expected cost; plain Lua `on_review(ctx)` with `ctx.here.stock.Goods` and `ctx.order(resource, amount)`; `two-trains` starter; `ops.lookahead` in the `plan` stage; reviews a minute into each period; costs charged each minute.

**Uses from earlier chapters**
- ch 1: role, `ops.roles.manual`, `ops.drain`, `ops.fill`, balancing baseline, unmet demand.
- ch 2: stock chart, roles policy.
- ch 3: Poisson, replication, confidence interval, Batch, Compare, paired differences on the same streams.
- ch 4: review, lead time, supplier, order-up-to level, holding cost h, `ops.order_up_to`, `on_review`, `classic.reorder`, reference policy.
- ch 5: newsvendor problem, critical ratio (as critical fractile), lost sales, whole cost units.
- From later chapters or never introduced: tick (never); empty running (never).
- Note: line 112 says every `ops` target works from the inventory position; ch 1 line 80 and ch 4 line 42 compare the target with what the site or station holds.

## Chapter 7: Safety stock and service levels

**Introduces**
- Terms: service target, safety stock, cycle, cycle service level, fill rate, variable lead time, orders overtaking each other, normal approximation, supply shock, demand shock, state of the world, disruption as distinct from variability.
- Results: CSL(S) = Σ_ℓ p_ℓ P(Poisson(λ(R + ℓ)) ≤ S), valid when lead times differ by less than a review period; Var(D_T) = λE[T] + λ²Var(T); safety stock ≈ z_{0.95} σ; β ≈ 1 − E[(D_T − S)⁺]/(λR); worked: means 80, 100 and 90, S = 113 at 0.9546, safety stock 23, variance 190 and standard deviation 13.78, normal estimate 22.67, fixed lead time 106 and 15.60, fill rate 0.996 at 113; storm shock of 94 units against a 30-unit station; exercises: 121 for 0.99, 75 with reviews every 3.5 days.
- Notation: S order-up-to level; R review period; L lead time and ℓ a lead-time value (ch 8: ℓ_k level); p_ℓ its probability (ch 5: p lost-sale cost); λ demand rate; CSL(S); T random interval length (ch 1: round trip); D_T demand over T; E[T], Var(T); σ standard deviation of D_T (ch 3: of a run's result); z_{0.95} (undefined); β fill rate (ch 8: Holt trend constant).
- ops and simulator: `classic.safety_stock` template (Poisson demand, backorders, weekly reviews, lead time drawn per order, 10 weeks); `lead_time = discrete { ... }`; `target_service`; the template rejects lead times that differ by a review period or more; `storm-shock` starter; timeline bands for states of the world; `ops.min_max` as a train's target at a demand site; backorder metrics; no cycle service level metric.

**Uses from earlier chapters**
- ch 1: two-station line (as `storm-shock`), balancing, drain-and-fill `ops` policy, `ops.roles.manual`, `ops.drain`, `ops.fill`, unmet demand.
- ch 2: cover, roles policy (line 188 attributes it to ch 1, which calls it the drain-and-fill rule).
- ch 3: Poisson, sub-step arrivals (line 227 calls them binomial; ch 3 does not use the word), replication, 99% confidence interval, Batch.
- ch 4: periodic review, order-up-to level, `ops.order_up_to`, `ops.min_max`, template, reference policy.
- ch 5: (x)⁺, expectation, expected shortfall, lost sales.
- ch 6: base-stock level, backorder, inventory position, protection interval (ex 2), R, L, `days()`.
- From later chapters or never introduced: z_{0.95} (never).
- Note: line 218 points to Part III, which the book does not contain.

## Chapter 8: Forecasting

**Introduces**
- Terms: forecast, moving average, forecast lag, trend, season, exponential smoothing, smoothing constant, average age of the data, Holt's method (level and trend), forecast error, bias, mean absolute error, root mean squared error, demand inferred from the inventory position.
- Results: moving-average lag D_k − F_k = b(N + 1)/2; F_{k+1} = αD_k + (1 − α)F_k; weights α(1 − α)^j summing to 1; average age (1 − α)/α; moving average of the same age N = 2/α − 1; steady-trend lag D_{k+1} − F_{k+1} = b/α and D_k − F_{k+1} = b(1 − α)/α; Holt updates for ℓ_k and t_k with F_{k+1} = ℓ_k + t_k; bias, MAE, RMSE; cost of the lag 3b/α + 3b = 18; worked: 7-day average lags 4, α = 0.2 lags 5 and 4, Holt within 0.01 after 200 days, bias 0.4, MAE 1.6, RMSE 1.90; exercises: α = 0.5 lags 2 and needs 9, a 9-day average with b = 2 lags 10.
- Notation: D_k demand on day k; F_k forecast for day k; k day; N window length (ch 3: count; ch 6: protection-interval demand); j age in days; a, b intercept and trend (ch 6: b backorder cost); α smoothing constant (ch 3: significance level); ℓ_k level (ch 7: lead-time value); t_k trend estimate (ch 3: t critical value); β trend smoothing constant (ch 7: fill rate); e_k = D_k − F_k error.
- ops and simulator: `classic.forecasting` template (`level`, `trend`, `noise`, `safety`, `alpha`, `season_length`, `season_amplitude`; daily reviews, 2-day lead time, backorders); plain Lua with `ctx.memory`, `ctx.record` (charted series), `here.backorders`, and `here.on_order` entries with `resource` and `amount`.

**Uses from earlier chapters**
- ch 2: cover (three-day cover, `COVER`).
- ch 3: Poisson noise, Batch.
- ch 4: review, lead time, order-up-to level, `on_review`, template, reference policy.
- ch 5: known demand distribution, lost sales.
- ch 6: inventory position, backorders, protection interval (lead time plus one review, unnamed at line 113), `ctx.here.stock`, `ctx.order`.
- ch 7: safety stock.
- From later chapters or never introduced: none.

## Symbols with more than one meaning

| Symbol | Meanings |
| --- | --- |
| L | ch 2 average stock; ch 6, 7 lead time |
| T | ch 1 round trip in hours; ch 7 random interval length |
| t | ch 1 stop times t₀, t₁ (hours); ch 3 time and critical value t_{0.975,n−1}; ch 8 trend estimate t_k |
| s | ch 3 gap length and sample standard deviation; ch 4 reorder point; ch 5 salvage value (undefined) |
| S | ch 4, 7 order-up-to level; ch 6 base-stock level |
| m | ch 1 mine's stock; ch 3 Poisson mean λt |
| D | ch 3 difference X_B − X_A; ch 4 demand a day; ch 5 random period demand; ch 7 D_T demand over T; ch 8 D_k demand on day k |
| N | ch 3 Poisson count; ch 6 demand over the protection interval; ch 8 moving-average window |
| k | ch 3 Poisson value; ch 8 day index |
| λ | ch 2 average flow; ch 3, 7 arrival or demand rate |
| σ | ch 3 standard deviation of a run's result; ch 7 standard deviation of demand over T |
| α | ch 3 significance level 0.05; ch 8 smoothing constant |
| β | ch 7 fill rate; ch 8 Holt trend constant |
| b | ch 6 backorder cost; ch 8 trend a day |
| p | ch 5 lost-sale cost; ch 7 p_ℓ lead-time probability |
| ℓ | ch 7 lead-time value; ch 8 Holt level ℓ_k |
| C(Q) | ch 4 cost a day; ch 5 expected cost of the period |
| z | ch 5, 7 standard normal quantile, never defined |
