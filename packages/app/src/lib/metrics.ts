import type { Metrics } from "@regolith-rail/engine";
import { formatAmount, formatDuration, formatPercent } from "./format.ts";

export interface MetricDefinition {
  key: keyof Omit<Metrics, "byResource">;
  label: string;
  /** Anchor on the metrics documentation page. */
  anchor: string;
  format(value: number): string;
  /** Whether smaller values are better, for comparisons. */
  lowerIsBetter: boolean;
}

const units = (v: number) => formatAmount(v);
const count = (v: number) => v.toLocaleString("en-GB");

export const METRICS: MetricDefinition[] = [
  {
    key: "unmetDemandWeighted",
    label: "Unmet demand (weighted)",
    anchor: "unmet-demand-weighted",
    format: units,
    lowerIsBetter: true,
  },
  {
    key: "unmetDemand",
    label: "Unmet demand",
    anchor: "unmet-demand",
    format: units,
    lowerIsBetter: true,
  },
  {
    key: "stalledProduction",
    label: "Stalled production",
    anchor: "stalled-production",
    format: units,
    lowerIsBetter: true,
  },
  {
    key: "demandMet",
    label: "Demand met",
    anchor: "demand-met",
    format: units,
    lowerIsBetter: false,
  },
  {
    key: "emptyDistanceShare",
    label: "Empty distance",
    anchor: "empty-distance-share",
    format: formatPercent,
    lowerIsBetter: true,
  },
  {
    key: "dwellMs",
    label: "Total dwell time",
    anchor: "dwell-time",
    format: formatDuration,
    lowerIsBetter: true,
  },
  {
    key: "oscillations",
    label: "Oscillations",
    anchor: "oscillations",
    format: count,
    lowerIsBetter: true,
  },
  { key: "stops", label: "Stops", anchor: "stops", format: count, lowerIsBetter: false },
  {
    key: "transferred",
    label: "Transferred",
    anchor: "transferred",
    format: units,
    lowerIsBetter: false,
  },
  {
    key: "warnings",
    label: "Clamped actions",
    anchor: "warnings",
    format: count,
    lowerIsBetter: true,
  },
  {
    key: "policyErrors",
    label: "Policy errors",
    anchor: "policy-errors",
    format: count,
    lowerIsBetter: true,
  },
  {
    key: "budgetOverruns",
    label: "Budget overruns",
    anchor: "budget-overruns",
    format: count,
    lowerIsBetter: true,
  },
];
