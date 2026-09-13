import { opsBlocks } from "@regolith-rail/policy-api";
import { useMemo } from "react";
import { docsHref, formatAmount, formatGameTime } from "../lib/format.ts";
import { latestReviewAt, reviewDetail } from "../lib/reviews.ts";
import { usePlayhead, useWorkbench, workbench } from "../state/instance.ts";
import styles from "./Workbench.module.css";

const blockDocs = new Map(opsBlocks.map((b) => [b.name, b.docs]));

/** What a station saw and ordered at a review. */
export function ReviewInspector() {
  const output = useWorkbench((s) => s.run.output);
  const selected = useWorkbench((s) => s.selectedReview);
  const t = usePlayhead((s) => Math.floor(s.t / 60_000) * 60_000);
  const review = output ? (selected ?? latestReviewAt(output, t)) : null;
  const detail = useMemo(
    () => (output && review !== null ? reviewDetail(output, review) : null),
    [output, review],
  );
  if (!output) return null;
  if (!detail) {
    return <p className={styles.muted}>No station has been reviewed yet at this time.</p>;
  }
  const resources = Object.keys(detail.stock);
  return (
    <div className={styles.inspector} data-testid="review-inspector">
      <h3>
        Review {detail.review}: {detail.station}{" "}
        <span className={styles.muted}>{formatGameTime(detail.t)}</span>
        {selected !== null && (
          <button
            type="button"
            className={styles.link}
            onClick={() => workbench.getState().selectReview(null)}
          >
            Follow playhead
          </button>
        )}
      </h3>

      <section>
        <h4>Orders</h4>
        {detail.orders.length === 0 && <p className={styles.muted}>No orders.</p>}
        <ul data-testid="review-orders">
          {detail.orders.map((order) => (
            <li key={`${order.resource}-${order.from}`}>
              Ordered {formatAmount(order.amount)} {order.resource} from {order.from}
              {order.amount !== order.requested && (
                <span className={styles.warning}> (requested {formatAmount(order.requested)})</span>
              )}
              {order.arrivesAt !== undefined
                ? `, arriving ${formatGameTime(order.arrivesAt)}`
                : ", waiting for the supplier to have stock"}
            </li>
          ))}
          {detail.warnings.map((w, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: warnings have no identity beyond their order
            <li key={`warning-${i}`} className={styles.warning}>
              {w.message}
            </li>
          ))}
        </ul>
      </section>

      {detail.errors.length > 0 && (
        <section>
          <h4>Errors</h4>
          <ul>
            {detail.errors.map((e, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: errors have no identity beyond their order
              <li key={i} className={styles.error}>
                {e.line !== undefined && `Line ${e.line}: `}
                {e.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {detail.traces.length > 0 && (
        <section>
          <h4>Decisions</h4>
          <ul data-testid="review-traces">
            {detail.traces.map((trace, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: traces have no identity beyond their order
              <li key={i}>
                <a
                  href={docsHref(blockDocs.get(trace.block) ?? "ops/policy")}
                  data-docs={blockDocs.get(trace.block) ?? "ops/policy"}
                >
                  {trace.block}
                </a>{" "}
                {trace.resource}:{" "}
                {Object.entries(trace.inputs)
                  .map(([k, v]) => `${k} ${typeof v === "number" ? formatAmount(v) : v}`)
                  .join(", ")}{" "}
                → {typeof trace.result === "number" ? formatAmount(trace.result) : trace.result}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(detail.logs.length > 0 || detail.records.length > 0) && (
        <section>
          <h4>Log</h4>
          <ul>
            {detail.logs.map((line, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: log lines have no identity beyond their order
              <li key={`log-${i}`}>
                <code>{line}</code>
              </li>
            ))}
            {detail.records.map((r, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: records have no identity beyond their order
              <li key={`record-${i}`}>
                record {r.name} = {r.value}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h4>What the policy saw</h4>
        <table className={styles.table} data-testid="review-snapshot">
          <thead>
            <tr>
              <th scope="col">{detail.station}</th>
              {resources.map((r) => (
                <th scope="col" key={r}>
                  {r}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Stock</th>
              {resources.map((r) => (
                <td key={r}>{formatAmount(detail.stock[r] ?? 0)}</td>
              ))}
            </tr>
            {Object.keys(detail.backorders).length > 0 && (
              <tr>
                <th scope="row">Backordered</th>
                {resources.map((r) => (
                  <td key={r}>{formatAmount(detail.backorders[r] ?? 0)}</td>
                ))}
              </tr>
            )}
            <tr>
              <th scope="row">On the way</th>
              {resources.map((r) => (
                <td key={r}>
                  {formatAmount(
                    detail.onTheWay
                      .filter((s) => s.resource === r)
                      .reduce((sum, s) => sum + s.amount, 0),
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
