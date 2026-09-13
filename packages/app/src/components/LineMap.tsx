import { type LineState, type RunOutput, stateAt } from "@regolith-rail/engine";
import { useEffect, useRef } from "react";
import { formatAmount, formatGameTime, PALETTE } from "../lib/format.ts";
import { playhead, useWorkbench } from "../state/instance.ts";
import styles from "./Workbench.module.css";

const MARGIN_X = 60;
const BAR_WIDTH = 10;
const BAR_HEIGHT = 70;
const LINE_Y = 120;

interface Layout {
  width: number;
  x: Map<string, number>;
}

function layout(output: RunOutput, distances: number[], width: number): Layout {
  const total = distances.reduce((a, b) => a + b, 0) || 1;
  const x = new Map<string, number>();
  let along = 0;
  output.stations.forEach((id, i) => {
    x.set(id, MARGIN_X + ((width - 2 * MARGIN_X) * along) / total);
    along += distances[i] ?? 0;
  });
  return { width, x };
}

function css(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function draw(canvas: HTMLCanvasElement, output: RunOutput, distances: number[], state: LineState) {
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
  const { x } = layout(output, distances, width);
  const colour = (resource: string) =>
    PALETTE[output.resources.indexOf(resource) % PALETTE.length] as string;

  // Track.
  ctx.strokeStyle = muted;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x.get(output.stations[0] as string) ?? MARGIN_X, LINE_Y);
  ctx.lineTo(x.get(output.stations.at(-1) as string) ?? width - MARGIN_X, LINE_Y);
  ctx.stroke();

  // Stations with a stock bar per resource.
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "center";
  for (const station of output.stations) {
    const sx = x.get(station) as number;
    ctx.fillStyle = text;
    ctx.beginPath();
    ctx.arc(sx, LINE_Y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(station, sx, LINE_Y + 42);
    const sites = output.sites
      .map((site, i) => ({ site, i }))
      .filter(({ site }) => site.station === station);
    sites.forEach(({ site, i }, k) => {
      const bx = sx - (sites.length * (BAR_WIDTH + 3)) / 2 + k * (BAR_WIDTH + 3);
      const top = LINE_Y - 16 - BAR_HEIGHT;
      const fill = Math.min(1, (state.stock[i] as number) / Math.max(1, site.capacity));
      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 0.5, top + 0.5, BAR_WIDTH, BAR_HEIGHT);
      ctx.fillStyle = colour(site.resource);
      ctx.fillRect(bx + 1, top + BAR_HEIGHT * (1 - fill), BAR_WIDTH - 1, BAR_HEIGHT * fill);
    });
    ctx.fillStyle = muted;
    ctx.fillText(
      sites.map(({ i }) => formatAmount(state.stock[i] as number)).join(" / "),
      sx,
      LINE_Y + 58,
    );
  }

  // Trains.
  output.trains.forEach((train, i) => {
    const place = state.trains[i];
    if (!place) return;
    let tx: number;
    let forward: boolean;
    if (place.state === "moving") {
      const a = x.get(place.from) as number;
      const b = x.get(place.to) as number;
      tx = a + (b - a) * place.progress;
      forward = b > a;
    } else {
      tx = x.get(place.station) as number;
      forward = place.direction === "forward";
    }
    const ty = LINE_Y + 14 + i * 0;
    const cargo = (state.cargo[i] ?? []).reduce((a, b) => a + b, 0);
    ctx.fillStyle = PALETTE[(i + 3) % PALETTE.length] as string;
    ctx.beginPath();
    const dir = forward ? 1 : -1;
    ctx.moveTo(tx + 9 * dir, ty);
    ctx.lineTo(tx - 7 * dir, ty - 7);
    ctx.lineTo(tx - 7 * dir, ty + 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = text;
    ctx.textAlign = "left";
    ctx.fillText(`${train} ${formatAmount(cargo)}`, tx + 12, ty + 4 + i * 14);
    ctx.textAlign = "center";
  });

  ctx.textAlign = "left";
  ctx.fillStyle = muted;
  ctx.fillText(formatGameTime(state.t), 8, 16);
  // Legend.
  let lx = width - 8;
  ctx.textAlign = "right";
  for (const resource of [...output.resources].reverse()) {
    const label = resource;
    const w = ctx.measureText(label).width;
    ctx.fillStyle = text;
    ctx.fillText(label, lx, 16);
    ctx.fillStyle = colour(resource);
    ctx.fillRect(lx - w - 14, 7, 10, 10);
    lx -= w + 26;
  }
}

/** Canvas map of the line, redrawn from the playhead on every animation frame. */
export function LineMap() {
  const output = useWorkbench((s) => s.run.output);
  const scenario = useWorkbench((s) => s.scenario.scenario);
  const canvas = useRef<HTMLCanvasElement>(null);
  const renders = useRef(0);
  renders.current += 1;

  useEffect(() => {
    if (!output || !canvas.current) return;
    playhead.getState().setDuration(output.durationMs);
    // Distance from each station to the next one in order, where an arc joins them.
    const distances = output.stations.map((id, i) => {
      const next = output.stations[i + 1];
      const arc = scenario?.arcs.find(
        (a) => (a.from === id && a.to === next) || (a.to === id && a.from === next),
      );
      return arc?.distance ?? 0;
    });
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
        draw(element, output, distances, stateAt(output, t));
        drawnAt = t;
        drawnWidth = element.clientWidth;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [output, scenario]);

  if (!output) {
    return (
      <div className={styles.empty} data-testid="line-map">
        Press Run to simulate the scenario.
      </div>
    );
  }
  return (
    <canvas
      ref={canvas}
      className={styles.map}
      role="img"
      aria-label="Map of the line showing stations, stock and trains"
      data-testid="line-map"
      data-render-count={renders.current}
    />
  );
}
