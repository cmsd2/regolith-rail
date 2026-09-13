import { type ReactNode, useEffect, useState } from "react";
import styles from "./Workbench.module.css";

/** Names of the browser features the workbench needs that are missing. */
export function missingFeatures(scope: Record<string, unknown> = globalThis as never): string[] {
  const missing: string[] = [];
  if (typeof scope.WebAssembly !== "object") missing.push("WebAssembly");
  if (typeof scope.Worker !== "function") missing.push("Web Workers");
  else if (!supportsModuleWorkers(scope)) missing.push("module workers");
  if (typeof scope.CompressionStream !== "function") missing.push("CompressionStream");
  return missing;
}

function supportsModuleWorkers(scope: Record<string, unknown>): boolean {
  let supported = false;
  try {
    const WorkerType = scope.Worker as typeof Worker;
    const options = {
      get type() {
        supported = true;
        return "module" as const;
      },
    };
    new WorkerType("data:text/javascript,", options).terminate();
  } catch {
    // Constructing can fail for unrelated reasons; the getter tells us what we need.
  }
  return supported;
}

export function BrowserSupport({ children }: { children: ReactNode }) {
  const [missing, setMissing] = useState<string[]>([]);
  useEffect(() => setMissing(missingFeatures()), []);
  if (missing.length === 0) return children;
  return (
    <div className={styles.unsupported} role="alert" data-testid="unsupported-browser">
      <h2>This browser can't run the workbench</h2>
      <p>It is missing: {missing.join(", ")}.</p>
      <p>Use a current version of Chrome, Edge, Firefox or Safari.</p>
    </div>
  );
}
