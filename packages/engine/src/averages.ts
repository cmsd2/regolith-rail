import type { RunOutput } from "./output.ts";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** Long-run averages at one station and resource over a run. */
export interface SiteAverages {
  station: string;
  resource: string;
  /** Average stock over the run, in milli-units. */
  stock: number;
  /** What arrived a day, unloaded, delivered or produced, in milli-units. */
  inPerDay: number;
  /** What left a day, loaded, shipped, expired or consumed, in milli-units. */
  outPerDay: number;
  /** Stock over the outflow in hours: by Little's law, how long a unit stays. Undefined when nothing left. */
  hours: number | undefined;
  /**
   * The average wait of the units that left, in hours, following each unit first in first out
   * from its arrival to its departure. Units still there when the run ends are not counted.
   */
  waitedHours: number | undefined;
}

/** Long-run averages for one resource across the whole line. */
export interface LineAverages {
  resource: string;
  /** Average stock at stations, in milli-units. */
  atStations: number;
  /** Average cargo aboard vehicles, in milli-units. */
  aboard: number;
  /** What the line's consumers used a day, in milli-units. */
  consumedPerDay: number;
  /** All stock on the line over consumption, in hours: the average time from arrival to use. */
  hours: number | undefined;
}

export interface RunAverages {
  sites: SiteAverages[];
  line: LineAverages[];
  /** The length of the run in days. */
  days: number;
}

/** What moved into or out of a site by policy, supplier or expiry in one tick, by site then tick. */
function movements(output: RunOutput, siteIndex: Map<string, number>) {
  const arrived = new Map<number, Map<number, number>>();
  const left = new Map<number, Map<number, number>>();
  const add = (
    map: Map<number, Map<number, number>>,
    site: number,
    tick: number,
    amount: number,
  ) => {
    let byTick = map.get(site);
    if (!byTick) {
      byTick = new Map();
      map.set(site, byTick);
    }
    byTick.set(tick, (byTick.get(tick) ?? 0) + amount);
  };
  for (const event of output.events) {
    if (
      event.kind !== "transfer" &&
      event.kind !== "delivery" &&
      event.kind !== "expire" &&
      event.kind !== "shipment"
    ) {
      continue;
    }
    const site = siteIndex.get(`${event.station}:${event.resource}`);
    if (site === undefined) continue;
    const tick = Math.floor(event.t / output.tickMs);
    if (event.kind === "transfer") {
      if (event.amount < 0) add(arrived, site, tick, -event.amount);
      else add(left, site, tick, event.amount);
    } else if (event.kind === "delivery") {
      add(arrived, site, tick, event.amount - event.overflow);
    } else {
      add(left, site, tick, event.amount);
    }
  }
  return { arrived, left };
}

/**
 * Long-run averages of stock and flow at every station and across the line, from a run
 * recorded with full detail. Whatever changed a site's stock that no event accounts for was
 * produced or consumed there.
 */
export function runAverages(output: RunOutput): RunAverages {
  const { stock, cargo, sites, trains, resources, tickMs } = output;
  if (!stock || !cargo) throw new Error("runAverages needs a run recorded with full detail");
  const siteCount = sites.length;
  const rows = stock.length / siteCount;
  // Averages are over the intervals between tick boundaries, so the last boundary is not one.
  const intervals = rows - 1;
  const days = (intervals * tickMs) / DAY_MS;
  const siteIndex = new Map(sites.map((s, i) => [`${s.station}:${s.resource}`, i]));
  const { arrived, left } = movements(output, siteIndex);

  const consumedByResource = new Map<string, number>();
  const stationStockByResource = new Map<string, number>();
  const siteAverages = sites.map((site, s): SiteAverages => {
    const arrivals = arrived.get(s);
    const departures = left.get(s);
    // Units waiting at the site, first in first out, as [arrival time, amount].
    const queue: [number, number][] = [[0, stock[s] as number]];
    let stockSum = 0;
    let inTotal = 0;
    let outTotal = 0;
    let consumed = 0;
    let waited = 0;
    let leftTotal = 0;
    for (let r = 0; r < intervals; r++) {
      const before = stock[r * siteCount + s] as number;
      const after = stock[(r + 1) * siteCount + s] as number;
      stockSum += before;
      const movedIn = arrivals?.get(r) ?? 0;
      const movedOut = departures?.get(r) ?? 0;
      const net = after - before - movedIn + movedOut;
      const produced = net > 0 ? net : 0;
      const used = net < 0 ? -net : 0;
      const arrivedNow = movedIn + produced;
      let leaving = movedOut + used;
      inTotal += arrivedNow;
      outTotal += leaving;
      consumed += used;
      if (arrivedNow > 0) queue.push([r * tickMs, arrivedNow]);
      const now = (r + 1) * tickMs;
      while (leaving > 0 && queue.length > 0) {
        const head = queue[0] as [number, number];
        const take = leaving < head[1] ? leaving : head[1];
        waited += take * (now - head[0]);
        leftTotal += take;
        leaving -= take;
        head[1] -= take;
        if (head[1] === 0) queue.shift();
      }
    }
    const average = intervals > 0 ? stockSum / intervals : 0;
    const outPerDay = days > 0 ? outTotal / days : 0;
    consumedByResource.set(site.resource, (consumedByResource.get(site.resource) ?? 0) + consumed);
    stationStockByResource.set(
      site.resource,
      (stationStockByResource.get(site.resource) ?? 0) + average,
    );
    return {
      station: site.station,
      resource: site.resource,
      stock: average,
      inPerDay: days > 0 ? inTotal / days : 0,
      outPerDay,
      hours: outPerDay > 0 ? (average / outPerDay) * 24 : undefined,
      waitedHours: leftTotal > 0 ? waited / leftTotal / HOUR_MS : undefined,
    };
  });

  const resourceCount = resources.length;
  const line = resources.map((resource, k): LineAverages => {
    let aboardSum = 0;
    for (let r = 0; r < intervals; r++) {
      for (let t = 0; t < trains.length; t++) {
        aboardSum += cargo[(r * trains.length + t) * resourceCount + k] as number;
      }
    }
    const aboard = intervals > 0 ? aboardSum / intervals : 0;
    const atStations = stationStockByResource.get(resource) ?? 0;
    const consumedPerDay = days > 0 ? (consumedByResource.get(resource) ?? 0) / days : 0;
    return {
      resource,
      atStations,
      aboard,
      consumedPerDay,
      hours: consumedPerDay > 0 ? ((atStations + aboard) / consumedPerDay) * 24 : undefined,
    };
  });

  return { sites: siteAverages, line, days };
}
