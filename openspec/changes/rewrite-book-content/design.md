## Context

- **The book today.** Eight chapters in two parts under `packages/docs/content/book/`, about 15,000 words. Each
  follows the chapter standard: fixed second-level headings, one `GameNote`, a `Scenario` action, runnable
  `ops` examples, exercises with `Answer` blocks, and a `Check` after each displayed formula, numeric claim and
  answer. Checks are Maxima cells in `<slug>.checks.macnb`, Python in `<slug>.checks.py`, or simulator tests
  in `packages/lua-runtime/src/book.test.ts`.
- **What the simulator offers.** The `mars` pack (starters `two-station`, `relay`, `two-trains`,
  `storm-shock`, `mixed-line`; consumers with uniform or burst variability, no Poisson), and the `classic`
  pack (`newsvendor`, `reorder`, `safety_stock`, `forecasting`, `serial_chain`, `fixed_route_delivery`). The
  core format also has Poisson flows, traces and timetable routes, which the `mars` pack does not expose.
  `ops` has `roles.manual`, `drain`, `fill`, `balance`, `pass_through`, `order_up_to`, `min_max`,
  `lookahead`, `priority`, `proportional` and `inventory_position`.
- **Sources in the library** (acm-index, collection `maths`): Eiselt and Sandblom (2022), Taha (2017),
  Axsäter (2015), Snyder and Shen (2019), Simchi-Levi, Chen and Bramel (*The logic of logistics*), Brémaud
  (*Markov chains, Gibbs fields, Monte Carlo simulation and queues*), and Hernández-Lerma et al. (*An
  introduction to optimal control theory*). Open University modules may inform examples, and are not cited.

See proposal.md for what is wrong with the current text.

## Goals / Non-Goals

**Goals:**
- A method that produces each chapter the same way, so quality does not depend on which chapter is written
  first or last.
- Examples that match how the sources teach each topic, reworked into scenarios the reader can run.
- A book whose difficulty climbs: within a subsection, a chapter, a part and the whole.
- Prose a reader would take for a careful human author's.

**Non-Goals:**
- Changing chapter titles, order, slugs or the chapter standard's headings.
- Writing Parts III to V.
- Extending the engine, the packs or `ops`. Gaps become placeholders (decision 6).
- Teaching undergraduate probability and statistics. The book recalls what it uses.

## Decisions

### 1. One pipeline per chapter, one pull request per chapter

Each chapter goes through the same seven steps, in order. A step's output is reviewed before the next begins.

1. **Source notes.** Read the sections listed for the chapter in the per-chapter plan below. Record, in the
   chapter's pull request description, the printed page numbers of each result used, the order in which the
   source builds the topic, and the source's own examples, so the rewrite can avoid copying them. The page
   ranges below are PDF pages from acm-index and must be converted to printed pages.
2. **Outline.** Write the chapter's skeleton: the fixed headings, one line per subsection naming the single
   idea it adds, the running example's parameters, the displayed results, the policies to compare, and the
   exercises. Check the outline against the concept ledger (decision 2).
3. **Mathematics.** Derive every displayed result in the chapter's Maxima notebook before writing prose
   around it. Numeric results for the running example come from the notebook.
4. **Simulation.** Write the scenario variants and policies, and the `book.test.ts` cases that verify each
   prediction. A prediction the simulator cannot test becomes a placeholder.
5. **Prose.** Write the chapter against the outline.
6. **Style pass.** Run the prose lint (decision 7), then read the chapter aloud against the style guide.
7. **Progression review.** Read the chapter straight after the previous one. Every term used is either in
   the ledger from an earlier chapter or defined here, and no subsection is harder than the one after it
   without reason.

*Alternative:* rewrite all eight chapters in one change. Rejected: the first chapter written sets patterns
that the later ones would copy before anyone has reviewed them.

### 2. Progression: a concept ledger and three rules

A ledger in `packages/docs/content/book/LEDGER.md` (not published) lists, per chapter, the terms, results,
notation and `ops` blocks it introduces and the ones it uses from earlier chapters. Step 2 of the pipeline adds
the chapter's rows. It replaces reading the whole book to answer "has this been defined yet?".

