import type { Scenario } from "@regolith-rail/engine";
import type { PolicyHooks } from "@regolith-rail/lua-runtime";

/** Whether a policy and scenario pairing could run in the game, and what prevents it. */
export interface ModReadiness {
  ready: boolean;
  reasons: string[];
}

/** Hooks the game calls. */
const GAME_HOOKS = new Set(["on_start", "on_stop"]);

/**
 * Station ids from one end to the other, when the arcs join every station in a single line
 * with no branches or loops.
 */
export function lineOrder(scenario: Scenario): string[] | undefined {
  const ids = scenario.stations.map((s) => s.id);
  if (ids.length < 2 || scenario.arcs.length !== ids.length - 1) return undefined;
  const joined = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const arc of scenario.arcs) {
    joined.get(arc.from)?.push(arc.to);
    joined.get(arc.to)?.push(arc.from);
  }
  if ([...joined.values()].some((next) => next.length > 2)) return undefined;
  const end = ids.find((id) => joined.get(id)?.length === 1);
  if (end === undefined) return undefined;
  const order = [end];
  let previous: string | undefined;
  let at = end;
  for (;;) {
    const next = joined.get(at)?.find((id) => id !== previous);
    if (next === undefined) break;
    order.push(next);
    previous = at;
    at = next;
  }
  return order.length === ids.length ? order : undefined;
}

const sameStops = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

/**
 * A pairing is mod-ready when the policy defines only the hooks the game calls, and the scenario
 * is a single line of stations whose vehicles all shuttle along the whole line, with no reviews,
 * converters or suppliers.
 */
export function modReadiness(policy: PolicyHooks, scenario: Scenario): ModReadiness {
  const reasons: string[] = [];
  if (policy.error) reasons.push(`the policy does not load: ${policy.error.message}`);
  for (const hook of policy.hooks) {
    if (!GAME_HOOKS.has(hook))
      reasons.push(`the policy defines ${hook}, which the game does not call`);
  }
  if (scenario.stations.some((s) => s.review)) reasons.push("the scenario has reviews");
  if (scenario.stations.some((s) => s.converters.length > 0)) {
    reasons.push("the scenario has converters");
  }
  if (scenario.stations.some((s) => s.suppliers.length > 0)) {
    reasons.push("the scenario has suppliers");
  }
  const line = lineOrder(scenario);
  if (!line) reasons.push("the stations are not joined in a single line");
  if (scenario.vehicles.length === 0) reasons.push("the scenario has no vehicles");
  for (const vehicle of scenario.vehicles) {
    const { route } = vehicle;
    if (route.kind !== "shuttle") {
      reasons.push(`vehicle ${vehicle.id} runs a ${route.kind} route, not a shuttle`);
    } else if (
      line &&
      !sameStops(route.stops, line) &&
      !sameStops(route.stops, [...line].reverse())
    ) {
      reasons.push(`vehicle ${vehicle.id} does not shuttle along the whole line`);
    }
  }
  return { ready: reasons.length === 0, reasons };
}
