import type { NavigateFunction } from "react-router";
import { exampleFragmentFor, findExampleItem } from "../lib/examples.ts";
import { workbench } from "../state/instance.ts";

export interface ExampleToOpen {
  source: string;
  /** A policy, or a scenario script that opens in the scenario editor. */
  kind: "policy" | "script";
  scenario: string;
  seed: number;
}

/**
 * Puts a documentation example in the workbench without running it. The example opens as its
 * read-only item under Examples, so the player's own work is left as it was.
 */
export async function openExample(
  example: ExampleToOpen,
  mode: "page" | "panel",
  navigate: NavigateFunction,
): Promise<void> {
  const id = findExampleItem(example.source, example.kind === "script");
  const state = workbench.getState();
  if (state.loaded) {
    // The workbench is already open in this tab, so change it directly.
    if (id) state.openExample(id);
    if (mode === "page") await navigate("/");
    return;
  }
  // A fresh workbench restores the library first, then opens the example the fragment names.
  const fragment = id ? exampleFragmentFor(id) : null;
  await navigate(fragment ? { pathname: "/", hash: fragment } : "/");
}
