import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserSupport } from "../components/BrowserSupport.tsx";
import { ErrorList, useRunErrors } from "../components/ErrorList.tsx";
import { LibraryExplorer } from "../components/LibraryExplorer.tsx";
import { LineMap } from "../components/LineMap.tsx";
import { MetricsSummary } from "../components/MetricsSummary.tsx";
import { Notices } from "../components/Notices.tsx";
import { Page } from "../components/Page.tsx";
import { ReviewInspector } from "../components/ReviewInspector.tsx";
import { RunCharts } from "../components/RunCharts.tsx";
import { RunControls } from "../components/RunControls.tsx";
import { ScenarioControls } from "../components/ScenarioControls.tsx";
import { ShareControls } from "../components/ShareControls.tsx";
import { StopInspector } from "../components/StopInspector.tsx";
import { PlaybackControls, Timeline } from "../components/Timeline.tsx";
import styles from "../components/Workbench.module.css";
import { startWorkbenchSession, useWorkbench, workbench } from "../state/instance.ts";

// The editors bring in CodeMirror, so they load separately from the rest of the page.
const EditorPanel = lazy(() => import("../components/EditorPanel.tsx"));
// Documentation pages come with their own bundle, loaded when the panel first opens.
const DocsPanel = lazy(() => import("../components/DocsPanel.tsx"));
// Batch charts use Observable Plot, which only loads when the batch view opens.
const BatchView = lazy(() => import("../components/BatchView.tsx"));

export function meta() {
  return [{ title: "Regolith Rail" }];
}

type RunTab = "inspector" | "charts" | "metrics" | "errors";

function RunView() {
  const [tab, setTab] = useState<RunTab>("inspector");
  const errors = useRunErrors();
  const selectedStop = useWorkbench((s) => s.selectedStop);
  const selectedReview = useWorkbench((s) => s.selectedReview);
  const hasOutput = useWorkbench((s) => s.run.output !== null);
  // Runs without vehicles have only reviews to inspect.
  const reviewsOnly = useWorkbench(
    (s) => s.run.output !== null && s.run.output.trains.length === 0,
  );
  const showReview = selectedReview !== null || reviewsOnly;
  useEffect(() => {
    if (selectedStop !== null || selectedReview !== null) setTab("inspector");
  }, [selectedStop, selectedReview]);
  const tabs: { id: RunTab; label: string }[] = [
    { id: "inspector", label: showReview ? "Review" : "Stop" },
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
            {tab === "inspector" && (showReview ? <ReviewInspector /> : <StopInspector />)}
            {tab === "charts" && <RunCharts />}
            {tab === "metrics" && <MetricsSummary />}
            {tab === "errors" && <ErrorList />}
          </div>
        </>
      )}
    </>
  );
}

function ViewSwitch() {
  const view = useWorkbench((s) => s.view);
  const setView = useWorkbench((s) => s.setView);
  return (
    <div className={styles.viewSwitch} role="tablist" aria-label="View">
      <button
        type="button"
        role="tab"
        aria-selected={view === "run"}
        onClick={() => setView("run")}
        data-testid="view-run"
      >
        Single run
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === "batch"}
        onClick={() => setView("batch")}
        data-testid="view-batch"
      >
        Batch
      </button>
    </div>
  );
}

export default function Workbench() {
  // Editors and views wait for shared or draft work, so nothing is edited before it loads.
  const mounted = useWorkbench((s) => s.loaded);
  const view = useWorkbench((s) => s.view);
  const docsOpen = useWorkbench((s) => s.docs.length > 0);
  useEffect(() => startWorkbenchSession(), []);
  useEffect(() => {
    // Documentation links anywhere in the workbench, including editor tooltips, open
    // in the panel. Modified clicks still open a new tab.
    const open = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[data-docs]");
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank") return;
      event.preventDefault();
      workbench.getState().openDocs(link.dataset.docs ?? "");
    };
    document.addEventListener("click", open, true);
    return () => document.removeEventListener("click", open, true);
  }, []);
  return (
    <Page docsInPanel>
      <BrowserSupport>
        <div className={docsOpen ? `${styles.layout} ${styles.withDocs}` : styles.layout}>
          <div className={styles.toolbar}>
            <ViewSwitch />
            <ScenarioControls />
            {view === "run" && <RunControls />}
            {view === "run" && <PlaybackControls />}
            <ShareControls />
            <Notices />
          </div>
          {mounted ? <LibraryExplorer /> : <div />}
          {mounted ? (
            <Suspense fallback={<div />}>
              <EditorPanel />
            </Suspense>
          ) : (
            <div />
          )}
          <div className={styles.views}>
            {mounted && view === "run" && <RunView />}
            {mounted && view === "batch" && (
              <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
                <BatchView />
              </Suspense>
            )}
          </div>
          {mounted && docsOpen && (
            <div className={styles.docs}>
              <Suspense fallback={<p className={styles.muted}>Loading documentation…</p>}>
                <DocsPanel />
              </Suspense>
            </div>
          )}
        </div>
      </BrowserSupport>
    </Page>
  );
}
