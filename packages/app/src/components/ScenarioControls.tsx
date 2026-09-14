import { useEffect, useState } from "react";
import type { ModReadiness } from "../lib/mod-ready.ts";
import { checker, useWorkbench, workbench } from "../state/instance.ts";
import styles from "./EditorPanel.module.css";

/** Whether the policy and scenario could run in the game, and what stops them. */
function ModReadyStatus() {
  const source = useWorkbench((s) => s.policy.source);
  const scenario = useWorkbench((s) => s.scenario.scenario);
  const [status, setStatus] = useState<ModReadiness | null>(null);
  useEffect(() => {
    if (!scenario) {
      setStatus(null);
      return;
    }
    let current = true;
    const timer = setTimeout(() => {
      checker.modReady(source, scenario).then(
        (result) => current && setStatus(result),
        () => current && setStatus(null),
      );
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [source, scenario]);
  if (!status) return null;
  const reasons = status.reasons.join("; ");
  return (
    <span
      className={styles.modReady}
      data-ready={status.ready}
      title={
        status.ready
          ? "This policy and scenario use only what the game offers, so the policy could run in a mod."
          : `Not mod-ready: ${reasons}`
      }
      data-testid="mod-ready"
    >
      {status.ready ? "Mod-ready" : `Not mod-ready: ${reasons}`}
    </span>
  );
}

/** Run options for the current slots: the seed, the save and reload test, and whether it is mod-ready. */
export function ScenarioControls() {
  const seed = useWorkbench((s) => s.seed);
  const saveReloadTest = useWorkbench((s) => s.saveReloadTest);
  const { setSeed, setSaveReloadTest } = workbench.getState();
  return (
    <div className={styles.controls}>
      <label>
        Seed{" "}
        <input
          type="number"
          min={0}
          step={1}
          value={seed}
          onChange={(e) => setSeed(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          className={styles.seed}
          data-testid="seed"
        />
      </label>
      <label title="Reload the policy at random stops, keeping only memory, as a saved game would">
        <input
          type="checkbox"
          checked={saveReloadTest}
          onChange={(e) => setSaveReloadTest(e.target.checked)}
        />{" "}
        Save and reload test
      </label>
      <ModReadyStatus />
    </div>
  );
}
