import { useMemo } from "react";
import { formatGameTime } from "../lib/format.ts";
import { playhead, useWorkbench, workbench } from "../state/instance.ts";
import styles from "./Workbench.module.css";

export function useRunErrors() {
  const output = useWorkbench((s) => s.run.output);
  return useMemo(
    () =>
      output?.events.filter((e): e is Extract<typeof e, { kind: "error" }> => e.kind === "error") ??
      [],
    [output],
  );
}

export function ErrorList() {
  const errors = useRunErrors();
  if (errors.length === 0) return <p className={styles.muted}>No policy errors in this run.</p>;
  const shown = errors.slice(0, 500);
  return (
    <ul className={styles.errorList} data-testid="error-list">
      {shown.map((error, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: errors have no identity beyond their order
        <li key={i}>
          <button
            type="button"
            className={styles.errorItem}
            onClick={() => {
              playhead.getState().pause();
              playhead.getState().setTime(error.t);
              const state = workbench.getState();
              if (error.stop !== undefined) state.selectStop(error.stop);
              if (error.line !== undefined) state.revealPolicyLine(error.line);
            }}
          >
            <span className={styles.error}>
              {error.errorKind}
              {error.line !== undefined && ` line ${error.line}`}
            </span>{" "}
            {error.message}{" "}
            <span className={styles.muted}>
              {error.train && `${error.train} at ${error.station}, `}
              {formatGameTime(error.t)}
            </span>
          </button>
        </li>
      ))}
      {errors.length > shown.length && (
        <li className={styles.muted}>and {errors.length - shown.length} more</li>
      )}
    </ul>
  );
}