Three rules follow from it.

- **Within a subsection:** state the setting and assumptions, derive, name the result, then give worked
  numbers. Numbers never come before the relation that produces them.
- **Within a chapter:** subsections move from deterministic to random, and from one station to a line or
  network. The first run in the simulator section matches the chapter's first model exactly (for example
  with variability switched off), and later runs relax one assumption at a time.
- **Across the book:**
  - Chapters 1 and 2 describe single runs, or deterministic runs whose outcome does not depend on the seed.
    Replications, averages over seeds, confidence intervals and batch comparisons first appear in
    chapter 3.
  - Chapter 1 introduces only the `ops` blocks its two policies use. Other blocks appear in the chapter that
    first needs them.
  - Each Part II chapter reuses the Shop's parameters from the chapter before and changes one thing.

### 3. Running examples

Three examples recur so that the reader sees one system gain structure.

| Example | Base parameters | Chapters |
| --- | --- | --- |
| The two-station line | Mine 45 a day, Dome 36 a day, 30-unit stations, one train, 4-hour legs | 1, 2, 3, 6 (side note and exercise), 7 (storm shock) |
| The relay line | Mine, empty junction, Dome 34 a day, 2-hour legs | 2 |
| The Shop | Demand 10 a day, holding 1 a unit a day; order cost 20 in chapter 4, backorder 10 a unit a day in chapter 6 | 4, 6, 7, 8 |

The Shop's parameters in chapter 4 are the `classic.reorder` defaults. Each later chapter states its changes
as a numbered assumption with a table of values. Chapter 6 makes the demand Poisson, reviews hourly, adds a
lead time of 1 day and a backorder cost, and drops the order cost. Chapter 7 reviews weekly, draws a lead
time of 1 or 3 days, and replaces the backorder cost with a service target. Chapter 8 sets
`classic.forecasting { level = 10 }`, so that demand grows from the Shop's 10 a day. The newsvendor stand in
chapter 5 stands alone, since a single period cannot carry over.

### 4. Predict, then run

Every "In the simulator" section follows one pattern.

1. Name the scenario and what differs from the model.
2. State the prediction from the model section, with its check.
3. Run the first policy or setting. Say what to look at and where.
4. Change one thing and run the second.
5. Show a table of predicted and simulated values. From chapter 3 on, simulated values carry a 95% interval
   from a batch, and the prose says whether the prediction falls inside it.

Decision 10 keeps this pattern and shortens the section: the simulator grounds the model and does not carry
the argument.

A new `Predicted` MDX component wraps that table, written as a Markdown table with a quantity column, a
model column and a simulation column, and a check inside it citing what verifies the numbers. Checks run in
Maxima, Python and vitest, outside the build, so the table states the values and the checks verify them, as
everywhere else in the book. The lint fails on a `Predicted` with no check inside. The table keeps the prose
from repeating simulator output in sentences. Prose describes what the numbers mean, and states a simulated figure only when
the argument depends on it.

### 5. Grouped checks

A derivation that displays several formulas may end with one `Check` citing several cells in a `refs`
attribute, one reference to a line (test titles contain spaces, so lines separate them). A grouped check
citing n references covers the last n formulas before it that no other check covers, and a heading ends the
wait. Checks render as
a small marker at the end of the block, and open on demand as they do now. Numeric claims in prose still need
a check before the next heading.

*Alternative:* a check per formula, as now. Rejected: it interrupts a derivation after every line.

### 6. Placeholders for missing simulator capabilities

When an example needs something the simulator cannot do, the chapter keeps the example.

- The model section derives the result and checks it as usual.
- The simulator section shows `<Placeholder needs="<capability-id>">`, set apart like a side note. It says
  what the run would show, the prediction it would test, and the capability it waits for, with a link to
  that capability's roadmap entry.
- A `PLACEHOLDERS` registry in `packages/docs/src` lists each capability id, a one-line description and its
  roadmap anchor. The docs check fails on an unknown id and prints the open placeholders with their
  chapters, so a later simulator change can find what it unblocks.
