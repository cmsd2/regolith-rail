import { docsHref } from "../lib/format.ts";
import { METRICS, type MetricDefinition } from "../lib/metrics.ts";
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
  if (!metrics) return null;
  return (
    <table className={styles.table} data-testid="metrics">
      <tbody>
        {METRICS.map((metric) => (
          <tr key={metric.key}>
            <th scope="row">
              <MetricLink metric={metric} />
            </th>
            <td>{metric.format(metrics[metric.key])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
