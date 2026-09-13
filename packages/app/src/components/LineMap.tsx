import {
  type LineState,
  type RunEvent,
  type RunOutput,
  type Scenario,
  stateAt,
} from "@regolith-rail/engine";
import { useEffect, useMemo, useRef } from "react";
import { formatAmount, formatGameTime, PALETTE } from "../lib/format.ts";
import { type MapLayout, mapLayout, type Point } from "../lib/map-layout.ts";
import { playhead, useWorkbench } from "../state/instance.ts";
import styles from "./Workbench.module.css";

const MARGIN_X = 60;
const BAR_WIDTH = 10;
const BAR_HEIGHT = 70;
const LINE_Y = 120;
const NETWORK_BAR_HEIGHT = 40;

/** What the map draws: stations and routes from the scenario, and a run to replay if there is one. */
interface MapData {
  layout: MapLayout;
  stations: string[];
  resources: string[];
  sites: { station: string; resource: string; capacity: number }[];
  output: RunOutput | null;
  shipments: (RunEvent & { kind: "shipment" })[];
  arcs: { from: string; to: string }[];
}

function mapData(scenario: Scenario, output: RunOutput | null): MapData {
  const sites = output
    ? output.sites
    : scenario.stations.flatMap((s) =>
        s.resources.map((r) => ({
          station: s.id,
          resource: r.id,
          capacity: r.capacity === "unlimited" ? 2_000_000_000 : r.capacity,
        })),
      );
  return {
    layout: mapLayout(scenario),
    stations: scenario.stations.map((s) => s.id),
    resources: scenario.resources.map((r) => r.id),
    sites,
    output,
    shipments: output
      ? output.events.filter((e): e is RunEvent & { kind: "shipment" } => e.kind === "shipment")
      : [],
    arcs: scenario.arcs,
  };
}

/** Stock before a run starts, when there is no run to replay. */
function initialState(scenario: Scenario): LineState {
  return {
    t: 0,
    stock: scenario.stations.flatMap((s) => s.resources.map((r) => r.initial)),
    cargo: scenario.vehicles.map(() => scenario.resources.map(() => 0)),
    trains: [],
  };
}