- A chapter still needs at least one runnable comparison that works today. A placeholder can only replace
  an additional example.

### 7. Style guide and prose lint

`packages/docs/content/book/STYLE.md` (not published) holds the rules, and a lint in `docs:check` enforces
the mechanical ones.

**Tone.** Neutral and technical. Explain how a result arises and when it holds. Let the reader draw the
conclusion. A paragraph ends when its point is made, without a summarising line. Decision 10 makes the
register that of a mathematics text.

**Linted** (errors in Book pages, outside code and maths):
- em dashes;
- tailing negations, matched as `, not ` or `; not ` after a clause, and `not just`, `not only … but`;
- the words and phrases *sharp*, *grounded*, *load-bearing*, *crucial*, *key insight*, *worth noting*,
  *worth stating*, *it turns out*, *in other words*, *in short*, *the whole difference*, *simply put*;
- signposting openers: *Let's*, *Here's*, *In conclusion*, *Furthermore*, *Moreover*, *Additionally*.

**Reviewed by reading** (the lint cannot catch these reliably):
- aphoristic closers ("Balancing pays for its generality.");
- verdicts stronger than the evidence ("that knowledge is the whole difference between meeting demand and
  not");
- simulator output narrated as a finding in place of a model's prediction;
- lists of three adjectives or verbs;
- passive voice where an agent is known.

The style pass rewrites every flagged sentence. Examples from the current text and the direction of the fix:

| Current | Rewrite |
| --- | --- |
| That is a fact about the line, not a failure of the rule. | No policy can move the surplus, since the dome uses less than the mine makes. |
| The train has the capacity; the rule only ever uses about half of the gap it sees. | (Delete. The derivation above it already shows the factor of one half.) |
| Balancing pays for its generality. | Balancing needs no knowledge of which station supplies and which demands, and on this line that knowledge is what the drain-and-fill rule uses. |
| That has a consequence worth stating: | (Delete, and state the consequence.) |
| Little's law is only an identity, and it says nothing about whether a policy is good. | Little's law holds for any policy, so it cannot rank policies. It converts a stock level into a time. |

### 8. Notation

An appendix to the book, `book/notation`, listed on the contents page after the parts, lists every symbol with its meaning, units and the chapter that introduces
it. Symbols stay fixed across chapters: $D$ or $\lambda$ for a demand rate, $h$ holding cost, $K$ fixed order
cost, $p$ shortage cost, $c$ unit cost, $L$ lead time, $R$ review period, $Q$ order quantity, $s$ and $S$
reorder and order-up-to levels, $\sigma$ a standard deviation, $\phi$ and $\Phi$ the standard normal density
and distribution, and $G(z)$ the standard normal loss function. Little's law keeps its own $L$, and the chapter
says so where the two meet.

### 9. Citations

Harvard style with printed page numbers, as now. Each chapter cites the sources its examples follow. Open
University modules are not cited. Where a chapter recalls a standard statistical result it states it without
citation.

### 10. A mathematical register, with numbered statements

Added 2026-11-09, after the first rewrite of chapters 1 and 2 was reviewed. The book reads as a mathematics
text. This decision replaces the tone of decision 7 and narrows decision 4.

- **Register.** Neutral, declarative and impersonal, as in a scientific paper. No second person outside
  the fixed heading "What you will learn". Instructions in the simulator section and in exercises use the
  imperative.
- **Statements.** The model section is built from numbered statements: `Definition`, `Assumption`,
  `Lemma`, `Proposition`, `Theorem`, `Corollary`, `WorkedExample` (labelled Example) and `Remark`, with
  `Proof` after a result. Each has an `id`. The build numbers them in one sequence per chapter, and
  `<Ref to="id" />` cites one by kind and number with a link, within a chapter or across chapters. The
  documentation check fails on a statement without an id, a repeated id, an id that a heading uses, and a
  reference that names no statement.
- **Proofs.** A result is proved when the proof shows why it holds or exercises a technique the reader
  reuses. A result whose proof is long or needs tools beyond the prerequisites is stated with a citation,
  or with a sketch marked as one.
- **Computations.** Each result is followed by a worked example on the chapter's running example, with the
  substitution shown.
- **Checks.** A statement and its proof count as part of the text around them, so one grouped check after a
  proof covers the formulas in both. Each displayed formula has its own check cell.
- **The simulator section** grounds the model and stays short: the scenario, the policies as code, what to
  run, and a `Predicted` table. Library vocabulary stays out of the model section. New simulation work is
  kept to what a chapter's claims need.

*Alternative:* statements written as bold run-in text with numbers typed by hand. Rejected: inserting a
statement would renumber every later reference by hand.

#### Statements in Part II

As written, 2026-11-09.

| Chapter | Proved | Stated with a citation |
| --- | --- | --- |
| 4 Order quantities | That an optimal plan orders at zero stock, by an exchange argument, and in equal quantities; the average cost of a fixed quantity; the EOQ and its cost by completing the square, with the first-order condition noted; optimality among all plans; the sensitivity ratio; the reorder point with a lead time; a cost bound for an $(s, S)$ policy under periodic review | Optimality of $(s, S)$ policies with a fixed order cost and random demand |
| 5 Newsvendor | The overage and underage form of the cost; convexity; the critical ratio, by marginal analysis for discrete demand and by the derivative for continuous demand; the loss-function identity; the optimal order and the cost $c\,\mu + p\,\sigma\,\phi(z^*)$ under normal demand | |
| 6 Base-stock | The inventory level after a lead time as the position less the demand in between; the level during a cycle; the base-stock level as a critical-ratio quantile of the cycle-average cost, bounded by the quantiles over $L$ and over $R + L$; the over-ordering of a rule that uses stock on hand, as an example | Optimality of base-stock policies without a fixed cost; the level $S_{R+L}$ when costs are charged at the end of each period |
| 7 Safety stock | The cycle service level under a random lead time; the variance of demand over a random interval, by conditioning; the safety stock under the normal approximation; the fill rate | |
| 8 Forecasting | Smoothing as a weighted average, with its mean age; the variance of a moving average and of exponential smoothing under a constant mean; the lag of each under a linear trend; that Holt's method keeps exact estimates exact; the shortfall of a lagging forecast over the protection interval | Convergence of Holt's method from inexact initial estimates; Winters' method |

## Per-chapter plan

Each chapter lists its sources, the subsections of its model section in order, the displayed results, the
simulator comparisons and any placeholders. Formulas are given as they will appear.

### Chapter 1: Modelling operations

*Written in the mathematical register of decision 10. `LEDGER.md` lists its numbered statements, which
supersede the outline below.*

**Sources.** Eiselt and Sandblom (2022), ch. 1: the phases of a study (feasibility, optimality, sensitivity,
implementability), parameters against variables, proxy objectives (PDF pp. 18–25). Taha (2017), ch. 1:
abstraction and the elements of a model (PDF pp. 33–42). Hernández-Lerma et al., Example 1.1: a
production-inventory system written as a state equation.

**Model section, in order.**
1. *One decision.* A train at the mine, once: choose a load $x$ subject to $0 \le x \le \min(m, C)$ and the
   dome's room. Decision variable, parameters, constraints, objective, on a case small enough to solve by eye.
2. *Repeated decisions.* The line as a dynamic system. Station stock follows a state equation, and a policy
   maps the observed state to an action:
   $$ s_{k+1} = s_k + \text{produced}_k - \text{consumed}_k - \text{loaded}_k + \text{unloaded}_k, \qquad a_k = \pi(x_k). $$
   The objective is a property of the policy: $J(\pi) = $ unmet demand over the horizon.
3. *Feasibility.* The train's greatest daily flow against the dome's use: $30 \times 18/7 = 540/7 > 36$.
   Chapter 2 generalises this bound, so chapter 1 states it for this line only.
4. *Two policies.* Drain the mine and fill the dome, against balancing. Balancing's move is
   $(m - d)/2$. The steady cycle solves $L = 36T/86\,400$ and $T = 28\,800 + 2(600 + 60L)$, giving
   $L = 250/19$ and a required gap $2L = 500/19 \approx 26.3$ units.
5. *Sensitivity.* How the required gap moves with demand, speed and station size, as a formula in those
   parameters. This is where the current exercises' results belong in general form.

**Simulator.** `two-station` with variability off (a scenario script setting `variability = 0`), running
both policies: the drain-and-fill rule meets demand, balancing settles near the predicted gap and falls
short. Then variability back on, one seed, both policies. No replications. The `ops` text covers
`roles.manual`, `drain`, `fill` and `balance` only.

**Case study.** Half capacity, rewritten around the fixed point and the sensitivity formula.

**Placeholders.** None.

### Chapter 2: Flows, rates and Little's law

*Written in the mathematical register of decision 10. `LEDGER.md` lists its numbered statements, which
supersede the outline below.*

**Sources.** Little (1961). Eiselt and Sandblom (2022), ch. 15, Little's formula in waiting-line models (PDF
pp. 464–468). Brémaud, the section on Little's formula. Taha (2017), queueing chapter (pp. 667–668, already
cited).

