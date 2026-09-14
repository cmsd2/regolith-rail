import { runAverages } from "@regolith-rail/engine";
import { useMemo } from "react";
import { docsHref, formatAmount } from "../lib/format.ts";
import { type MetricDefinition, metricsFor } from "../lib/metrics.ts";
import { useWorkbench } from "../state/instance.ts";
import styles from "./Workbench.module.css";

export function MetricLink({ metric }: { metric: MetricDefinition }) {
  return (
    <a href={docsHref(`metrics#${metric.anchor}`)} data-docs={`metrics#${metric.anchor}`}>
      {metric.label}
    </a>
  );
}

const hours = (value: number | undefined) =>
  value === undefined ? "–" : value.toLocaleString("en-GB", { maximumFractionDigits: 1 });
const perDay = (milliUnits: number) =>
  (milliUnits / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 });

/**
 * Long-run averages of stock and flow at each station and across the line, with the time a
 * unit stays read two ways: stock over flow, and following each unit that left.
 */
function AveragesTable() {
  const output = useWorkbench((s) => s.run.output);
  const averages = useMemo(() => (output?.stock ? runAverages(output) : null), [output]);
  if (!averages) return null;
  return (
    <>
      <h3 className={styles.subheading}>
        <a href={docsHref("metrics#long-run-averages")} data-docs="metrics#long-run-averages">
          Long-run averages
        </a>
      </h3>
      <table className={styles.table} data-testid="averages">
        <thead>
          <tr>
            <th scope="col">Station</th>
            <th scope="col">Resource</th>
            <th scope="col">Stock</th>
            <th scope="col">In a day</th>
            <th scope="col">Out a day</th>
            <th scope="col">Stock ÷ out (h)</th>
            <th scope="col">Waited (h)</th>
          </tr>
        </thead>
        <tbody>
          {averages.sites.map((site) => (
            <tr key={`${site.station}:${site.resource}`}>
              <th scope="row">{site.station}</th>
              <td>{site.resource}</td>
              <td>{formatAmount(site.stock)}</td>
              <td>{perDay(site.inPerDay)}</td>
              <td>{perDay(site.outPerDay)}</td>
              <td>{hours(site.hours)}</td>
              <td>{hours(site.waitedHours)}</td>
            </tr>
          ))}
          {averages.line.map((line) => (
            <tr key={`line:${line.resource}`} className={styles.total}>
              <th scope="row">Line, with cargo</th>
              <td>{line.resource}</td>
              <td>{formatAmount(line.atStations + line.aboard)}</td>
              <td>–</td>
              <td>{perDay(line.consumedPerDay)}</td>
              <td>{hours(line.hours)}</td>
              <td>–</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function MetricsSummary() {
  const metrics = useWorkbench((s) => s.run.output?.metrics);
  const scenario = useWorkbench((s) => s.scenario.scenario);
  if (!metrics) return null;
  return (
    <>
      <table className={styles.table} data-testid="metrics">
        <tbody>
          {metricsFor(scenario).map((metric) => (
            <tr key={metric.key}>
              <th scope="row">
                <MetricLink metric={metric} />
              </th>
              <td>{metric.format(metric.value(metrics))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <AveragesTable />
    </>
  );
}
