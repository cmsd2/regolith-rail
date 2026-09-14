import {
  BOOK,
  EVIDENCE_LEVELS,
  GAME,
  GAME_VERSION,
  isEvidenceLevel,
  isWritten,
  partNumeral,
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
import { openScenario } from "./open-scenario.ts";

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

/**
 * The check behind a claim, filled in at build time: what it is, where it lives and, for Maxima
 * and Python checks, the code that verifies it.
 */
export function Check({
  ref: reference,
  kind,
  label,
  file,
  source,
  error,
}: {
  ref: string;
  kind?: string;
  label?: string;
  file?: string;
  source?: string;
  error?: string;
}) {
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
          {template ? ", with its reference policy" : ", with the naive baseline"}
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
  Scenario,
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
