import { useMemo } from "react";
import { scenarioExtensions } from "../editor/json.ts";
import { luaPolicyExtensions } from "../editor/lua.ts";
import { checker, useWorkbench, workbench } from "../state/instance.ts";
import { CodeEditor } from "./CodeEditor.tsx";
import styles from "./EditorPanel.module.css";

function PolicyEditor() {
  const source = useWorkbench((s) => s.policy.source);
  const reveal = useWorkbench((s) => s.reveal);
  const setSource = useWorkbench((s) => s.setPolicySource);
  const extensions = useMemo(() => luaPolicyExtensions((text) => checker.check(text)), []);
  return (
    <CodeEditor
      value={source}
      onChange={setSource}
      extensions={extensions}
      label="Policy source"
      reveal={reveal}
      testId="policy-editor"
    />
  );
}

function ScenarioEditor() {
  const text = useWorkbench((s) => s.scenario.text);
  const setText = useWorkbench((s) => s.setScenarioText);
  const extensions = useMemo(
    () => scenarioExtensions(() => workbench.getState().scenario.errors),
    [],
  );
  return (
    <CodeEditor
      value={text}
      onChange={setText}
      extensions={extensions}
      label="Scenario JSON"
      testId="scenario-editor"
    />
  );
}

function ScenarioErrors() {
  const errors = useWorkbench((s) => s.scenario.errors);
  if (errors.length === 0) return null;
  return (
    <ul className={styles.errors} data-testid="scenario-errors" aria-label="Scenario errors">
      {errors.map((error) => (
        <li key={`${error.path}:${error.message}`}>
          <code>{error.path}</code> {error.message}
        </li>
      ))}
    </ul>
  );
}

export default function EditorPanel() {
  const tab = useWorkbench((s) => s.editorTab);
  const policyName = useWorkbench((s) => s.policy.name);
  const errorCount = useWorkbench((s) => s.scenario.errors.length);
  const setTab = useWorkbench((s) => s.setEditorTab);
  return (
    <section className={styles.panel} aria-label="Editors">
      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "policy"}
          onClick={() => setTab("policy")}
          data-testid="tab-policy"
        >
          Policy <span className={styles.muted}>{policyName}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "scenario"}
          onClick={() => setTab("scenario")}
          data-testid="tab-scenario"
        >
          Scenario {errorCount > 0 && <span className={styles.badge}>{errorCount}</span>}
        </button>
      </div>
      <div className={styles.body} hidden={tab !== "policy"}>
        <PolicyEditor />
      </div>
      <div className={styles.body} hidden={tab !== "scenario"}>
        <ScenarioEditor />
        <ScenarioErrors />
      </div>
    </section>
  );
}
