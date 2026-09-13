import { emptyOutcome, type Policy, type PolicyOutcome } from "../policy.ts";

/**
 * Reference implementation of the naive baseline, used to cross-check
 * `naive.lua`: move every enabled resource at the station towards the floor of
 * the mean stock of that resource across the stations that enable it.
 */
export function naiveReferencePolicy(): Policy {
  return {
    start: () => emptyOutcome(),
    stop(snapshot): PolicyOutcome {
      const outcome = emptyOutcome();
      for (const resource of snapshot.station.resources) {
        let total = 0;
        let count = 0;
        for (const station of snapshot.line.stations) {
          if (!station.resources.includes(resource)) continue;
          if (station.stock === undefined) {
            return {
              ...emptyOutcome(),
              error: {
                kind: "runtime",
                message: "reading stock at other stations requires the line information level",
              },
            };
          }
          total += station.stock[resource] ?? 0;
          count += 1;
        }
        const mean = Math.floor(total / count);
        const delta = (snapshot.station.stock[resource] ?? 0) - mean;
        if (delta > 0) outcome.actions.push({ type: "load", resource, amount: delta });
        else if (delta < 0) outcome.actions.push({ type: "unload", resource, amount: -delta });
      }
      return outcome;
    },
  };
}
