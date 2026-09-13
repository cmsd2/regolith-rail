import { type RunEvent, type RunOutput, stateAt, type Trace } from "@regolith-rail/engine";

type Ev<K extends RunEvent["kind"]> = RunEvent & { kind: K };

export interface ReviewMark {
  review: number;
  t: number;
  station: string;
}

export interface ReviewDetail extends ReviewMark {
  /** Orders placed at the review, each with when it arrives once it has shipped. */
  orders: (Ev<"order"> & { arrivesAt?: number })[];
  warnings: Ev<"warning">[];
  traces: Trace[];
  logs: string[];
  records: { name: string; value: number }[];
  errors: Ev<"error">[];
  /** Stock of each resource at the station when it was reviewed. */
  stock: Record<string, number>;
  /** Backordered demand of each resource at the station, when the run records it. */
  backorders: Record<string, number>;
  /** Shipments to the station that were on their way at the review. */
  onTheWay: Ev<"shipment">[];
}

const cache = new WeakMap<RunOutput, ReviewMark[]>();

/** Every review in the run, in time order. */
export function reviews(output: RunOutput): ReviewMark[] {
  let list = cache.get(output);
  if (!list) {
    list = output.events
      .filter((e): e is Ev<"review"> => e.kind === "review")
      .map(({ review, t, station }) => ({ review, t, station }));
    cache.set(output, list);
  }
  return list;
}

/** The last review at or before `t`. */
export function latestReviewAt(output: RunOutput, t: number): number | null {
  let latest: number | null = null;
  for (const mark of reviews(output)) {
    if (mark.t > t) break;
    latest = mark.review;
  }
  return latest;
}

export function reviewDetail(output: RunOutput, review: number): ReviewDetail | null {
  const mark = reviews(output).find((r) => r.review === review);
  if (!mark) return null;
  const events = output.events.filter((e) => "review" in e && e.review === review);
  const of = <K extends RunEvent["kind"]>(kind: K) =>
    events.filter((e): e is Ev<K> => e.kind === kind);
  const shipments = output.events.filter(
    (e): e is Ev<"shipment"> => e.kind === "shipment" && e.to === mark.station,
  );
  const orders = of("order").map((order) => {
    const shipped = shipments.find(
      (s) => s.t === order.t && s.resource === order.resource && s.station === order.from,
    );
    return shipped ? { ...order, arrivesAt: shipped.arrivesAt } : order;
  });
  const state = output.stock ? stateAt(output, mark.t) : null;
  const stock: Record<string, number> = {};
  const backorders: Record<string, number> = {};
  output.sites.forEach((site, i) => {
    if (site.station !== mark.station || !state) return;
    stock[site.resource] = state.stock[i] as number;
    if (state.backorders) backorders[site.resource] = state.backorders[i] as number;
  });
  return {
    ...mark,
    orders,
    warnings: of("warning"),
    traces: of("trace").map((e) => e.trace),
    logs: of("log").map((e) => e.message),
    records: of("record").map(({ name, value }) => ({ name, value })),
    errors: of("error"),
    stock,
    backorders,
    onTheWay: shipments.filter((s) => s.t < mark.t && s.arrivesAt > mark.t),
  };
}
