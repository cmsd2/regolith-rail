import { emptyOutcome, type Policy, type PolicyOutcome } from "../policy.ts";

/**
 * Reference implementation of the naive baseline, used to cross-check
 * `naive.lua`: move every resource at the station towards the floor of the mean
 * stock of that resource across the stations that store it.
 */
export function naiveReferencePolicy(): Policy {
  return {
    start: () => emptyOutcome(),
    stop(snapshot): PolicyOutcome {
      const outcome = emptyOutcome();
      const here = snapshot.here;
      for (const resource of here.resources) {
        let total = 0;
        let count = 0;
        for (const id of snapshot.station_order) {
          const station = snapshot.stations[id];
          if (!station?.resources.includes(resource)) continue;
          if (station.stock === undefined) {
            return {
              ...emptyOutcome(),
              error: {
                kind: "runtime",
                message: "reading another station's stock requires the line information level",
              },
            };
          }
          total += station.stock[resource] ?? 0;
          count += 1;
        }
        const mean = Math.floor(total / count);
        const delta = (here.stock?.[resource] ?? 0) - mean;
        if (delta > 0) outcome.actions.push({ type: "load", resource, amount: delta });
        else if (delta < 0) outcome.actions.push({ type: "unload", resource, amount: -delta });
      }
      return outcome;
    },
  };
}
