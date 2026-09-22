import {
  APPENDICES,
  BOOK,
  capability,
  EVIDENCE_LEVELS,
  GAME,
  GAME_VERSION,
  isEvidenceLevel,
  isWritten,
  partNumeral,
  roadmapLink,
} from "@regolith-rail/docs";
import { POLICY_API_VERSION, starterScenarios } from "@regolith-rail/engine";
import { classicTemplates } from "@regolith-rail/scenario-kit";
import type { MDXComponents } from "mdx/types";
import { createContext, type ReactNode, useContext, useState } from "react";
import { useNavigate } from "react-router";
import { catalogueItem } from "../lib/catalogue.ts";
import { itemId } from "../lib/library.ts";
import { DocLink, DocsMode } from "./DocLink.tsx";
import styles from "./docs.module.css";
import { openExample } from "./open-example.ts";
import { openPolicy, openScenario } from "./open-scenario.ts";

const scenarioTitle = (id: string) =>
  classicTemplates.find((t) => t.name === id)?.title ??
  (starterScenarios.find((s) => s.id === id)?.document as { title?: string } | undefined)?.title ??
  id;

/** The slug of the documentation page being shown, so examples know where they are. */
export const DocPage = createContext("");

/** A runnable example, wrapped around its highlighted code by the MDX build. */
export function Example({
  source,
  scenario,
  seed,
  kind = "policy",
  children,
}: {
  source: string;
  scenario: string;
  seed: string;
  kind?: string;
  children?: ReactNode;
}) {
  const script = kind === "script";
  const mode = useContext(DocsMode);
  const page = useContext(DocPage);
  const navigate = useNavigate();
  const [opened, setOpened] = useState(false);
  return (
    <figure className={styles.example} data-testid="example">
      {children}
      <figcaption>
        <span>
          {script ? (
            "A scenario script"
          ) : (
            <>
              Runs on <em>{scenarioTitle(scenario)}</em>, seed {seed}
            </>
          )}
        </span>
        <button
          type="button"
          onClick={() =>
            void openExample(
              { source, kind: script ? "script" : "policy", scenario, seed: Number(seed), page },
              mode,
              navigate,
            ).then(() => setOpened(true))
          }
          data-testid="open-example"
        >
          {opened && mode === "panel" ? "Opened in editor" : "Open in editor"}
        </button>
      </figcaption>
    </figure>
  );
}

/** States which game version a statement about game behaviour refers to, and how it is known. */
export function Evidence({ level }: { level: string }) {
  const known = isEvidenceLevel(level);
  return (
    <p className={styles.evidence} data-testid="evidence" data-level={level}>
      <span>
        {GAME} {GAME_VERSION}
      </span>
      <span>
        Evidence:{" "}
        <DocLink
          href="/docs/game-mechanics#evidence-levels"
          title={known ? EVIDENCE_LEVELS[level] : undefined}
        >
          {known ? level : `unknown (${level})`}
        </DocLink>
      </span>
    </p>
  );
}

export function Callout({ children, kind = "note" }: { children: ReactNode; kind?: string }) {
  return <aside className={`${styles.callout} ${styles[kind] ?? ""}`}>{children}</aside>;
}

/** The version and commit of the site being read. */
export function BuildInfo() {
  return (
    <p data-testid="docs-build-version">
      Version {__APP_VERSION__}, built from commit <code>{__APP_COMMIT__}</code>, Policy API version{" "}
      {POLICY_API_VERSION}.
    </p>
  );
}

interface ResolvedCheck {
  ref: string;
  kind?: string;
  label?: string;
  file?: string;
  source?: string;
  error?: string;
}

/** What one check is, where it lives and, for Maxima and Python checks, the code. */
function CheckBody({
  label,
  file,
  source,
}: {
  label?: string | undefined;
  file?: string | undefined;
  source?: string | undefined;
}) {
  return (
    <>
      <p className={styles.checkLabel}>
        {label}
        {file && (
          <>
            , in <code>{file}</code>
          </>
        )}
      </p>
      {source && (
        <pre className={styles.checkSource}>
          <code>{source}</code>
        </pre>
      )}
    </>
  );
}

