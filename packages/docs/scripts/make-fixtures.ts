import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { notebookWithPrelude } from "../src/claims-run.ts";

// Writes the claims fixtures: a passing page and a failing one, each with its checks.
const prelude = readFileSync(new URL("../checks/prelude.mac", import.meta.url), "utf8");
const template = readFileSync(new URL("../checks/template.checks.py", import.meta.url), "utf8");
const dir = (name: string) => {
  const url = new URL(`../fixtures/claims/${name}/`, import.meta.url);
  mkdirSync(url, { recursive: true });
  return url;
};
const page = (title: string, refs: string[]) =>
  `---\ntitle: ${title}\nsection: Guides\n---\n\n${refs.map((r) => `A claim.\n\n<Check ref="${r}" />\n`).join("\n")}`;

const passing = dir("passing");
writeFileSync(
  new URL("ratio.mdx", passing),
  page("Ratio", ["maxima:critical-ratio", "python:quantile"]),
);
writeFileSync(
  new URL("ratio.checks.macnb", passing),
  notebookWithPrelude(prelude, [
    '/* check: critical-ratio */\np: 5$ c: 3$\nexpect_equal("critical-ratio", (p - c)/p, 2/5);',
  ]),
);
writeFileSync(
  new URL("ratio.checks.py", passing),
  template.replace(
    'def check_example():\n    assert 1 + 1 == 2, "example"',
    'def check_quantile():\n    from scipy import stats\n\n    assert stats.poisson.ppf(0.9, 20) == 26, "quantile"',
  ),
);

const failing = dir("failing");
writeFileSync(new URL("wrong.mdx", failing), page("Wrong", ["maxima:critical-ratio"]));
writeFileSync(
  new URL("wrong.checks.macnb", failing),
  notebookWithPrelude(prelude, [
    '/* check: critical-ratio */\np: 5$ c: 2$\nexpect_equal("critical-ratio", (p - c)/p, 2/5);',
  ]),
);
console.log("wrote fixtures/claims");
