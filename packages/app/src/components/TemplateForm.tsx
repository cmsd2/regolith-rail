import {
  type ClassicTemplate,
  type ConstructParam,
  constructs,
  type TemplateValue,
} from "@regolith-rail/scenario-kit";
import { findTemplate } from "../lib/scenario-source.ts";
import { useWorkbench, workbench } from "../state/instance.ts";
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

/** The classic template's parameters, when the Scenario slot holds one. */
export function TemplateForm() {
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
