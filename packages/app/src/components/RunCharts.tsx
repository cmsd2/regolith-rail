import { useEffect, useMemo, useRef } from "react";
import type uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { type ChartSpec, chartSpecs } from "../lib/chart-specs.ts";
import { HOUR_MS, PALETTE } from "../lib/format.ts";
import { playhead, useWorkbench } from "../state/instance.ts";
import styles from "./Workbench.module.css";

/** Size of the playhead's chevrons, in CSS pixels. */
const CHEVRON = 5;

/**
 * Draws the playhead as a thin line in the text colour with a chevron at each end pointing inwards,
 * so it can't be mistaken for a data series or for the dashed hover cursor.
 */
function drawPlayhead(u: uPlot, hours: number) {
  const left = u.valToPos(hours, "x", true);
  const { top, height } = u.bbox;
  if (left < u.bbox.left || left > u.bbox.left + u.bbox.width) return;
  const ratio = devicePixelRatio || 1;
  const size = CHEVRON * ratio;
  const bottom = top + height;
  const colour = getComputedStyle(u.root).getPropertyValue("--text").trim() || "#000";
  const ctx = u.ctx;
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = ratio;
  ctx.beginPath();
  ctx.moveTo(left, top + size);
  ctx.lineTo(left, bottom);
  ctx.stroke();
  ctx.beginPath();
  // The top chevron hangs inside the plot; the bottom one sits below it, tip on the x axis.
  ctx.moveTo(left - size, top);
  ctx.lineTo(left + size, top);
  ctx.lineTo(left, top + size);
  ctx.closePath();
  ctx.moveTo(left - size, bottom + size);
  ctx.lineTo(left + size, bottom + size);
  ctx.lineTo(left, bottom);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
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
          draw: (u) => drawPlayhead(u, playhead.getState().t / HOUR_MS),
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
