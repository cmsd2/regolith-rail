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
import { DocLink, DocsMode } from "./DocLink.tsx";
import styles from "./docs.module.css";
import { openExample } from "./open-example.ts";

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
  BookContents,
  BuildInfo,
  Example,
  GameNote,
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
