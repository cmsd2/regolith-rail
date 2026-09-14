import { docsHref } from "../lib/format.ts";
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

export function MetricsSummary() {
  const metrics = useWorkbench((s) => s.run.output?.metrics);
  const scenario = useWorkbench((s) => s.scenario.scenario);
  if (!metrics) return null;
  return (
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
  );
}
