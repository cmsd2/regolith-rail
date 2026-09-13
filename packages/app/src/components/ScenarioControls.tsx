import { starterScenarios } from "@regolith-rail/engine";
import { useWorkbench, workbench } from "../state/instance.ts";
import styles from "./EditorPanel.module.css";

export function ScenarioControls() {
  const starterId = useWorkbench((s) => s.scenario.starterId);
  const seed = useWorkbench((s) => s.seed);
  const saveReloadTest = useWorkbench((s) => s.saveReloadTest);
  const { selectStarter, setSeed, setSaveReloadTest } = workbench.getState();
  return (
    <div className={styles.controls}>
      <label>
        Scenario{" "}
        <select
          value={starterId ?? ""}
          onChange={(e) => e.target.value && selectStarter(e.target.value)}
          data-testid="scenario-picker"
        >
          {starterId === null && <option value="">Custom</option>}
          {starterScenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {(s.document as { title: string }).title}
            </option>
          ))}
        </select>
      </label>
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
    </div>
  );
}
