import type { Scenario } from "@regolith-rail/engine";
import { lineOrder } from "./mod-ready.ts";

export type LayoutKind = "line" | "positions" | "loop" | "layers" | "circle";

export interface Point {
  x: number;
  y: number;
}

export interface MapLayout {
  kind: LayoutKind;
  /** Station positions in the unit square; a line has every station at y = 0.5. */
  points: Map<string, Point>;
  /** Stations that order from another station, as supplier to customer. */
  supplies: { from: string; to: string }[];
  /** Stations with an outside supplier. */
  external: string[];
}

const supplyLinks = (scenario: Scenario) =>
  scenario.stations.flatMap((s) =>
    s.suppliers
      .filter((sup) => sup.from !== "external")
      .map((sup) => ({ from: sup.from, to: s.id })),
  );

/** Stations in the order a single loop visits them, when the arcs form exactly one cycle. */
function loopOrder(scenario: Scenario): string[] | undefined {
  const ids = scenario.stations.map((s) => s.id);
  if (ids.length < 3 || scenario.arcs.length !== ids.length) return undefined;
  const joined = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const arc of scenario.arcs) {
    joined.get(arc.from)?.push(arc.to);
    joined.get(arc.to)?.push(arc.from);
  }
  if ([...joined.values()].some((next) => next.length !== 2)) return undefined;
  const order = [ids[0] as string];
  let previous: string | undefined;
  for (;;) {
    const at = order.at(-1) as string;
    const next = joined.get(at)?.find((id) => id !== previous);
    if (next === undefined || next === order[0]) break;
    order.push(next);
    previous = at;
  }
  return order.length === ids.length ? order : undefined;
}

function circle(order: string[]): Map<string, Point> {
  // Start at the top and go clockwise, so the first station is easy to find.
  return new Map(
    order.map((id, i) => {
      const angle = (2 * Math.PI * i) / order.length - Math.PI / 2;
      return [id, { x: 0.5 + 0.42 * Math.cos(angle), y: 0.5 + 0.42 * Math.sin(angle) }];
    }),
  );
}

/**
 * Stations in layers from the stations supplied from outside, along supplier links and arcs,
 * when those links form a forest.
 */
function layers(
  scenario: Scenario,
  supplies: { from: string; to: string }[],
): Map<string, Point> | undefined {
  const ids = scenario.stations.map((s) => s.id);
  const edges = [
    ...supplies.map((l) => [l.from, l.to] as const),
    ...scenario.arcs.map((a) => [a.from, a.to] as const),
  ];
  const joined = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const [a, b] of edges) {
    joined.get(a)?.push(b);
    joined.get(b)?.push(a);
  }
  const roots = scenario.stations
    .filter((s) => s.suppliers.some((sup) => sup.from === "external"))
    .map((s) => s.id);
  const depth = new Map<string, number>();
  const queue: string[] = [];
  const visit = (id: string, d: number) => {
    if (depth.has(id)) return;
    depth.set(id, d);
    queue.push(id);
  };
  for (const root of roots) visit(root, 0);
  let edgesSeen = 0;
  for (const start of ids) {
    if (!depth.has(start)) visit(start, 0);
    while (queue.length > 0) {
      const at = queue.shift() as string;
      for (const next of joined.get(at) ?? []) {
        if (!depth.has(next)) {
          edgesSeen++;
          visit(next, (depth.get(at) as number) + 1);
        }
      }
    }
  }
  // Every edge used to reach a new station means no cycles.
  if (edgesSeen !== edges.length) return undefined;
  const columns = Math.max(...depth.values()) + 1;
  const rows = new Map<number, string[]>();
  for (const id of ids) {
    const d = depth.get(id) as number;
    rows.set(d, [...(rows.get(d) ?? []), id]);
  }
  const points = new Map<string, Point>();
  for (const [d, column] of rows) {
    column.forEach((id, i) => {
      points.set(id, {
        x: columns === 1 ? 0.5 : 0.08 + (0.84 * d) / (columns - 1),
        y: (i + 1) / (column.length + 1),
      });
    });
  }
  return points;
}

/** Where to draw each station: along a line, where the script placed it, or as a network. */
export function mapLayout(scenario: Scenario): MapLayout {
  const supplies = supplyLinks(scenario);
  const external = scenario.stations
    .filter((s) => s.suppliers.some((sup) => sup.from === "external"))
    .map((s) => s.id);
  const base = { supplies, external };

  const line = lineOrder(scenario);
  if (line && supplies.length === 0 && scenario.vehicles.every((v) => v.route.kind === "shuttle")) {
    const distance = new Map(
      scenario.arcs.map((a) => [
        a.from < a.to ? `${a.from}:${a.to}` : `${a.to}:${a.from}`,
        a.distance,
      ]),
    );
    const steps = line.slice(1).map((id, i) => {
      const prev = line[i] as string;
      return distance.get(prev < id ? `${prev}:${id}` : `${id}:${prev}`) ?? 0;
    });
    const total = steps.reduce((a, b) => a + b, 0) || 1;
    // Keep the scenario's station order left to right, as the line map always has.
    const ordered = scenario.stations[0]?.id === line[0] ? line : [...line].reverse();
    const orderedSteps = ordered === line ? steps : [...steps].reverse();
    let along = 0;
    const points = new Map<string, Point>();
    ordered.forEach((id, i) => {
      points.set(id, { x: along / total, y: 0.5 });
      along += orderedSteps[i] ?? 0;
    });
    return { kind: "line", points, ...base };
  }

  if (scenario.stations.every((s) => s.position)) {
    const xs = scenario.stations.map((s) => s.position?.x as number);
    const ys = scenario.stations.map((s) => s.position?.y as number);
    const [minX, maxX, minY, maxY] = [
      Math.min(...xs),
      Math.max(...xs),
      Math.min(...ys),
      Math.max(...ys),
    ];
    const span = Math.max(maxX - minX, maxY - minY) || 1;
    const points = new Map(
      scenario.stations.map((s) => [
        s.id,
        {
          x: 0.08 + (0.84 * ((s.position?.x as number) - minX)) / span,
          y: 0.08 + (0.84 * ((s.position?.y as number) - minY)) / span,
        },
      ]),
    );
    return { kind: "positions", points, ...base };
  }

  const loop = loopOrder(scenario);
  if (loop) return { kind: "loop", points: circle(loop), ...base };

  const layered = scenario.stations.length > 1 ? layers(scenario, supplies) : undefined;
  if (layered) return { kind: "layers", points: layered, ...base };

  return { kind: "circle", points: circle(scenario.stations.map((s) => s.id)), ...base };
}
