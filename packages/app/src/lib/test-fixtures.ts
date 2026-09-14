import { classicTemplates } from "@regolith-rail/scenario-kit";
import type { ExperimentItem } from "./library.ts";
import { templateSource } from "./scenario-source.ts";

/** An experiment of a classic template at its defaults with its reference policy, for tests. */
export function classicExperiment(name = "classic.reorder"): ExperimentItem {
  const template = classicTemplates.find((t) => t.name === name);
  if (!template) throw new Error(`unknown template ${name}`);
  return {
    id: `mine:experiment:${name}`,
    kind: "experiment",
    source: "mine",
    name: template.title,
    createdAt: 1,
    updatedAt: 1,
    content: {
      scenario: {
        content: templateSource(template.name, template.defaults),
        name: template.title,
        origin: `classic:scenario:${name}`,
      },
      policy: {
        content: template.reference(template.defaults).policy,
        name: `${template.title} reference policy`,
        origin: `classic:policy:${name}`,
      },
      seed: 1,
      view: "run",
      saveReloadTest: false,
      batch: { seedCount: 100, baseSeed: 1, compare: false },
    },
  };
}
