import { Dialog } from "radix-ui";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  DEFAULT_LAYOUT,
  DOCS_WIDTH,
  EXPLORER_WIDTH,
  type LayoutPrefs,
  readLayout,
  writeLayout,
} from "../lib/layout-prefs.ts";
import { useWorkbench } from "../state/instance.ts";
import { ColumnResizer } from "./ColumnResizer.tsx";
import { LibraryExplorer } from "./LibraryExplorer.tsx";
import styles from "./Workbench.module.css";

/** Below this width the explorer opens as a drawer instead of a column. */
const NARROW = "(max-width: 800px)";

const browserStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

function useNarrow() {
  return useSyncExternalStore(
    (changed) => {
      const query = window.matchMedia(NARROW);
      query.addEventListener("change", changed);
      return () => query.removeEventListener("change", changed);
    },
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
}

/** The workbench's column arrangement, remembered in this browser. */
export function useWorkbenchLayout() {
  // The page is prerendered with the defaults, and hydration would keep their widths, so the stored
  // arrangement is read after mounting.
  const [prefs, setPrefs] = useState<LayoutPrefs>(DEFAULT_LAYOUT);
  useEffect(() => setPrefs(readLayout(browserStorage())), []);
  const narrow = useNarrow();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const update = useCallback((change: Partial<LayoutPrefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...change };
      writeLayout(browserStorage(), next);
      return next;
    });
  }, []);
  useEffect(() => {
    if (!narrow) setDrawerOpen(false);
  }, [narrow]);
  const style = {
    "--explorer-width": prefs.explorerCollapsed ? "2rem" : `${prefs.explorerWidth}px`,
    "--docs-width": `${prefs.docsWidth}px`,
  } as CSSProperties;
  return { prefs, update, narrow, drawerOpen, setDrawerOpen, style };
}

export type WorkbenchLayout = ReturnType<typeof useWorkbenchLayout>;

/** Shows or hides the library: collapses the column on wide screens, and opens the drawer on narrow ones. */
export function LibraryToggle({ layout }: { layout: WorkbenchLayout }) {
  const shown = layout.narrow ? layout.drawerOpen : !layout.prefs.explorerCollapsed;
  return (
    <button
      type="button"
      aria-expanded={shown}
      title={shown ? "Hide the library" : "Show the library"}
      onClick={() =>
        layout.narrow
          ? layout.setDrawerOpen(!layout.drawerOpen)
          : layout.update({ explorerCollapsed: !layout.prefs.explorerCollapsed })
      }
      data-testid="library-toggle"
    >
      Library
    </button>
  );
}

/** The explorer's column on wide screens, or its drawer on narrow ones. */
export function ExplorerColumn({ layout }: { layout: WorkbenchLayout }) {
  if (layout.narrow) return <ExplorerDrawer layout={layout} />;
  const { prefs, update } = layout;
  return (
    <div className={styles.explorerColumn} data-collapsed={prefs.explorerCollapsed}>
      {prefs.explorerCollapsed ? (
        <button
          type="button"
          className={styles.rail}
          aria-label="Show library"
          aria-expanded={false}
          onClick={() => update({ explorerCollapsed: false })}
          data-testid="library-expand"
        >
          Library
        </button>
      ) : (
        <>
          <LibraryExplorer />
          <ColumnResizer
            label="Library width"
            value={prefs.explorerWidth}
            range={EXPLORER_WIDTH}
            edge="right"
            onChange={(explorerWidth) => update({ explorerWidth })}
            testId="library-resizer"
          />
        </>
      )}
    </div>
  );
}

function ExplorerDrawer({ layout }: { layout: WorkbenchLayout }) {
  const { drawerOpen, setDrawerOpen } = layout;
  const slots = useWorkbench((s) => s.slots);
  // Using an item fills a slot, and the drawer gets out of the way of the run.
  const openedWith = useRef(slots);
  useEffect(() => {
    if (!drawerOpen) openedWith.current = slots;
    else if (slots !== openedWith.current) setDrawerOpen(false);
  }, [drawerOpen, slots, setDrawerOpen]);
  return (
    <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.drawerOverlay} />
        <Dialog.Content className={styles.drawer} data-testid="library-drawer">
          <div className={styles.drawerHeader}>
            <Dialog.Title>Library</Dialog.Title>
            <Dialog.Description className={styles.visuallyHidden}>
              Choose the scenario and policies for this run.
            </Dialog.Description>
            <Dialog.Close data-testid="library-drawer-close">Close</Dialog.Close>
          </div>
          <LibraryExplorer />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The documentation column, resizable from its left edge. */
export function DocsColumn({ layout, children }: { layout: WorkbenchLayout; children: ReactNode }) {
  const { prefs, update, narrow } = layout;
  return (
    <div className={styles.docs}>
      {!narrow && (
        <ColumnResizer
          label="Documentation width"
          value={prefs.docsWidth}
          range={DOCS_WIDTH}
          edge="left"
          onChange={(docsWidth) => update({ docsWidth })}
          testId="docs-resizer"
        />
      )}
      {children}
    </div>
  );
}
