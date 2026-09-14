import type { NavigateFunction } from "react-router";
import { scenarioFragmentFor } from "../lib/examples.ts";
import type { ItemId } from "../lib/library.ts";
import { workbench } from "../state/instance.ts";

/**
 * Opens a chapter's scenario in the workbench with the policy its lesson starts from, without
 * running it. A workbench already open in this tab changes directly; a fresh one opens it from the
 * fragment once the library has loaded.
 */
export async function openScenario(
  id: ItemId,
  mode: "page" | "panel",
  navigate: NavigateFunction,
): Promise<void> {
  const state = workbench.getState();
  if (state.loaded) {
    state.openLessonScenario(id);
    if (mode === "page") await navigate("/");
    return;
  }
  await navigate({ pathname: "/", hash: scenarioFragmentFor(id) });
}
