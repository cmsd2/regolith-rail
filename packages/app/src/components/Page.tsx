import type { ReactNode } from "react";
import { Link, NavLink } from "react-router";
import { Footer } from "./Footer.tsx";
import styles from "./Page.module.css";

export function Page({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          Regolith Rail
        </Link>
        <nav className={styles.nav} aria-label="Main">
          <NavLink to="/">Workbench</NavLink>
          <NavLink to="/docs">Docs</NavLink>
        </nav>
        {actions}
      </header>
      <main className={styles.main}>{children}</main>
      <Footer />
    </div>
  );
}
