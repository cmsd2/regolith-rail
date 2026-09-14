import { formatPercent } from "../lib/format.ts";
import { useWorkbench } from "../state/instance.ts";
import styles from "./Workbench.module.css";

export function RunControls() {
  const status = useWorkbench((s) => s.run.status);
  const progress = useWorkbench((s) => s.run.progress);
  const error = useWorkbench((s) => s.run.error);
  const valid = useWorkbench((s) => s.scenario.scenario !== null);
  const evaluating = useWorkbench((s) => s.scenario.status === "evaluating");
  const startRun = useWorkbench((s) => s.startRun);
  const cancelRun = useWorkbench((s) => s.cancelRun);
  const running = status === "running";
  return (
    <div className={styles.runControls}>
      {running ? (
        <button type="button" onClick={cancelRun} data-testid="cancel">
          Cancel
        </button>
      ) : (
        <button
          type="button"
          className={styles.primary}
          onClick={() => void startRun()}
          disabled={!valid}
          title={
            valid
              ? "Run the policy on this scenario and seed"
              : evaluating
                ? "Evaluating the scenario script"
                : "Fix the scenario errors first"
          }
          data-testid="run"
        >
          Run
        </button>
      )}
      {running && (
        <progress value={progress} max={1} aria-label="Run progress" data-testid="run-progress">
          {formatPercent(progress)}
        </progress>
      )}
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
