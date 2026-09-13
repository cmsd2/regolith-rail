import type { RunOutput } from "@regolith-rail/engine";
import { useEffect, useMemo, useRef } from "react";
import type uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { HOUR_MS, PALETTE } from "../lib/format.ts";
import { playhead, useWorkbench } from "../state/instance.ts";
import styles from "./Workbench.module.css";

interface ChartSpec {
  id: string;
  title: string;
  x: number[];
  series: { label: string; values: number[] }[];
}

/** Stock by site, cargo by train and every recorded series, in hours and units. */
export function chartSpecs(output: RunOutput): ChartSpec[] {
  const rows = output.stock ? output.stock.length / Math.max(1, output.sites.length) : 0;
  const step = Math.max(1, Math.floor(rows / 2000));
  const indices: number[] = [];
  for (let r = 0; r < rows; r += step) indices.push(r);
  const x = indices.map((r) => (r * output.tickMs) / HOUR_MS);
  const specs: ChartSpec[] = [];
  if (output.stock) {
    const stock = output.stock;
    specs.push({
      id: "stock",
      title: "Station stock (units)",
      x,
      series: output.sites.map((site, s) => ({
        label: `${site.station} ${site.resource}`,
        values: indices.map((r) => (stock[r * output.sites.length + s] as number) / 1000),
      })),
    });
  }
  if (output.cargo) {
    const cargo = output.cargo;
    const perTrain = output.resources.length;
    specs.push({
      id: "cargo",
      title: "Train cargo (units)",
      x,
      series: output.trains.map((train, k) => ({
        label: train,
        values: indices.map((r) => {
          let total = 0;
          for (let q = 0; q < perTrain; q++)
            total += cargo[(r * output.trains.length + k) * perTrain + q] as number;
          return total / 1000;
        }),
      })),
    });
  }
  for (const [name, series] of Object.entries(output.records)) {
    specs.push({
      id: `record-${name}`,
      title: `Recorded: ${name}`,
      x: series.t.map((t) => t / HOUR_MS),
      series: [{ label: name, values: series.v }],
    });
  }
  return specs;
}

function Chart({ spec }: { spec: ChartSpec }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let plot: uPlot | undefined;
    let disposed = false;
    const unsubscribe = playhead.subscribe(() => plot?.redraw(false, false));
    void import("uplot").then(({ default: UPlot }) => {
      if (disposed) return;
      const playheadLine: uPlot.Plugin = {
        hooks: {
          draw: (u) => {
            const hours = playhead.getState().t / HOUR_MS;
            const left = u.valToPos(hours, "x", true);
            const ctx = u.ctx;
            ctx.save();
            ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue(
              "--accent",
            );
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(left, u.bbox.top);
            ctx.lineTo(left, u.bbox.top + u.bbox.height);
            ctx.stroke();
            ctx.restore();
          },
          ready: (u) => {
            u.over.addEventListener("click", () => {
              const left = u.cursor.left ?? -1;
              if (left < 0) return;
              playhead.getState().pause();
              playhead.getState().setTime(u.posToVal(left, "x") * HOUR_MS);
            });
          },
        },
      };
      plot = new UPlot(
        {
          width: element.clientWidth || 600,
          height: 180,
          title: spec.title,
          scales: { x: { time: false } },
          axes: [{ label: "Hours", stroke: "currentColor" }, { stroke: "currentColor" }],
          series: [
            { label: "Hour" },
            ...spec.series.map((s, i) => ({
              label: s.label,
              stroke: PALETTE[i % PALETTE.length] as string,
              width: 1.5,
            })),
          ],
          plugins: [playheadLine],
        },
        [spec.x, ...spec.series.map((s) => s.values)],
        element,
      );
    });
    const resize = new ResizeObserver(() =>
      plot?.setSize({ width: element.clientWidth, height: 180 }),
    );
    resize.observe(element);
    return () => {
      disposed = true;
      unsubscribe();
      resize.disconnect();
      plot?.destroy();
    };
  }, [spec]);

  return <div ref={host} className={styles.chart} data-testid={`chart-${spec.id}`} />;
}

export function RunCharts() {
  const output = useWorkbench((s) => s.run.output);
  const specs = useMemo(() => (output ? chartSpecs(output) : []), [output]);
  if (!output) return null;
  return (
    <div className={styles.charts}>
      {specs.map((spec) => (
        <Chart key={spec.id} spec={spec} />
      ))}
    </div>
  );
}
