import { type ComponentProps, createContext, useContext } from "react";
import { Link } from "react-router";
import { docsHref } from "../lib/format.ts";

/** Whether documentation is shown as a standalone page or in the workbench panel. */
export const DocsMode = createContext<"page" | "panel">("page");

const DOCS_PATH = /^\/docs(?:\/([^#?]*))?(#.*)?$/;

/**
 * A link in documentation. Standalone pages navigate normally; in the panel,
 * documentation links carry `data-docs` so the workbench opens them in place.
 */
export function DocLink({ href = "", children, ...rest }: ComponentProps<"a">) {
  const mode = useContext(DocsMode);
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) {
    return (
      <a href={href} target="_blank" rel="noreferrer" {...rest}>
        {children}
      </a>
    );
  }
  if (href.startsWith("#")) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  }
  const docs = DOCS_PATH.exec(href);
  if (docs && mode === "panel") {
    const target = `${(docs[1] ?? "").replace(/\/$/, "")}${docs[2] ?? ""}`;
    return (
      <a href={docsHref(target)} data-docs={target} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link to={href} {...rest}>
      {children}
    </Link>
  );
}