const parseChecks = (json: string): ResolvedCheck[] => {
  try {
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) ? (parsed as ResolvedCheck[]) : [];
  } catch {
    return [];
  }
};

/**
 * The check behind a claim, filled in at build time: what it is, where it lives and, for Maxima
 * and Python checks, the code that verifies it. A grouped check, which covers a derivation, lists
 * each of its checks under one disclosure.
 */
export function Check({
  ref: reference,
  refs,
  checks,
  kind,
  label,
  file,
  source,
  error,
}: {
  ref?: string;
  refs?: string;
  checks?: string;
  kind?: string;
  label?: string;
  file?: string;
  source?: string;
  error?: string;
}) {
  if (refs !== undefined) {
    const all = parseChecks(checks ?? "[]");
    const failed = all.filter((c) => c.error);
    if (failed.length > 0) {
      return (
        <p className={styles.checkError} data-testid="check" data-check={refs}>
          Unresolved check: {failed.map((c) => c.error).join("; ")}
        </p>
      );
    }
    return (
      <details className={styles.check} data-testid="check" data-check={refs} data-kind="group">
        <summary>Checks ({all.length})</summary>
        {all.map((c) => (
          <div key={c.ref} data-check={c.ref} data-kind={c.kind}>
            <CheckBody label={c.label} file={c.file} source={c.source} />
          </div>
        ))}
      </details>
    );
  }
  if (error) {
    return (
      <p className={styles.checkError} data-testid="check" data-check={reference}>
        Unresolved check: {error}
      </p>
    );
  }
  return (
    <details className={styles.check} data-testid="check" data-check={reference} data-kind={kind}>
      <summary>Check</summary>
      <CheckBody label={label} file={file} source={source} />
    </details>
  );
}

/** An exercise's answer, hidden until the reader asks for it. */
export function Answer({ children }: { children: ReactNode }) {
  return (
    <details className={styles.answer} data-testid="answer">
      <summary>Answer</summary>
      {children}
    </details>
  );
}

/**
 * A scenario or template named in a chapter's text, which opens in the workbench with the policy the
 * book starts it from when clicked.
 */
export function ScenarioLink({
  starter,
  template,
  children,
}: {
  starter?: string;
  template?: string;
  children: ReactNode;
}) {
  const mode = useContext(DocsMode);
  const navigate = useNavigate();
  const id = starter
    ? itemId("builtin", "scenario", starter)
    : itemId("classic", "scenario", template ?? "");
  const name = catalogueItem(id)?.name ?? id;
  return (
    <button
      type="button"
      className={styles.scenarioLink}
      title={`Open ${name} in the workbench, ${template ? "with its reference policy" : "with the balancing baseline"}`}
      onClick={() => void openScenario(id, mode, navigate)}
      data-testid="scenario-link"
      data-item-id={id}
    >
      {children}
    </button>
  );
}

/** A built-in policy named in a chapter's text, which goes into the workbench's Policy slot when clicked. */
export function PolicyLink({ policy, children }: { policy: string; children: ReactNode }) {
  const mode = useContext(DocsMode);
  const navigate = useNavigate();
  const id = itemId("builtin", "policy", policy);
  return (
    <button
      type="button"
      className={styles.scenarioLink}
      title={`Put the built-in ${policy} policy in the workbench's run`}
      onClick={() => void openPolicy(id, mode, navigate)}
      data-testid="policy-link"
      data-item-id={id}
    >
      {children}
    </button>
  );
}

