import mixedLine from "./format1/mixed-line.json" with { type: "json" };
import relay from "./format1/relay.json" with { type: "json" };
import stormShock from "./format1/storm-shock.json" with { type: "json" };
import twoStation from "./format1/two-station.json" with { type: "json" };
import twoTrains from "./format1/two-trains.json" with { type: "json" };

/**
 * The starter scenarios as the first release shipped them, in format 1. Share links and saves
 * from that release hold these documents, so upgrade tests keep them.
 */
export const format1Starters: readonly { id: string; document: unknown }[] = [
  { id: "two-station", document: twoStation },
  { id: "relay", document: relay },
  { id: "two-trains", document: twoTrains },
  { id: "mixed-line", document: mixedLine },
  { id: "storm-shock", document: stormShock },
];
