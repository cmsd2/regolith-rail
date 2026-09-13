import { opsBlocks } from "@regolith-rail/policy-api";
import { useMemo } from "react";
import { docsHref, formatAmount, formatDuration, formatGameTime } from "../lib/format.ts";
import { latestStopAt, stopDetail } from "../lib/stops.ts";
import { usePlayhead, useWorkbench, workbench } from "../state/instance.ts";
import styles from "./Workbench.module.css";

const blockDocs = new Map(opsBlocks.map((b) => [b.name, b.docs]));

export function StopInspector() {
  const output = useWorkbench((s) => s.run.output);
  const selected = useWorkbench((s) => s.selectedStop);
  const t = usePlayhead((s) => Math.floor(s.t / 60_000) * 60_000);
  const stop = output ? (selected ?? latestStopAt(output, t)) : null;
  const detail = useMemo(
    () => (output && stop !== null ? stopDetail(output, stop) : null),
    [output, stop],
  );

  if (!output) return null;
  if (!detail) return <p className={styles.muted}>No train has stopped yet at this time.</p>;

  const requested = detail.transfers.map((transfer) => {
    const warning = detail.warnings.find(
      (w) =>
        w.action?.resource === transfer.resource && w.action.applied === Math.abs(transfer.amount),
    );
    return { transfer, warning };
  });
  const unapplied = detail.warnings.filter((w) => !w.action || w.action.applied === 0);

  return (
    <div className={styles.inspector} data-testid="stop-inspector">
      <h3>
        Stop {detail.stop}: {detail.train} at {detail.station}{" "}
        <span className={styles.muted}>
          {formatGameTime(detail.t)}, leaving {detail.direction}
          {detail.dwellMs !== null && `, dwell ${formatDuration(detail.dwellMs)}`}
        </span>
        {selected !== null && (
          <button
            type="button"
            className={styles.link}
            onClick={() => workbench.getState().selectStop(null)}
          >
            Follow playhead
          </button>
        )}
      </h3>

      <section>
        <h4>Actions</h4>
        {requested.length === 0 && unapplied.length === 0 && (
          <p className={styles.muted}>No actions.</p>
        )}
        <ul data-testid="stop-actions">
          {requested.map(({ transfer, warning }) => (
            <li key={`${transfer.resource}-${transfer.amount}`}>
              {transfer.amount > 0 ? "Loaded" : "Unloaded"}{" "}
              {formatAmount(Math.abs(transfer.amount))} {transfer.resource}
              {warning?.action && (
                <span className={styles.warning} data-testid="clamped">
                  {" "}
                  (requested {formatAmount(warning.action.requested)}: {warning.message})
                </span>
              )}
            </li>
          ))}
          {unapplied.map((w, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: warnings have no identity beyond their order
            <li key={i} className={styles.warning} data-testid="clamped">
              {w.action
                ? `${w.action.type} ${w.action.resource}: requested ${formatAmount(w.action.requested)}, nothing applied (${w.message})`
                : w.message}
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
          <ul data-testid="stop-traces">
            {detail.traces.map((trace, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: traces have no identity beyond their order
              <li key={i}>
                <a
                  href={docsHref(blockDocs.get(trace.block) ?? "ops")}
                  data-docs={blockDocs.get(trace.block)}
                >
                  {trace.block}
                </a>{" "}
                {trace.resource} at {trace.station}:{" "}
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
        <table className={styles.table} data-testid="stop-snapshot">
          <thead>
            <tr>
              <th scope="col">Station</th>
              {output.resources.map((r) => (
                <th scope="col" key={r}>
                  {r}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {output.stations.map((station) => (
              <tr key={station} className={station === detail.station ? styles.current : undefined}>
                <th scope="row">{station}</th>
                {output.resources.map((r) => {
                  const amount = detail.stock[station]?.[r];
                  return <td key={r}>{amount === undefined ? "–" : formatAmount(amount)}</td>;
                })}
              </tr>
            ))}
            <tr>
              <th scope="row">{detail.train} cargo</th>
              {output.resources.map((r) => (
                <td key={r}>{formatAmount(detail.cargo[r] ?? 0)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