**Model section, in order.**
1. *Flow balance.* Rates in and out, and the long-run statement that they balance at any station whose stock
   stays bounded.
2. *Capacity and utilisation.* A vehicle's greatest flow $\mu = C/T_{\min}$ and utilisation
   $\rho = \lambda/\mu$. On a line with several legs, the smallest $\mu$ bounds throughput:
   $\text{throughput} \le \min(\lambda, \mu)$.
3. *Little's law.* Statement, then the sample-path argument from the area under the count of units present:
   $$ \frac{1}{T}\int_0^T N(t)\,dt = \frac{A(T)}{T} \cdot \frac{1}{A(T)}\sum_{i=1}^{A(T)} W_i \quad\Longrightarrow\quad L = \lambda W. $$
   With a figure of $N(t)$ as a staircase whose area counts unit-hours.
4. *Reading stock as time.* Cover at a consumer ($W = L/\lambda$), stock in transit on a leg
   ($L = \lambda \tau$), and stock at a station that neither makes nor uses anything.

**Simulator.**
- `two-station` at speed 5 and speed 10, one policy: stock in transit halves with the leg time, as
  $L = \lambda\tau$ predicts.
- `relay` under balancing and under roles, one seed: the junction's stock and the per-unit waits from the
  long-run averages table, with $\lambda W$ against $L$ at the dome.

