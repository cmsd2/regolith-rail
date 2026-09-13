import { POLICY_API_VERSION } from "@regolith-rail/engine";
import type { NavigateFunction } from "react-router";
import { findTemplate, starterSource, templateSource } from "../lib/scenario-source.ts";
import { encodeShare } from "../lib/share.ts";
import { workbench } from "../state/instance.ts";
import type { WorkContent } from "../state/workbench.ts";

export interface ExampleToOpen {
  source: string;
  /** A policy, or a scenario script that opens in the scenario editor. */
  kind: "policy" | "script";
  scenario: string;
  seed: number;
}

/** A starter scenario by id, or a classic template with its defaults. */
function exampleScenario(id: string) {
  const template = findTemplate(id);
  return template ? templateSource(template.name, template.defaults) : starterSource(id);
}

/** Puts a documentation example in the editor without running it. */
export async function openExample(
  example: ExampleToOpen,
  mode: "page" | "panel",
  navigate: NavigateFunction,
): Promise<void> {
  const state = workbench.getState();
  const script = example.kind === "script";
  const content: WorkContent = {
    view: "run",
    // A script example keeps the policy in the editor.
    policy: script ? state.policy : { name: "example.lua", source: example.source },
    scenario: script
      ? { kind: "script", source: example.source, starterId: null }
      : exampleScenario(example.scenario),
    seed: example.seed,
    saveReloadTest: false,
  };
  if (state.loaded) {
    // The workbench is already open in this tab, so change it directly.
    state.restore(content);
    state.setEditorTab(script ? "scenario" : "policy");
    if (mode === "page") await navigate("/");
    return;
  }
  // Opening the workbench fresh restores the draft, so hand the example over as a
  // share link instead; the workbench loads it in place of the draft.
  const hash = await encodeShare({
    apiVersion: POLICY_API_VERSION,
    appVersion: __APP_VERSION__,
    view: "run",
    policy: content.policy,
    scenario: content.scenario,
    seed: content.seed,
    saveReloadTest: false,
  });
  await navigate({ pathname: "/", hash });
}
