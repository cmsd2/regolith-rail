# Style guide for the book

This file is for authors. It is not published: only `.mdx` files become pages.

The book teaches operations research to readers who know first-year probability and statistics. It reads
as a mathematics text: it defines its terms, states its results, proves the ones whose proofs teach
something, and works examples by computation. The simulator confirms what the mathematics predicts.

## Register

- **Neutral and declarative.** Write as a scientific paper or a mathematics textbook does. State what is
  defined, assumed, shown and computed. Leave out judgements the reader can make from the result.
- **Impersonal.** No "you". Prefer the mathematical object as the subject of the sentence: "Solving the pair
  for $a$ gives", "The dome's stock falls at rate $u$". "We" is acceptable in a proof where no object serves.
  Instructions in the simulator section and in exercises use the imperative: "Set", "Run", "Show that".
- **Standard openings.** "Let", "Consider", "Suppose", "Then", "Hence", "It follows that". No rhetorical
  questions, no "Take a single stop first", no narrative of discovery.
- **Active voice** where the agent is known. Write "the train loads half the difference" in place of "half
  the difference is loaded".
- **End a paragraph when its point is made.** No summarising line, no moral, no restatement of the last
  sentence in general terms.
- **Claims no stronger than what is shown.** A proposition states its assumptions. A remark about a
  simulated run says which run.
- **Technical terms.** Use the field's term where one exists (binding constraint, slack, utilisation,
  unbiased estimator), define it at first use in a Definition, and keep to it. One term for one thing:
  "stock" is an amount present, "capacity" a limit.
- **Plain words** for everything else. No buzzwords, no metaphors, no decorative adjectives.
- **Lists of two or four.** Three adjectives, verbs or nouns in a row read as a formula. Use two, or four, or
  split them into sentences.

## Statements

The model section is built from numbered statements. Each has an `id` and may have a `name`. The build
numbers them in one sequence per chapter, whatever their kind, and `<Ref to="id" />` cites one as
"Theorem 2.3" with a link.

| Element | Use |
| --- | --- |
| `<Definition>` | A term, with the term in bold where it is defined. |
| `<Assumption>` | A standing condition that later results rely on. |
| `<Lemma>`, `<Proposition>`, `<Theorem>`, `<Corollary>` | A result. A theorem is a main result of the chapter, and there are few. |
| `<Proof>` | Follows the result it proves. Unnumbered. |
| `<WorkedExample>` | A computation, labelled Example. Every chapter's running example appears in these. |
| `<Remark>` | A limit, a link to another chapter or a note on usage. |

Ids carry a prefix for their kind: `def-`, `asm-`, `lem-`, `prop-`, `thm-`, `cor-`, `ex-`, `rem-`.

**When to prove.** Prove a result when the proof shows why the result holds or exercises a technique the
reader will reuse: a counting argument, a first-order condition, a variance computation. State a result
without proof, with a citation, when its proof is long or needs tools beyond the prerequisites. Say which
it is: "Proof", "Sketch of proof", or a sentence naming the source.

**When to compute.** Follow each result with a worked example on the chapter's running example, showing
the substitution. A reader should be able to reproduce every number from the parameters given.

## Structure inside a section

1. Definitions and assumptions.
2. The result, as a numbered statement.
3. Its proof, or the source that proves it.
4. A worked example with the running example's numbers.
5. A remark on what the result does not cover, if later text depends on it.

A section's prose connects the statements: one or two sentences saying why the next definition or result is
wanted. Numbers never come before the relation that produces them.

## The simulator section

The simulator grounds the model. It does not carry the argument. Keep the section short: name the scenario,
give the policies as code, say what to run, and set the model's values beside the simulator's in a
`<Predicted>` table. Library vocabulary (`ops` blocks, scenario script fields) belongs here and in exercises,
and stays out of the model section.

## Checks

A displayed formula needs a check that cites it before the next heading. A check after a formula's worked
numbers covers both. A statement and its proof count as part of the text around them, so one grouped check
after a proof can cover the formulas in the result and the proof, one reference to a line:

```mdx
<Check refs="
  maxima:eoq-cost
  maxima:eoq-optimum
  maxima:eoq-sensitivity
" />
```

A grouped check citing n references covers the last n formulas before it that no other check covers.

## Linted

`pnpm docs:check` fails on these in Book pages, outside code and mathematics:

- em dashes (—). Use commas, full stops or parentheses.
- tailing negations: a clause followed by ", not …" or "; not …", and "not just", "not only", "not merely".
- the words and phrases *sharp*, *grounded*, *load-bearing*, *crucial*, *key insight*, *worth noting*,
  *worth stating*, *it turns out*, *in other words*, *in short*, *the whole difference*, *simply put*.
- sentences opening with *Let's*, *Here's*, *In conclusion*, *Furthermore*, *Moreover* or *Additionally*.

A line may carry `{/* prose-ok: reason */}` when a match is a false positive, such as a quoted title. The
style pass reviews every exemption.

## Reviewed by reading

The lint cannot catch these. Read each chapter aloud and rewrite any you find.

- second person, rhetorical questions and narrative openings ("Take a single stop first.");
- aphoristic closers ("Balancing pays for its generality.");
- verdicts stronger than the evidence ("that knowledge is the whole difference between meeting demand and
  not");
- simulator output told as a finding where the model's prediction belongs;
- filler and hedging: "in order to", "due to the fact that", "simply", "could potentially";
- generic transitions at the start of a paragraph;
- lists of three.

## Rewrites

Examples from the first edition of each chapter, and the direction of the fix.

| Chapter | First edition | Rewrite |
| --- | --- | --- |
| 1 | That is a fact about the line, not a failure of the rule. | No policy can move the surplus, since the dome uses less than the mine makes. |
| 1 | The train has the capacity; the rule only ever uses about half of the gap it sees. | (Delete. The derivation above it shows the factor of one half.) |
| 1 | Balancing pays for its generality. | Balancing needs no knowledge of which station supplies and which demands. The drain-and-fill rule uses that knowledge. |
| 1 | …and that is the whole difference between the two rules in this chapter. | The two rules in this chapter differ only in whether they classify sites first. |
| 2 | That has a consequence worth stating: | (Delete, and state the consequence.) |
| 2 | Little's law is only an identity, and it says nothing about whether a policy is good. | Little's law holds for any policy, so it cannot rank policies. It converts a stock level into a time. |
| 3 | Common random numbers reduce variance when the policies respond to the noise in the same direction, which is the usual case, but it is worth checking. | Common random numbers reduce the variance of the difference when the two policies' results are positively correlated. Comparing the paired interval with the unpaired one shows whether they are. |
| 4 | **Reviews, not continuous watching.** | **Periodic review.** The station can order only at a review. |
| 5 | The ratio says how much protection is worth buying. | The ratio is the probability of covering demand that the costs justify. |
| 6 | **Periodic, not continuous, review.** | **Periodic review.** Many textbook models watch stock continuously. The simulator reviews on a schedule. |
| 7 | The simulator reports backorders and costs, not the … | The simulator reports backorders and costs. It does not yet report … |
| 8 | …needs correcting, not just more safety stock around it. | A forecast with a steady bias needs its bias removed. Safety stock covers random error around an unbiased forecast. |
