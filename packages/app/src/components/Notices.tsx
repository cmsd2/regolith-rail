import { useWorkbench } from "../state/instance.ts";
import styles from "./Workbench.module.css";

export function Notices() {
  const notices = useWorkbench((s) => s.notices);
  const dismiss = useWorkbench((s) => s.dismissNotice);
  if (notices.length === 0) return null;
  return (
    <ul className={styles.notices} aria-label="Notices">
      {notices.map((notice) => (
        <li
          key={notice.id}
          className={styles[`notice-${notice.kind}`]}
          role={notice.kind === "error" ? "alert" : "status"}
          data-testid={`notice-${notice.topic}`}
        >
          <span>{notice.message}</span>
          <button type="button" onClick={() => dismiss(notice.id)} aria-label="Dismiss notice">
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}
