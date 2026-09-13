import { paramAnchor, type ReferencePage, referencePages } from "@regolith-rail/docs";
import {
  type ApiType,
  fieldAnchor,
  type Level,
  type OpsBlock,
  typeAnchor,
} from "@regolith-rail/policy-api";
import { InlineCode } from "./components.tsx";
import { DocLink } from "./DocLink.tsx";
import styles from "./docs.module.css";

function LevelBadge({ level }: { level: Level }) {
  return (
    <DocLink
      href="/docs/language#information-levels"
      className={styles.level}
      title={`Readable at the ${level} information level`}
    >
      {level}
    </DocLink>
  );
}

function ApiTypes({ types }: { types: ApiType[] }) {
  return (
    <>
      {types.map((type) => (
        <section key={type.name} className={styles.referenceType}>
          <h2 id={typeAnchor(type)}>{type.name}</h2>
          <p>
            <InlineCode text={type.summary} />
          </p>
          <dl className={styles.members}>
            {type.fields.map((field) => (
              <div key={field.name} id={fieldAnchor(type, field)} className={styles.member}>
                <dt>
                  <code className={styles.memberName}>{field.name}</code>{" "}
                  <code className={styles.type}>
                    {field.lua}
                    {field.optional ? "?" : ""}
                  </code>{" "}
                  <LevelBadge level={field.level} />
                </dt>
                <dd>
                  <p>
                    <InlineCode text={field.summary} />
                  </p>
                  {field.params && field.params.length > 0 && (
                    <ul>
                      {field.params.map((param) => (
                        <li key={param.name}>
                          <code>{param.name}</code> <code className={styles.type}>{param.lua}</code>{" "}
                          <InlineCode text={param.summary} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {field.returns && (
                    <p>
                      Returns <code className={styles.type}>{field.returns.lua}</code>:{" "}
                      <InlineCode text={field.returns.summary} />
                    </p>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </>
  );
}

const STAGES: { stage: OpsBlock["stage"]; label: string; text: string }[] = [
  { stage: "pipeline", label: "Pipeline", text: "Puts the stages together into a policy." },
  { stage: "classify", label: "Classify", text: "Gives each station a role for each resource." },
  { stage: "target", label: "Target", text: "Decides how much stock each station should have." },
  { stage: "plan", label: "Plan", text: "Looks further along the line before loading." },
  {
    stage: "allocate",
    label: "Allocate",
    text: "Shares limited train space between resources.",
  },
  { stage: "helper", label: "Helpers", text: "Functions to use inside your own stages." },
];

function OpsIndex() {
  const blocks = referencePages().flatMap((page) =>
    page.kind.type === "ops-block" ? [page.kind.block] : [],
  );
  return (
    <>
      <p>
        <code>ops.policy</code> runs these stages in order at every stop, then turns the result into
        load and unload actions. Only a target is required; each stage can be one of the blocks
        below or your own Lua function.
      </p>
      {STAGES.map(({ stage, label, text }) => (
        <section key={stage}>
          <h2 id={stage}>{label}</h2>
          <p>{text}</p>
          <ul className={styles.blockList}>
            {blocks
              .filter((block) => block.stage === stage)
              .map((block) => (
                <li key={block.name}>
                  <DocLink href={`/docs/${block.docs}`}>
                    <code>ops.{block.name}</code>
                  </DocLink>{" "}
                  <InlineCode text={block.summary} />
                </li>
              ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function OpsBlockReference({ block }: { block: OpsBlock }) {
  const call =
    block.stage === "helper"
      ? `ops.${block.name}(${block.params.map((p) => p.name).join(", ")})`
      : `ops.${block.name} { ${block.params.map((p) => `${p.name} = …`).join(", ")} }`;
  return (
    <>
      <p className={styles.blockMeta}>
        Stage{" "}
        <DocLink href={`/docs/ops#${block.stage}`}>
          <code>{block.stage}</code>
        </DocLink>{" "}
        · needs <LevelBadge level={block.level} />
      </p>
      <pre className={styles.signature}>
        <code>{call}</code>
      </pre>
      {block.params.length > 0 && (
        <>
          <h2 id="parameters">Parameters</h2>
          <dl className={styles.members}>
            {block.params.map((param) => (
              <div key={param.name} id={paramAnchor(param.name)} className={styles.member}>
                <dt>
                  <code className={styles.memberName}>{param.name}</code>{" "}
                  <code className={styles.type}>{param.lua}</code>{" "}
                  <span className={styles.required}>
                    {param.required ? "required" : "optional"}
                  </span>
                </dt>
                <dd>
                  <InlineCode text={param.summary} />
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </>
  );
}

export function Reference({ page }: { page: ReferencePage }) {
  switch (page.kind.type) {
    case "api":
      return <ApiTypes types={page.kind.types} />;
    case "ops-index":
      return <OpsIndex />;
    case "ops-block":
      return <OpsBlockReference block={page.kind.block} />;
  }
}
