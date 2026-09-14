import type { ReactNode } from "react";
import { Link, NavLink } from "react-router";
import { docsHref } from "../lib/format.ts";
import { Footer } from "./Footer.tsx";
import styles from "./Page.module.css";

export function Page({
  children,
  actions,
  docsInPanel = false,
}: {
  children: ReactNode;
  actions?: ReactNode;
  /** Whether the Docs link opens the workbench's documentation panel instead of the docs pages. */
  docsInPanel?: boolean;
}) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          Regolith Rail
        </Link>
        <nav className={styles.nav} aria-label="Main">
          <NavLink to="/">Workbench</NavLink>
          {docsInPanel ? (
            <a href={docsHref("")} data-docs="" data-testid="nav-docs">
              Docs
            </a>
          ) : (
            <NavLink to="/docs" data-testid="nav-docs">
              Docs
            </NavLink>
          )}
        </nav>
        {actions}
      </header>
      <main className={styles.main}>{children}</main>
      <Footer />
    </div>
  );
}