**Case study.** Dead stock at the relay, kept, rewritten to predict the junction's level (the mean of the
station stocks) before showing it.

**Placeholders.** None. The long-run averages table reports the average cargo aboard vehicles but not a
measured time aboard, so the in-transit comparison uses measured cargo ($L$) and delivered flow ($\lambda$)
against the scenario's trip time ($W$). The direct measurement of $W$ stays at the dome, where the table has it.

### Chapter 3: Randomness and simulation

*Written in the mathematical register of decision 10. `LEDGER.md` lists its numbered statements, which
supersede the outline below.*

**Sources.** Taha (2017), ch. 19: Monte Carlo, the elements of discrete-event simulation, and gathering
observations (PDF pp. 709–735). Brémaud, the Monte Carlo chapter, for the estimator and its variance.
Standard results on the sample mean and the t-interval are recalled without citation.

**Model section, in order.**
1. *Poisson arrivals.* $P(N_t = k) = e^{-\lambda t}(\lambda t)^k/k!$, with mean and variance $\lambda t$.
   The chance that a dome holding $s$ units runs out during a round trip $T$ is $P(N_T > s)$.
2. *Estimating a probability.* $\hat p$ from $n$ replications, standard error $\sqrt{p(1-p)/n}$. A worked
   case whose exact answer is known, so the reader sees the estimate land within its interval.
