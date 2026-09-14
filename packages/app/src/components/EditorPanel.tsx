import { json } from "@codemirror/lang-json";
import { useMemo, useState } from "react";
import { formatSource } from "../editor/format.ts";
import { scenarioExtensions } from "../editor/json.ts";
import { luaPolicyExtensions } from "../editor/lua.ts";
import { scenarioScriptExtensions } from "../editor/scenario-script.ts";
import { documentText } from "../lib/scenario-source.ts";
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
  const kind = useWorkbench((s) => s.scenario.kind);
  const source = useWorkbench((s) => s.scenario.source);
  const setSource = useWorkbench((s) => s.setScenarioSource);
  const jsonExtensions = useMemo(
    () => scenarioExtensions(() => workbench.getState().scenario.errors),
    [],
  );
  const scriptExtensions = useMemo(
    () =>
      scenarioScriptExtensions(
        (text) => checker.check(text),
        (text) => checker.loadScript(text),
      ),
    [],
  );
  return (
    <CodeEditor
      // A new editor for each kind, since their languages and checks differ.
      key={kind}
      value={source}
      onChange={setSource}
      extensions={kind === "script" ? scriptExtensions : jsonExtensions}
      label={kind === "script" ? "Scenario script" : "Scenario JSON"}
      testId="scenario-editor"
    />
  );
}

function EvaluatedDocument() {
  const scenario = useWorkbench((s) => s.scenario.scenario);
  const extensions = useMemo(() => [json()], []);
  if (!scenario) {
    return <p className={styles.note}>The script has no valid document to show yet.</p>;
  }
  return (
    <CodeEditor
      value={documentText(scenario)}
      onChange={() => {}}
      extensions={extensions}
      label="Evaluated scenario document"
      readOnly
      testId="scenario-evaluated"
    />
  );
}

function ScenarioToolbar({
  evaluated,
  setEvaluated,
}: {
  evaluated: boolean;
  setEvaluated(value: boolean): void;
}) {
  const kind = useWorkbench((s) => s.scenario.kind);
  const status = useWorkbench((s) => s.scenario.status);
  const valid = useWorkbench((s) => s.scenario.scenario !== null);
  const setKind = useWorkbench((s) => s.setScenarioKind);
  const convertTitle = valid ? undefined : "Fix the scenario errors before converting it";
  return (
    <div className={styles.scenarioToolbar}>
      <fieldset aria-label="Scenario format" className={styles.segmented}>
        <button
          type="button"
          aria-pressed={kind === "script"}
          disabled={kind !== "script" && !valid}
          title={
            kind === "script" ? undefined : (convertTitle ?? "Convert to an equivalent script")
          }
          onClick={() => setKind("script")}
          data-testid="scenario-kind-script"
        >
          Script
        </button>
        <button
          type="button"
          aria-pressed={kind === "json"}
          disabled={kind !== "json" && !valid}
          title={kind === "json" ? undefined : (convertTitle ?? "Convert to its JSON document")}
          onClick={() => {
            setEvaluated(false);
            setKind("json");
          }}
          data-testid="scenario-kind-json"
        >
          JSON
        </button>
      </fieldset>
      {kind === "script" && (
        <label>
          <input
            type="checkbox"
            checked={evaluated}
            onChange={(e) => setEvaluated(e.target.checked)}
            data-testid="scenario-evaluated-toggle"
          />{" "}
          Show evaluated document
        </label>
      )}
      {status === "evaluating" && (
        <span className={styles.muted} data-testid="scenario-evaluating">
          Evaluating…
        </span>
      )}
    </div>
  );
}

/** Formats the Lua in the open editor, and says why when it cannot. */
function FormatButton({ evaluated }: { evaluated: boolean }) {
  const tab = useWorkbench((s) => s.editorTab);
  const kind = useWorkbench((s) => s.scenario.kind);
  const [state, setState] = useState<{ busy: boolean; message: string | null }>({
    busy: false,
    message: null,
  });
  const lua = tab === "policy" || (kind === "script" && !evaluated);
  async function format() {
    setState({ busy: true, message: null });
    const current = workbench.getState();
    const source = tab === "policy" ? current.policy.source : current.scenario.source;
    const result = await formatSource(source);
    if (result.ok && result.source !== source) {
      // Apply it only if nothing was typed while the formatter loaded.
      const latest = workbench.getState();
      if (tab === "policy" && latest.policy.source === source)
        latest.setPolicySource(result.source);
      if (tab === "scenario" && latest.scenario.source === source) {
        latest.setScenarioSource(result.source);
      }
    }
    setState({ busy: false, message: result.ok ? null : result.message });
  }
  return (
    <span className={styles.format}>
      {state.message && (
        <span className={styles.formatError} role="status" data-testid="format-error">
          {state.message}
        </span>
      )}
      <button
        type="button"
        onClick={format}
        disabled={!lua || state.busy}
        title={lua ? "Lay out the Lua at 80 columns with StyLua" : "Only Lua can be formatted"}
        data-testid="format-lua"
      >
        {state.busy ? "Formatting…" : "Format"}
      </button>
    </span>
  );
}

function ScenarioErrors() {
  const errors = useWorkbench((s) => s.scenario.errors);
  if (errors.length === 0) return null;
  return (
    <ul className={styles.errors} data-testid="scenario-errors" aria-label="Scenario errors">
      {errors.map((error) => (
        <li key={`${error.line}:${error.path}:${error.message}`}>
          {error.line !== undefined && <span>Line {error.line}: </span>}
          {error.path !== undefined && <code>{error.path}</code>} {error.message}
        </li>
      ))}
    </ul>
  );
}

export default function EditorPanel() {
  const tab = useWorkbench((s) => s.editorTab);
  const policyName = useWorkbench((s) => s.policy.name);
  const errorCount = useWorkbench((s) => s.scenario.errors.length);
  const kind = useWorkbench((s) => s.scenario.kind);
  const setTab = useWorkbench((s) => s.setEditorTab);
  const [evaluated, setEvaluated] = useState(false);
  const showEvaluated = evaluated && kind === "script";
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
        <FormatButton key={tab} evaluated={showEvaluated} />
      </div>
      <div className={styles.body} hidden={tab !== "policy"}>
        <PolicyEditor />
      </div>
      <div className={styles.body} hidden={tab !== "scenario"}>
        <ScenarioToolbar evaluated={evaluated} setEvaluated={setEvaluated} />
        {showEvaluated ? <EvaluatedDocument /> : <ScenarioEditor />}
        <ScenarioErrors />
      </div>
    </section>
  );
}
