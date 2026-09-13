import { Link } from "react-router";
import styles from "./Footer.module.css";

export const NON_AFFILIATION =
  "Regolith Rail is a fan-made tool. It is not affiliated with or endorsed by Paradox Interactive or Haemimont Games.";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <span>{NON_AFFILIATION}</span>
      <span>
        <Link to="/docs/about">About</Link>{" "}
        <span className={styles.version} data-testid="build-version">
          v{__APP_VERSION__} ({__APP_COMMIT__})
        </span>
      </span>
    </footer>
  );
}