3. *Estimating a mean.* The t-interval recalled, $\bar X \pm t_{n-1,\,0.975}\, s/\sqrt n$, and the number of
   replications for a half-width $h$: $n \approx (t\,s/h)^2$.
4. *Comparing two policies.* For paired replications on common random numbers,
   $$ \operatorname{Var}(\bar X - \bar Y) = \frac{\sigma_X^2 + \sigma_Y^2 - 2\rho\,\sigma_X\sigma_Y}{n}. $$
5. *What a run's length does.* The starting state biases averages over short runs. A brief warm-up
   discussion, linking back to chapter 2's finite-run note.

**Simulator.**
- `two-station`, balancing, unmet demand with 10, 40 and 160 replications: the interval's half-width halves
  with each fourfold increase.
- Drain-and-fill against balancing, paired against independent seeds: the paired interval is narrower, by
  the measured correlation.

**Placeholders.** `mars-poisson-consumer`: the `mars` pack's consumers cannot draw Poisson demand, so the run
for subsection 1 waits. A core-format scenario script is an acceptable substitute if step 4 finds it readable
enough.

The batch view always runs both policies on the same seeds. For the independent comparison, the reader runs
each policy as its own batch with a different base seed, and combines the two means and standard deviations
with the unpaired formula, $\operatorname{Var}(\bar X - \bar Y) = (\sigma_X^2 + \sigma_Y^2)/n$. No
simulator change is needed.

### Chapter 4: Order quantities: the EOQ and (s, S)

*Written in the mathematical register of decision 10. `LEDGER.md` lists its numbered statements, which
supersede the outline below.*

**Sources.** Snyder and Shen (2019), §3.2: problem, cost function, optimum, sensitivity and lead times
(chapter 3 PDF pp. 9–18). Axsäter (2015), §4.1 (PDF pp. 54–57 onwards). Taha (2017), §13.3. Eiselt and
Sandblom (2022), §§12.2–12.3. Simchi-Levi, Chen and Bramel, §§9.4–9.5 for the optimality of $(s, S)$, stated
without proof.

**Model section, in order.**
1. *The sawtooth.* Order $Q$ when stock reaches zero: cycle $Q/D$, average stock $Q/2$, and by chapter 2's
   law a unit waits $Q/(2D)$ on average.
2. *The EOQ.* $C(Q) = KD/Q + hQ/2$, $C'(Q) = 0$ gives $Q^* = \sqrt{2KD/h}$ and $C^* = \sqrt{2KDh}$, with the
   two cost terms equal at the optimum. For the Shop, $Q^* = 20$ and $C^* = 20$ a day.
3. *Sensitivity.* $C(Q)/C^* = \tfrac12\left(Q/Q^* + Q^*/Q\right)$, so ordering 10 or 40 costs 25 a day,
   25% more.
4. *Lead time.* The reorder point $r = DL$, the demand during the lead time, which chapter 2 also reads as
   the stock in the supplier's pipeline.
5. *Random demand.* With Poisson demand the $(s, S)$ form survives. The chapter states that an $(s, S)$
   policy is optimal under fixed order costs, and sets $S - s \approx Q^*$ as a heuristic.

**Simulator.** The Shop, deterministic, with `min_max` at $Q = 10$, 20 and 40: costs 25, 20 and 25 a day.
Then Poisson demand with the same three settings, as a batch: the ordering of costs holds and the flat
bottom widens.

**Placeholders.** `mars-dispatch-interval`: the same trade-off on the line, where each train trip costs a
fixed amount and stock waits for the train, gives $C(T) = F/T + h\lambda T/2$. It needs timetable routes and a
trip cost in the `mars` pack.

### Chapter 5: One period under uncertainty: the newsvendor

*Written in the mathematical register of decision 10. `LEDGER.md` lists its numbered statements, which
supersede the outline below.*

**Sources.** Snyder and Shen (2019), §§4.3.1–4.3.2, including the optimal cost under normal demand (eq. 4.30,
chapter 4 PDF pp. 6–22). Axsäter (2015), the newsboy model (PDF pp. 104–107).

