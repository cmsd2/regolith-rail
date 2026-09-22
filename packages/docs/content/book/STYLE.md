# Style guide for the book

This file is for authors. It is not published: only `.mdx` files become pages.

The book teaches operations research to readers who know first-year probability and statistics. Its prose
explains how a result arises and when it holds. The reader draws the conclusions.

## Register

- **Neutral and technical.** Describe the mechanism: which quantity changes, what it depends on, by how much.
  Leave out judgements the reader can make from the numbers.
- **Active voice** where the agent is known. Write "the train loads half the difference" in place of "half
  the difference is loaded".
- **End a paragraph when its point is made.** No summarising line, no moral, no restatement of the last
  sentence in general terms.
- **Claims no stronger than the evidence.** Say "on this line" when the evidence is one line. Say "in every
  run" only when every run was checked.
- **No significance inflation.** State the fact. "The cost rises 25%" is enough.
- **Trust the reader.** Say a thing once. Do not announce what is coming ("Let's look at…") or what has been
  shown ("As we have seen…").
- **Plain words.** "Use" in place of "utilise". No buzzwords. Mechanical terms over metaphors.
- **Adjectives earn their place.** Keep an adjective when it carries technical meaning ("periodic",
  "backordered") or real weight. Drop decorative ones.
- **Show the mechanism.** Where a system is intricate, describe how its parts interact. Do not label it
  "complex" or "subtle".
- **Lists of two or four.** Three adjectives, verbs or nouns in a row read as a formula. Use two, or four, or
  split them into sentences.

## Structure inside a section

1. The setting and its assumptions.
2. The derivation, with each displayed step.
3. The result, named.
4. Worked numbers for the running example.
5. What the result does not cover, if it matters for what follows.

Numbers never come before the relation that produces them. In the simulator section, the model's prediction
comes before the run, and the table of predicted and simulated values comes after it.

## Checks

A displayed formula needs a check that cites it before the next heading. A check after a formula's worked
numbers covers both. A derivation of several formulas can end with one grouped check, one reference to a line:

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