function css(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

const isLine = (data: MapData) => data.layout.kind === "line";

function draw(canvas: HTMLCanvasElement, data: MapData, state: LineState) {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const text = css("--text", "#222");
  const muted = css("--muted", "#777");
  const border = css("--border", "#ccc");
  const bad = css("--bad", "#c33");
  const { layout, output, resources } = data;
  const line = isLine(data);
  const barHeight = line ? BAR_HEIGHT : NETWORK_BAR_HEIGHT;
  const at = (id: string): Point => {
    const p = layout.points.get(id) ?? { x: 0.5, y: 0.5 };
    if (line) return { x: MARGIN_X + (width - 2 * MARGIN_X) * p.x, y: LINE_Y };
    return { x: MARGIN_X + (width - 2 * MARGIN_X) * p.x, y: 70 + (height - 130) * p.y };
  };
  const colour = (resource: string) =>
    PALETTE[resources.indexOf(resource) % PALETTE.length] as string;

  // Track or arcs, and supplier links as dashed lines.
  ctx.strokeStyle = muted;
  ctx.lineWidth = 3;
  if (line) {
    const ends = [...layout.points.entries()].sort((a, b) => a[1].x - b[1].x);
    ctx.beginPath();
    ctx.moveTo(at(ends[0]?.[0] ?? "").x, LINE_Y);
    ctx.lineTo(at(ends.at(-1)?.[0] ?? "").x, LINE_Y);
    ctx.stroke();
  } else {
    for (const arc of data.arcs) {
      const a = at(arc.from);
      const b = at(arc.to);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  for (const link of layout.supplies) {
    const a = at(link.from);
    const b = at(link.to);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.font = "11px system-ui, sans-serif";
  ctx.textAlign = "right";
  for (const id of layout.external) {
    const p = at(id);
    ctx.fillStyle = muted;
    ctx.fillText("supplier →", p.x - 12, p.y + 4);
  }

  // Stations with a stock bar per resource, outlined when demand is backordered.
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "center";
  for (const station of data.stations) {
    const { x: sx, y: sy } = at(station);
    ctx.fillStyle = text;
    ctx.beginPath();
    ctx.arc(sx, sy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(station, sx, sy + (line ? 42 : 20));
    const sites = data.sites
      .map((site, i) => ({ site, i }))
      .filter(({ site }) => site.station === station);
    sites.forEach(({ site, i }, k) => {
      const bx = sx - (sites.length * (BAR_WIDTH + 3)) / 2 + k * (BAR_WIDTH + 3);
      const top = sy - 16 - barHeight;
      const fill = Math.min(1, (state.stock[i] as number) / Math.max(1, site.capacity));
      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 0.5, top + 0.5, BAR_WIDTH, barHeight);
      ctx.fillStyle = colour(site.resource);
      ctx.fillRect(bx + 1, top + barHeight * (1 - fill), BAR_WIDTH - 1, barHeight * fill);
      if ((state.backorders?.[i] ?? 0) > 0) {
        ctx.strokeStyle = bad;
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, top, BAR_WIDTH + 1, barHeight + 1);
      }
    });
    ctx.fillStyle = muted;
    ctx.fillText(
      sites.map(({ i }) => formatAmount(state.stock[i] as number)).join(" / "),
      sx,
      sy + (line ? 58 : 34),
    );
    const owed = sites.filter(({ i }) => (state.backorders?.[i] ?? 0) > 0);
    if (owed.length > 0) {
      ctx.fillStyle = bad;
      ctx.fillText(
        `backordered ${owed.map(({ i }) => formatAmount(state.backorders?.[i] as number)).join(" / ")}`,
        sx,
        sy + (line ? 74 : 48),
      );
    }
  }

  // Shipments on their way, from their supplying station or from outside.
  for (const shipment of data.shipments) {
    if (shipment.t > state.t || shipment.arrivesAt <= state.t) continue;
    const to = at(shipment.to);
    const from = shipment.station === "external" ? { x: to.x - 40, y: to.y } : at(shipment.station);
    const progress = (state.t - shipment.t) / Math.max(1, shipment.arrivesAt - shipment.t);
    ctx.fillStyle = colour(shipment.resource);
    ctx.beginPath();
    ctx.arc(
      from.x + (to.x - from.x) * progress,
      from.y + (to.y - from.y) * progress,
      4,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // Vehicles, pointing the way they are going.
  output?.trains.forEach((train, i) => {
    const place = state.trains[i];
    if (!place) return;
    let tx: number;
    let ty: number;
    let dx: number;
    let dy: number;
    if (place.state === "moving") {
      const a = at(place.from);
      const b = at(place.to);
      tx = a.x + (b.x - a.x) * place.progress;
      ty = a.y + (b.y - a.y) * place.progress;
      const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      dx = (b.x - a.x) / length;
      dy = (b.y - a.y) / length;
    } else {
      ({ x: tx, y: ty } = at(place.station));
      dx = place.direction === "forward" ? 1 : -1;
      dy = 0;
    }
    if (line) {
      ty = LINE_Y + 14;
      dy = 0;
      dx = dx >= 0 ? 1 : -1;
    } else {
      ty += 12;
    }
    const cargo = (state.cargo[i] ?? []).reduce((a, b) => a + b, 0);
    ctx.fillStyle = PALETTE[(i + 3) % PALETTE.length] as string;
    ctx.beginPath();
    ctx.moveTo(tx + 9 * dx, ty + 9 * dy);
    ctx.lineTo(tx - 7 * dx + 7 * dy, ty - 7 * dy - 7 * dx);
    ctx.lineTo(tx - 7 * dx - 7 * dy, ty - 7 * dy + 7 * dx);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = text;
    ctx.textAlign = "left";
    ctx.fillText(`${train} ${formatAmount(cargo)}`, tx + 12, ty + 4 + (line ? i * 14 : 0));
    ctx.textAlign = "center";
  });

  ctx.textAlign = "left";
  ctx.fillStyle = muted;
  ctx.fillText(output ? formatGameTime(state.t) : "Before the run", 8, 16);
  // Legend.
  let lx = width - 8;
  ctx.textAlign = "right";
  for (const resource of [...resources].reverse()) {
    const w = ctx.measureText(resource).width;
    ctx.fillStyle = text;
    ctx.fillText(resource, lx, 16);
    ctx.fillStyle = colour(resource);
    ctx.fillRect(lx - w - 14, 7, 10, 10);
    lx -= w + 26;
  }
}

/**
 * Canvas map of the scenario: a straight line for a single shuttle line, a network otherwise.
 * After a run it replays the run from the playhead on every animation frame.
 */
export function LineMap() {
  const output = useWorkbench((s) => s.run.output);
  const scenario = useWorkbench((s) => s.scenario.scenario);
  const canvas = useRef<HTMLCanvasElement>(null);
  const renders = useRef(0);
  renders.current += 1;
  // A run replays on the scenario it ran, while that is still the scenario shown.
  const data = useMemo(
    () =>
      scenario
        ? mapData(scenario, output && output.scenarioId === scenario.id ? output : null)
        : null,
    [scenario, output],
  );

  useEffect(() => {
    if (!data || !canvas.current || !scenario) return;
    const replay = data.output;
    if (!replay) {
      const element = canvas.current;
      const redraw = () => draw(element, data, initialState(scenario));
      redraw();
      const observer =
        typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(redraw);
      observer?.observe(element);
      return () => observer?.disconnect();
    }
    playhead.getState().setDuration(replay.durationMs);
    let frame = 0;
    let last = performance.now();
    let drawnAt = -1;
    let drawnWidth = -1;
    const tick = (now: number) => {
      playhead.getState().advance(now - last);
      last = now;
      const { t } = playhead.getState();
      const element = canvas.current;
      if (element && (t !== drawnAt || element.clientWidth !== drawnWidth)) {
        draw(element, data, stateAt(replay, t));
        drawnAt = t;
        drawnWidth = element.clientWidth;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [data, scenario]);

  if (!data) {
    return (
      <div className={styles.empty} data-testid="line-map">
        Fix the scenario to see its map.
      </div>
    );
  }
  return (
    <canvas
      ref={canvas}
      className={isLine(data) ? styles.map : `${styles.map} ${styles.network}`}
      role="img"
      aria-label={`Map of ${data.stations.join(", ")}: stations, stock${data.output ? " and vehicles" : " before the run"}`}
      data-testid="line-map"
      data-layout={data.layout.kind}
      data-stations={data.stations.join(" ")}
      data-replaying={data.output ? "true" : "false"}
      data-render-count={renders.current}
    />
  );
}