**Model section, in order.**
1. *Discrete demand.* The current worked case and marginal argument, kept.
2. *Continuous demand.* $G(S) = h\,\mathbb E(S - D)^+ + p\,\mathbb E(D - S)^+$, $G'(S) = 0$ gives
   $F(S^*) = p/(p + h)$.
3. *Normal demand.* $S^* = \mu + z^*\sigma$ with $\Phi(z^*) = p/(p+h)$. With the loss function
   $G(z) = \phi(z) - z\,(1 - \Phi(z))$, the optimal cost is $(h + p)\,\sigma\,\phi(z^*)$. It depends on
   $\sigma$ and not on $\mu$, so it is the cost of uncertainty itself.
4. *Salvage.* The ratio with a salvage value, as the current exercise has it, moved into the text.

**Simulator.** The stand ordering 10, 15 and 20, as now. Then a scenario script that builds a discretised
normal demand table in Lua, ordering $\mu$ against $S^*$: the gap in cost against $(h + p)\sigma\phi(z^*)$.

**Placeholders.** None expected. If the discretised table proves awkward, `normal-per-period-demand`.

### Chapter 6: Reviews, lead times and base-stock

*Written in the mathematical register of decision 10. `LEDGER.md` lists its numbered statements, which
supersede the outline below.*

**Sources.** Snyder and Shen (2019), §4.3.4, the infinite-horizon base-stock level (chapter 4 PDF
pp. 30–33), and Theorem 4.8 on the optimality of base-stock policies without fixed costs (PDF pp. 59–64).
Axsäter (2015), the chapter on costs and concepts for inventory position.

**Model section, in order.**
1. *Inventory position.* $\text{IP} = \text{on hand} + \text{on order} - \text{backorders}$, and why an order
   decided on on-hand stock alone repeats orders already placed.
2. *The protection interval.* An order placed now is the last chance to affect stock until $R + L$ later.
3. *Base-stock as a newsvendor.* $S^* = F^{-1}_{D_{R+L}}\!\left(p/(p + h)\right)$ with
   $D_{R+L} \sim \text{Poisson}(\lambda(R + L))$. For the Shop with $R = 1$, $L = 2$ and $p = 10$, the level
   comes from the Poisson(30) quantile at $10/11$.
4. *When base-stock is optimal.* Without fixed costs, a base-stock policy is optimal. With them, chapter 4's
   $(s, S)$ returns.

**Simulator.** The Shop with Poisson demand and a lead time: order-up-to on inventory position against
on-hand stock, then $S^*$ against $S^* \pm 5$ in a batch. On the line, an exercise treats the dome's fill level
as a base-stock level over the round trip.

**Case study.** Double dispatch on `two-trains`, as a failure to count stock on other vehicles in the
position.

**Placeholders.** None expected.

### Chapter 7: Safety stock and service levels

*Written in the mathematical register of decision 10. `LEDGER.md` lists its numbered statements, which
supersede the outline below.*

**Sources.** Snyder and Shen (2019), the type 1 and type 2 service levels and the fill rate (chapter 4 PDF
pp. 36–46). Axsäter (2015), service levels $S_1$ to $S_3$ (PDF pp. 90–93). Eiselt and Sandblom (2022), §12.7,
the EOQ with random lead-time demand.

**Model section, in order.**
1. *Two measures of service.* Cycle service level and fill rate, defined on one cycle.
2. *Normal approximation, fixed lead time.* Safety stock $z\,\sigma\sqrt{R + L}$.
3. *Variable lead time.* $\operatorname{Var}(D_T) = \mathbb E[T]\,\sigma_D^2 + \mu_D^2 \operatorname{Var}(T)$.
4. *Fill rate.* $\beta \approx 1 - \sigma_{R+L}\,G(z)/(\mu_D R)$, and solving it for $z$ given a target.
5. *The price of service.* Safety stock as a function of the target, steep as it approaches 1.

**Simulator.** `classic.safety_stock` with the Shop's demand and costs: fixed against variable lead time at a
95% target, then targets of 0.90, 0.95 and 0.99.

