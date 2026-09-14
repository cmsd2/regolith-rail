import { useEffect, useRef, useState } from "react";
import { encodeShare, lengthWarning, sameShare, toShareState } from "../lib/share.ts";
import { workbench } from "../state/instance.ts";
import styles from "./Workbench.module.css";

export function ShareControls() {
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // The link describes the work when it was made, so it closes when the work changes. A
  // scenario finishing evaluation is not a change: the link carries its source, not the result.
  useEffect(() => {
    if (link === null) return;
    const initial = workbench.getState();
    return workbench.subscribe((s) => {
      if (!sameShare(s, initial)) setLink(null);
    });
  }, [link]);

  useEffect(() => {
    if (link !== null) input.current?.select();
  }, [link]);

  async function share() {
    const hash = await encodeShare(toShareState(workbench.getState(), __APP_VERSION__));
    const { origin, pathname, search } = window.location;
    setLink(`${origin}${pathname}${search}${hash}`);
    setCopied(false);
  }

  async function copy() {
    if (link === null) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      input.current?.select();
    }
  }

  const warning = link === null ? null : lengthWarning(link);
  return (
    <div className={styles.share}>
      <button
        type="button"
        onClick={() => void share()}
        title="Make a link to this policy and scenario"
        data-testid="share"
      >
        Share link
      </button>
      {link !== null && (
        <div className={styles.sharePopover} role="dialog" aria-label="Share link">
          <p className={styles.muted}>
            Anyone with this link sees your policy and scenario. It isn't stored on any server.
          </p>
          <div className={styles.shareRow}>
            <input ref={input} readOnly value={link} aria-label="Link" data-testid="share-link" />
            <button type="button" onClick={() => void copy()} data-testid="share-copy">
              {copied ? "Copied" : "Copy"}
            </button>
            <button type="button" onClick={() => setLink(null)} aria-label="Close">
              ×
            </button>
          </div>
          {warning && (
            <p className={styles.warning} data-testid="share-length-warning">
              {warning}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
