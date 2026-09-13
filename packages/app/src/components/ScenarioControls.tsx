import { starterScenarios } from "@regolith-rail/engine";
import {
  type ClassicTemplate,
  type ConstructParam,
  classicTemplates,
  constructs,
  type TemplateValue,
} from "@regolith-rail/scenario-kit";
import { useEffect, useState } from "react";
import { docsHref } from "../lib/format.ts";
import type { ModReadiness } from "../lib/mod-ready.ts";
import { findTemplate } from "../lib/scenario-source.ts";
import { checker, useWorkbench, workbench } from "../state/instance.ts";
import styles from "./EditorPanel.module.css";

const DURATION_UNITS: Record<string, number> = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
  sols: 86_400_000,
  weeks: 604_800_000,
};

/** The unit a duration parameter's form field uses, from how its default is written. */
function durationUnit(param: ConstructParam): string {
  const helper = /^(\w+)\(/.exec(param.default ?? "")?.[1];
  return helper && helper in DURATION_UNITS ? helper : "hours";
}

function ParamField({
  template,
  param,
  value,
}: {
  template: ClassicTemplate;
  param: ConstructParam;
  value: TemplateValue | undefined;
}) {
  const set = (next: TemplateValue) =>
    workbench.getState().setTemplateParams({ [param.name]: next });
  const id = `param-${template.name}-${param.name}`;
  const label = param.name.replace(/_/g, " ");
  const testId = `template-param-${param.name}`;
  const choices = /^"(\w+)"\|"(\w+)"$/.exec(param.type);
  if (param.type === "boolean") {
    return (
      <label title={param.summary}>
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => set(e.target.checked)}
          data-testid={testId}
        />{" "}
        {label}
      </label>
    );
  }
  if (choices) {
    return (
      <label title={param.summary}>
        {label}{" "}
        <select value={String(value)} onChange={(e) => set(e.target.value)} data-testid={testId}>
          {choices.slice(1).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
    );
  }
  if (typeof value !== "number") {
    return (
      <span className={styles.muted} title={param.summary}>
        {label}: set in the script
      </span>
    );
  }
  const unit = param.unit === "ms" ? durationUnit(param) : undefined;
  const scale = unit ? (DURATION_UNITS[unit] as number) : 1;
  const whole = param.type === "integer" && !unit;
  return (
    <label htmlFor={id} title={param.summary}>
      {label}{" "}
      <input
        id={id}
        type="number"
        value={value / scale}
        min={param.range?.[0] ?? 0}
        max={param.range?.[1]}
        step={whole ? 1 : "any"}
        onChange={(e) => {
          const number = Number(e.target.value);
          if (e.target.value === "" || !Number.isFinite(number)) return;
          const [low, high] = param.range ?? [0, Number.POSITIVE_INFINITY];
          if (number < low || number > high) return;
          set(unit ? Math.round(number * scale) : whole ? Math.round(number) : number);
        }}
        data-testid={testId}
      />{" "}
      {unit ?? (param.unit && param.unit !== "ms" ? param.unit : "")}
    </label>
  );
}

function TemplateForm() {
  const selected = useWorkbench((s) => s.scenario.template);
  const template = selected && findTemplate(selected.name);
  if (!selected || !template) return null;
  const construct = constructs.find((c) => c.name === template.name);
  return (
    <fieldset className={styles.params} data-testid="template-params">
      <legend className={styles.muted}>{template.title} parameters</legend>
      {construct?.params.map((param) => (
        <ParamField
          key={param.name}
          template={template}
          param={param}
          value={selected.params[param.name]}
        />
      ))}
    </fieldset>
  );
}

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

export function ScenarioControls() {
  const starterId = useWorkbench((s) => s.scenario.starterId);
  const template = useWorkbench((s) => s.scenario.template?.name);
  const seed = useWorkbench((s) => s.seed);
  const saveReloadTest = useWorkbench((s) => s.saveReloadTest);
  const { selectStarter, selectTemplate, setSeed, setSaveReloadTest } = workbench.getState();
  const starter = starterScenarios.find((s) => s.id === starterId)?.document as
    | { description?: string; docs?: string }
    | undefined;
  const templateDocs = template && constructs.find((c) => c.name === template)?.docs;
  const value = starterId ?? template ?? "";
  return (
    <>
      <div className={styles.controls}>
        <label>
          Scenario{" "}
          <select
            value={value}
            onChange={(e) => {
              const next = e.target.value;
              if (findTemplate(next)) selectTemplate(next);
              else if (next) selectStarter(next);
            }}
            data-testid="scenario-picker"
          >
            {value === "" && <option value="">Custom</option>}
            <optgroup label="Surviving Mars">
              {starterScenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {(s.document as { title: string }).title}
                </option>
              ))}
            </optgroup>
            <optgroup label="Classic problems">
              {classicTemplates.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.title}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        {starter?.docs && (
          <a
            href={docsHref(starter.docs)}
            data-docs={starter.docs}
            title={starter.description}
            data-testid="scenario-docs"
          >
            Why it fails
          </a>
        )}
        {templateDocs && (
          <a href={docsHref(templateDocs)} data-docs={templateDocs} data-testid="scenario-docs">
            About this problem
          </a>
        )}
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
      <TemplateForm />
    </>
  );
}
