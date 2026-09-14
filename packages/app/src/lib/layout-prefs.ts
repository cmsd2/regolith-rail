/** How the player has arranged the workbench's columns in this browser. */
export interface LayoutPrefs {
  explorerCollapsed: boolean;
  /** Explorer width in CSS pixels. */
  explorerWidth: number;
  /** Documentation panel width in CSS pixels. */
  docsWidth: number;
}

export const EXPLORER_WIDTH = { min: 220, max: 520, initial: 280 } as const;
export const DOCS_WIDTH = { min: 280, max: 720, initial: 380 } as const;

const KEY = "regolith-rail.layout";

export const DEFAULT_LAYOUT: LayoutPrefs = {
  explorerCollapsed: false,
  explorerWidth: EXPLORER_WIDTH.initial,
  docsWidth: DOCS_WIDTH.initial,
};

export const clamp = (value: number, range: { min: number; max: number }) =>
  Math.round(Math.min(range.max, Math.max(range.min, value)));

/** Stored preferences, falling back to the defaults for anything missing, invalid or unreadable. */
export function readLayout(storage: Pick<Storage, "getItem"> | undefined): LayoutPrefs {
  try {
    const raw = storage?.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<LayoutPrefs>) : {};
    return {
      explorerCollapsed: parsed.explorerCollapsed === true,
      explorerWidth: Number.isFinite(parsed.explorerWidth)
        ? clamp(parsed.explorerWidth as number, EXPLORER_WIDTH)
        : DEFAULT_LAYOUT.explorerWidth,
      docsWidth: Number.isFinite(parsed.docsWidth)
        ? clamp(parsed.docsWidth as number, DOCS_WIDTH)
        : DEFAULT_LAYOUT.docsWidth,
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

/** Stores the preferences, doing nothing when the browser refuses. */
export function writeLayout(storage: Pick<Storage, "setItem"> | undefined, prefs: LayoutPrefs) {
  try {
    storage?.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // A browser that refuses storage keeps the layout for this visit only.
  }
}
