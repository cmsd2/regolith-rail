import type { RunOutput } from "@regolith-rail/engine";
import { HOUR_MS } from "./format.ts";

export interface ChartSpec {
  id: string;
  title: string;
  x: number[];
  series: { label: string; values: number[] }[];
}

/**
 * Stock by site, cargo by vehicle and every recorded series, in hours and units. Charts with
 * nothing to plot, such as cargo in a scenario without vehicles, are left out.
 */
export function chartSpecs(output: RunOutput): ChartSpec[] {
  const rows = output.stock ? output.stock.length / Math.max(1, output.sites.length) : 0;
  const step = Math.max(1, Math.floor(rows / 2000));
  const indices: number[] = [];
  for (let r = 0; r < rows; r += step) indices.push(r);
  const x = indices.map((r) => (r * output.tickMs) / HOUR_MS);
  const specs: ChartSpec[] = [];
  if (output.stock && output.sites.length > 0) {
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
  if (output.cargo && output.trains.length > 0) {
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
