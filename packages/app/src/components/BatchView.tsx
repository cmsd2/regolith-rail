import { batchSeeds } from "@regolith-rail/engine";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatAmount, PALETTE } from "../lib/format.ts";
import { type MetricDefinition, metricsFor } from "../lib/metrics.ts";
import { type PairedDifference, pairedDifference, type Summary, summarise } from "../lib/stats.ts";
import { useWorkbench, workbench } from "../state/instance.ts";
import type { SeedResult } from "../workers/protocol.ts";
import styles from "./BatchView.module.css";
import { MetricLink } from "./MetricsSummary.tsx";

const MAX_SEEDS = 1000;

function BatchConfig() {
  const batch = useWorkbench((s) => s.batch);
  const policyName = useWorkbench((s) => s.policy.name);
  const policyB = useWorkbench((s) => s.policyB);
  const scenarioTitle = useWorkbench((s) => s.scenario.scenario?.title ?? "Invalid scenario");
  const valid = useWorkbench((s) => s.scenario.scenario !== null);
  const { setBatchOptions, startBatch, cancelBatch } = workbench.getState();
  const running = batch.status === "running";
  return (
    <form
      className={styles.config}
      onSubmit={(e) => {
        e.preventDefault();
        void startBatch(batchSeeds(batch.baseSeed, batch.seedCount));
      }}
      data-testid="batch-config"
    >
      <p>
        Scenario <strong>{scenarioTitle}</strong>, policy A <code>{policyName}</code> from the
        editor.
      </p>
      <label>
        Seeds{" "}
        <input
          type="number"
          min={1}
          max={MAX_SEEDS}
          value={batch.seedCount}
          onChange={(e) =>
            setBatchOptions({
              seedCount: Math.max(1, Math.min(MAX_SEEDS, Math.floor(Number(e.target.value) || 1))),
            })
          }
          data-testid="batch-seeds"
        />
      </label>
      <label>
        Base seed{" "}
        <input
          type="number"
          min={0}
          value={batch.baseSeed}
          onChange={(e) =>
            setBatchOptions({ baseSeed: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
          }
          data-testid="batch-base-seed"
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={batch.compare}
          onChange={(e) => setBatchOptions({ compare: e.target.checked })}
          data-testid="batch-compare"
        />{" "}
        Compare with policy B
      </label>
      {batch.compare && (
        <p data-testid="batch-policy-b">
          Policy B <code>{policyB.name}</code> from the Compare slot.{" "}
          <button
            type="button"
            onClick={() => workbench.getState().chooseFor("compare")}
            data-testid="batch-choose-policy-b"
          >
            Choose policy B…
          </button>
        </p>
      )}
      {running ? (
        <button type="button" onClick={cancelBatch} data-testid="batch-cancel">
          Cancel
        </button>
      ) : (
        <button type="submit" className={styles.primary} disabled={!valid} data-testid="batch-run">
          Run batch
        </button>
      )}
      {running && (
        <progress value={batch.done} max={batch.total || 1} data-testid="batch-progress">
          {batch.done} of {batch.total}
        </progress>
      )}
      {batch.error && <span className={styles.bad}>{batch.error}</span>}
    </form>
  );
}

const valuesOf = (results: SeedResult[], metric: MetricDefinition) =>
  results.map((r) => metric.value(r.metrics));

function Interval({ summary, format }: { summary: Summary; format(v: number): string }) {
  return (
    <span className={styles.interval} title="95% confidence interval for the mean">
      {format(summary.ciLow)} to {format(summary.ciHigh)}
    </span>
  );
}

function verdictClass(diff: PairedDifference): string | undefined {
  return diff.verdict === "better"
    ? styles.good
    : diff.verdict === "worse"
      ? styles.bad
      : styles.muted;
}

function MetricTable({ a, b }: { a: SeedResult[]; b: SeedResult[] | undefined }) {
  const scenario = useWorkbench((s) => s.scenario.scenario);
  const signed = (format: (v: number) => string) => (v: number) =>
    `${v > 0 ? "+" : v < 0 ? "−" : ""}${format(Math.abs(v))}`;
  return (
    <table className={styles.table} data-testid="batch-metrics">
      <thead>
        <tr>
          <th scope="col">Metric</th>
          <th scope="col">A median</th>
          <th scope="col">A mean (95% CI)</th>
          {b && <th scope="col">B median</th>}
          {b && <th scope="col">B mean (95% CI)</th>}
          {b && <th scope="col">B − A (95% CI)</th>}
        </tr>
      </thead>
      <tbody>
        {metricsFor(scenario).map((metric) => {
          const sa = summarise(valuesOf(a, metric));
          const sb = b ? summarise(valuesOf(b, metric)) : null;
          const diff = b
            ? pairedDifference(valuesOf(a, metric), valuesOf(b, metric), metric.lowerIsBetter)
            : null;
          return (
            <tr key={metric.key} data-metric={metric.key}>
              <th scope="row">
                <MetricLink metric={metric} />
              </th>
              <td>{metric.format(sa.median)}</td>
              <td>
                {metric.format(sa.mean)} <Interval summary={sa} format={metric.format} />
              </td>
              {sb && <td>{metric.format(sb.median)}</td>}
              {sb && (
                <td>
                  {metric.format(sb.mean)} <Interval summary={sb} format={metric.format} />
                </td>
              )}
              {diff && (
                <td data-testid={`difference-${metric.key}`} data-verdict={diff.verdict}>
                  {signed(metric.format)(diff.mean)}{" "}
                  <Interval summary={diff} format={signed(metric.format)} />{" "}
                  <span className={verdictClass(diff)}>{diff.verdict}</span>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function BoxPlots({ a, b }: { a: SeedResult[]; b: SeedResult[] | undefined }) {
  const scenario = useWorkbench((s) => s.scenario.scenario);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    void import("@observablehq/plot").then((Plot) => {
      if (disposed) return;
      element.replaceChildren();
      for (const metric of metricsFor(scenario).filter(
        (m) => m.lowerIsBetter || m.key === "demandMet",
      )) {
        const rows = [
          ...a.map((r) => ({ policy: "A", value: metric.value(r.metrics) })),
          ...(b ?? []).map((r) => ({ policy: "B", value: metric.value(r.metrics) })),
        ];
        const figure = Plot.plot({
          title: metric.label,
          height: b ? 110 : 80,
          marginLeft: 30,
          x: { grid: true, tickFormat: (v: number) => metric.format(v) },
          y: { label: null },
          color: { domain: ["A", "B"], range: [PALETTE[1] as string, PALETTE[0] as string] },
          marks: [Plot.boxX(rows, { x: "value", y: "policy", fill: "policy" })],
        });
        figure.setAttribute("data-testid", `distribution-${metric.key}`);
        element.append(figure);
      }
    });
    return () => {
      disposed = true;
    };
  }, [a, b, scenario]);
  return <div ref={host} className={styles.plots} data-testid="batch-distributions" />;
}

function FanChart({ a, b }: { a: SeedResult[]; b: SeedResult[] | undefined }) {
  const scenario = useWorkbench((s) => s.scenario.scenario);
  const sites = useMemo(
    () => scenario?.stations.flatMap((st) => st.resources.map((r) => `${st.id} ${r.id}`)) ?? [],
    [scenario],
  );
  const [site, setSite] = useState(0);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    void import("@observablehq/plot").then((Plot) => {
      if (disposed) return;
      const bands = (results: SeedResult[], policy: string) => {
        const first = results[0];
        if (!first) return [];
        return first.samples.t.map((t, i) => {
          const values = results
            .map((r) => (r.samples.stock[i]?.[site] ?? 0) / 1000)
            .sort((x, y) => x - y);
          const s = summarise(values);
          const at = (p: number) =>
            values[Math.min(values.length - 1, Math.floor(p * (values.length - 1)))] as number;
          return {
            hours: t / 3_600_000,
            policy,
            median: s.median,
            p10: at(0.1),
            p90: at(0.9),
            q1: s.q1,
            q3: s.q3,
          };
        });
      };
      const rows = [...bands(a, "A"), ...(b ? bands(b, "B") : [])];
      element.replaceChildren(
        Plot.plot({
          title: `Stock over time at ${sites[site] ?? ""} (median, 25–75% and 10–90% of seeds)`,
          height: 220,
          x: { label: "Hours" },
          y: { label: "Units", grid: true },
          color: {
            domain: ["A", "B"],
            range: [PALETTE[1] as string, PALETTE[0] as string],
            legend: Boolean(b),
          },
          marks: [
            Plot.areaY(rows, {
              x: "hours",
              y1: "p10",
              y2: "p90",
              fill: "policy",
              fillOpacity: 0.15,
              z: "policy",
            }),
            Plot.areaY(rows, {
              x: "hours",
              y1: "q1",
              y2: "q3",
              fill: "policy",
              fillOpacity: 0.25,
              z: "policy",
            }),
            Plot.lineY(rows, { x: "hours", y: "median", stroke: "policy", z: "policy" }),
          ],
        }),
      );
    });
    return () => {
      disposed = true;
    };
  }, [a, b, site, sites]);
  return (
    <div>
      <label>
        Site{" "}
        <select
          value={site}
          onChange={(e) => setSite(Number(e.target.value))}
          data-testid="fan-site"
        >
          {sites.map((label, i) => (
            <option key={label} value={i}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div ref={host} data-testid="batch-fan" />
    </div>
  );
}

function FailedRuns({ results, which }: { results: SeedResult[]; which: "a" | "b" }) {
  const failed = results.filter((r) => r.metrics.policyErrors > 0 || r.aborted);
  const label = which.toUpperCase();
  return (
    <div data-testid={`failed-${which}`}>
      <p>
        Policy {label}:{" "}
        {failed.length === 0 ? "no runs with errors" : `${failed.length} runs with errors`}
      </p>
      {failed.length > 0 && (
        <ul className={styles.failed}>
          {failed.slice(0, 50).map((r) => (
            <li key={r.seed}>
              <button
                type="button"
                className={styles.link}
                onClick={() => void workbench.getState().openSeed(which, r.seed)}
              >
                Seed {r.seed}
              </button>{" "}
              <span className={styles.muted}>
                {r.metrics.policyErrors} errors{r.firstError && `: ${r.firstError.message}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SeedTable({ a, b }: { a: SeedResult[]; b: SeedResult[] | undefined }) {
  const [shown, setShown] = useState(20);
  return (
    <details>
      <summary>Every seed</summary>
      <table className={styles.table} data-testid="batch-seeds-table">
        <thead>
          <tr>
            <th scope="col">Seed</th>
            <th scope="col">A unmet</th>
            <th scope="col">A stalled</th>
            {b && <th scope="col">B unmet</th>}
            {b && <th scope="col">B stalled</th>}
            <th scope="col">Open</th>
          </tr>
        </thead>
        <tbody>
          {a.slice(0, shown).map((ra, i) => {
            const rb = b?.[i];
            return (
              <tr key={ra.seed} data-seed={ra.seed}>
                <th scope="row">{ra.seed}</th>
                <td data-testid="seed-unmet-a">{formatAmount(ra.metrics.unmetDemandWeighted)}</td>
                <td>{formatAmount(ra.metrics.stalledProduction)}</td>
                {rb && <td>{formatAmount(rb.metrics.unmetDemandWeighted)}</td>}
                {rb && <td>{formatAmount(rb.metrics.stalledProduction)}</td>}
                <td>
                  <button
                    type="button"
                    className={styles.link}
                    onClick={() => void workbench.getState().openSeed("a", ra.seed)}
                    data-testid="open-seed-a"
                  >
                    A
                  </button>
                  {rb && (
                    <button
                      type="button"
                      className={styles.link}
                      onClick={() => void workbench.getState().openSeed("b", ra.seed)}
                    >
                      B
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {shown < a.length && (
        <button type="button" className={styles.link} onClick={() => setShown(shown + 100)}>
          Show more
        </button>
      )}
    </details>
  );
}

export default function BatchView() {
  const results = useWorkbench((s) => s.batch.results);
  return (
    <div className={styles.batch} data-testid="batch-view">
      <BatchConfig />
      {results && (
        <>
          <p className={styles.muted}>
            {results.a.length} seeds{results.b ? ", the same seeds for both policies" : ""}.
            Intervals are 95% confidence intervals for the mean; differences are paired seed by
            seed.
          </p>
          <MetricTable a={results.a} b={results.b} />
          <FailedRuns results={results.a} which="a" />
          {results.b && <FailedRuns results={results.b} which="b" />}
          <FanChart a={results.a} b={results.b} />
          <BoxPlots a={results.a} b={results.b} />
          <SeedTable a={results.a} b={results.b} />
        </>
      )}
    </div>
  );
}
