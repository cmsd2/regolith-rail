import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAYOUT,
  DOCS_WIDTH,
  EXPLORER_WIDTH,
  readLayout,
  writeLayout,
} from "./layout-prefs.ts";

function memory() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

describe("layout preferences", () => {
  it("round-trip through storage", () => {
    const storage = memory();
    writeLayout(storage, { explorerCollapsed: true, explorerWidth: 300, docsWidth: 400 });
    expect(readLayout(storage)).toEqual({
      explorerCollapsed: true,
      explorerWidth: 300,
      docsWidth: 400,
    });
  });

  it("fall back to the defaults for missing, invalid or out-of-range values", () => {
    expect(readLayout(undefined)).toEqual(DEFAULT_LAYOUT);
    const storage = memory();
    storage.setItem("regolith-rail.layout", "not json");
    expect(readLayout(storage)).toEqual(DEFAULT_LAYOUT);
    storage.setItem("regolith-rail.layout", JSON.stringify({ explorerWidth: 5, docsWidth: 9999 }));
    expect(readLayout(storage)).toEqual({
      explorerCollapsed: false,
      explorerWidth: EXPLORER_WIDTH.min,
      docsWidth: DOCS_WIDTH.max,
    });
  });

  it("keep working when the browser refuses storage", () => {
    const refusing = {
      getItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
    };
    expect(readLayout(refusing)).toEqual(DEFAULT_LAYOUT);
    expect(() => writeLayout(refusing, DEFAULT_LAYOUT)).not.toThrow();
  });
});
