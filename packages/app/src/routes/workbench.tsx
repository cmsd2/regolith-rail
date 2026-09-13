import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserSupport } from "../components/BrowserSupport.tsx";
import { ErrorList, useRunErrors } from "../components/ErrorList.tsx";
import { LineMap } from "../components/LineMap.tsx";
import { MetricsSummary } from "../components/MetricsSummary.tsx";
import { Page } from "../components/Page.tsx";
import { RunCharts } from "../components/RunCharts.tsx";
import { RunControls } from "../components/RunControls.tsx";
import { ScenarioControls } from "../components/ScenarioControls.tsx";
import { StopInspector } from "../components/StopInspector.tsx";
import { PlaybackControls, Timeline } from "../components/Timeline.tsx";
import styles from "../components/Workbench.module.css";
import { useWorkbench } from "../state/instance.ts";

// The editors bring in CodeMirror, so they load separately from the rest of the page.
const EditorPanel = lazy(() => import("../components/EditorPanel.tsx"));

export function meta() {
  return [{ title: "Regolith Rail" }];
}

type RunTab = "inspector" | "charts" | "metrics" | "errors";

function RunView() {
  const [tab, setTab] = useState<RunTab>("inspector");
  const errors = useRunErrors();
  const selectedStop = useWorkbench((s) => s.selectedStop);
  const hasOutput = useWorkbench((s) => s.run.output !== null);
  useEffect(() => {
    if (selectedStop !== null) setTab("inspector");
  }, [selectedStop]);
  const tabs: { id: RunTab; label: string }[] = [
    { id: "inspector", label: "Stop" },
    { id: "charts", label: "Charts" },
    { id: "metrics", label: "Metrics" },
    { id: "errors", label: errors.length > 0 ? `Errors (${errors.length})` : "Errors" },
  ];
  return (
    <>
      <LineMap />
      <Timeline />
      {hasOutput && (
        <>
          <div className={styles.tabs} role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                data-testid={`run-tab-${t.id}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className={styles.tabPanel} role="tabpanel">
            {tab === "inspector" && <StopInspector />}
            {tab === "charts" && <RunCharts />}
            {tab === "metrics" && <MetricsSummary />}
            {tab === "errors" && <ErrorList />}
          </div>
        </>
      )}
    </>
  );
}

export default function Workbench() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <Page>
      <BrowserSupport>
        <div className={styles.layout}>
          <div className={styles.toolbar}>
            <ScenarioControls />
            <RunControls />
            <PlaybackControls />
          </div>
          {mounted ? (
            <Suspense fallback={<div />}>
              <EditorPanel />
            </Suspense>
          ) : (
            <div />
          )}
          <div className={styles.views}>{mounted && <RunView />}</div>
        </div>
      </BrowserSupport>
    </Page>
  );
}
