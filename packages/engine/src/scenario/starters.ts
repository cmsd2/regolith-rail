import mixedLine from "./starters/mixed-line.json" with { type: "json" };
import relay from "./starters/relay.json" with { type: "json" };
import stormShock from "./starters/storm-shock.json" with { type: "json" };
import twoStation from "./starters/two-station.json" with { type: "json" };
import twoTrains from "./starters/two-trains.json" with { type: "json" };

export interface StarterScenario {
  id: string;
  /** The scenario document as shipped, before validation. */
  document: unknown;
}

/** Starter scenarios in the order they are offered to players. */
export const starterScenarios: readonly StarterScenario[] = [
  { id: "two-station", document: twoStation },
  { id: "relay", document: relay },
  { id: "two-trains", document: twoTrains },
  { id: "mixed-line", document: mixedLine },
  { id: "storm-shock", document: stormShock },
];