**Case study.** Storm shock, with the dome's safety stock sized as cover in hours (chapter 2) against the
storm's length.

**Placeholders.** `service-level-metrics`: the simulator reports backorders and costs, not the share of cycles
without a stockout or the fill rate. Until it does, the chapter derives them from backorders in a test, and the
placeholder describes the metric view the reader would use.

### Chapter 8: Forecasting

*Written in the mathematical register of decision 10. `LEDGER.md` lists its numbered statements, which
supersede the outline below.*

**Sources.** Snyder and Shen (2019), ch. 2: moving averages, exponential smoothing, Holt's method and error
measures (chapter 2 PDF pp. 1–21). Axsäter (2015), ch. 2: exponential smoothing, trend and seasonal models,
and forecast errors (PDF pp. 26–38).

**Model section, in order.**
1. *A level model.* $x_t = a + \varepsilon_t$. The moving average of $N$ periods has variance
   $\sigma^2/N$ and an average data age of $(N - 1)/2$.
2. *Exponential smoothing.* $\hat a_t = \alpha x_t + (1 - \alpha)\hat a_{t-1}$, weights
   $\alpha(1 - \alpha)^k$, forecast variance $\alpha\sigma^2/(2 - \alpha)$, average age $(1 - \alpha)/\alpha$,
   and the matching $N \approx 2/\alpha - 1$.
3. *Trend.* Under a trend $b$, smoothing lags by $b(1 - \alpha)/\alpha$ in steady state. Holt's two
   equations remove the lag.
4. *Seasonality.* Multiplicative indices, briefly.
5. *Errors and safety stock.* Mean absolute deviation, bias and a tracking signal. The order-up-to level
   becomes $\hat D_{R+L} + z\,\sigma_e\sqrt{R + L}$, which closes Part II by joining chapters 6, 7 and 8.

**Simulator.** `classic.forecasting { level = 10 }`: smoothing constants 0.1 and 0.4 on level demand (lag
against noise), then smoothing against Holt on a trend, then a forecast-driven order-up-to level against a
fixed one.

**Placeholders.** `smooth-seasonal-demand` if the template's two flat halves cannot show seasonal indices
well. Step 4 confirms whether a trace can.

## Placeholder register

| Id | Chapter | Needs |
| --- | --- | --- |
| `mars-poisson-consumer` | 3 | Poisson consumption on `mars` consumers |
| `mars-dispatch-interval` | 4 | Timetable routes and a fixed trip cost in the `mars` pack |
| `normal-per-period-demand` | 5 | Normal per-period demand |
| `service-level-metrics` | 7 | Cycle service level and fill-rate metrics |
| `smooth-seasonal-demand` | 8 | A seasonal profile smoother than two levels |

All five are in use. Chapter 5 marks its normal-demand example with a placeholder and builds no discretised
table, and chapter 8 marks seasonal indices with one.

## Risks / Trade-offs

- **Rewritten tests change stated numbers.** Simulator claims move to new scenario variants, so most
  `book.test.ts` cases are replaced. Golden hashes are unaffected, since starter scenarios do not change.
- **Moving fix examples.** Starters' fixes are marked with the `fix` flag. A rewritten chapter must keep one
  marked fix per starter, or the library loses its link. The docs check already enforces this.
- **Longer chapters.** Statements, proofs and worked examples add length. Chapters 1 to 3 in the register of
  decision 10 run to between 3,500 and 4,900 words of source, including check references. The target is
  under 5,000, with exercises carrying the extensions.
- **Lint false positives.** "not" after a comma has legitimate uses. The lint allows a per-line exemption
  comment, and the style pass reviews every exemption.

## Open Questions

None outstanding. Settled during planning:

- Batch comparisons always pair seeds (batch-comparison spec, "Paired seeds"). Chapter 3 builds the
  independent comparison from two single-policy batches with different base seeds.
- The long-run averages table reports average cargo aboard but no measured time aboard
  (`packages/engine/src/averages.ts`). Chapter 2 uses the known trip time for the vehicle.
- The notation page is an appendix to the book.