/** A chapter's scenario, with an action that opens it in the workbench ready to run. */
export function Scenario({ starter, template }: { starter?: string; template?: string }) {
  const mode = useContext(DocsMode);
  const navigate = useNavigate();
  const [opened, setOpened] = useState(false);
  const id = starter
    ? itemId("builtin", "scenario", starter)
    : itemId("classic", "scenario", template ?? "");
  const item = catalogueItem(id);
  return (
    <figure className={styles.scenario} data-testid="chapter-scenario" data-item-id={id}>
      <figcaption>
        <span>
          Scenario: <strong>{item?.name ?? id}</strong>
          {template ? ", with its reference policy" : ", with the balancing baseline"}
        </span>
        <button
          type="button"
          onClick={() => void openScenario(id, mode, navigate).then(() => setOpened(true))}
          data-testid="open-scenario"
        >
          {opened && mode === "panel" ? "Opened in workbench" : "Open in workbench"}
        </button>
      </figcaption>
    </figure>
  );
}

/** A chapter's side note connecting its topic to rail lines in the game, set apart from the main text. */
export function GameNote({ children }: { children: ReactNode }) {
  return (
    <aside className={styles.gameNote} aria-label="On the rail line" data-testid="game-note">
      <p className={styles.gameNoteLabel}>On the rail line</p>
      {children}
    </aside>
  );
}

/**
 * An example the simulator cannot run yet. It says what the run would show, and names the
 * capability it waits for with a link to the roadmap.
 */
export function Placeholder({ needs, children }: { needs: string; children: ReactNode }) {
  const known = capability(needs);
  return (
    <aside
      className={styles.placeholder}
      aria-label="Waiting for the simulator"
      data-testid="placeholder"
      data-needs={needs}
    >
      <p className={styles.gameNoteLabel}>Waiting for the simulator</p>
      {children}
      <p className={styles.placeholderNeeds}>
        This run needs {known ? known.needs : `an unknown capability (${needs})`}. See the{" "}
        <a href={roadmapLink(needs)}>roadmap</a>.
      </p>
    </aside>
  );
}

/**
 * What a chapter's model predicts beside what the simulator measured, as a table, with the checks
 * that verify both.
 */
export function Predicted({ children }: { children: ReactNode }) {
  return (
    <figure className={styles.predicted} data-testid="predicted">
      <figcaption className={styles.gameNoteLabel}>Model and simulation</figcaption>
      {children}
    </figure>
  );
}

/** The book's parts and chapters, with chapters not yet written marked as coming later. */
export function BookContents() {
  return (
    <ol className={styles.bookContents} data-testid="book-contents">
      {BOOK.map((part) => (
        <li key={part.part} data-testid={`book-part-${part.part}`}>
          <h2>
            Part {partNumeral(part.part)}: {part.title}
            {!isWritten(part) && <span className={styles.coming}> (coming later)</span>}
          </h2>
          <ol start={part.chapters[0]?.chapter}>
            {part.chapters.map((c) => (
              <li key={c.chapter}>
                {c.slug ? (
                  <DocLink href={`/docs/${c.slug}`}>{c.title}</DocLink>
                ) : (
                  <span className={styles.coming}>{c.title}</span>
                )}
              </li>
            ))}
          </ol>
        </li>
      ))}
      <li data-testid="book-appendices">
        <h2>Appendices</h2>
        <ol>
          {APPENDICES.map((a) => (
            <li key={a.letter} className={styles.appendix}>
              <DocLink href={`/docs/${a.slug}`}>
                {a.letter}. {a.title}
              </DocLink>
            </li>
          ))}
        </ol>
      </li>
    </ol>
  );
}

export const mdxComponents: MDXComponents = {
  a: DocLink,
  Answer,
  BookContents,
  BuildInfo,
  Check,
  Example,
  GameNote,
  Placeholder,
  PolicyLink,
  Predicted,
  Scenario,
  ScenarioLink,
  Evidence,
  Callout,
};

/** Renders text with `code` spans, as used in reference summaries. */
export function InlineCode({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/).map((part, i) =>
        part.startsWith("`") && part.endsWith("`") ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: parts of a fixed string never reorder.
          <code key={i}>{part.slice(1, -1)}</code>
        ) : (
          part
        ),
      )}
    </>
  );
}
