import type { Metrics, Scenario } from "@regolith-rail/engine";
import { formatAmount, formatDuration, formatPercent } from "./format.ts";

export interface MetricDefinition {
  /** Identifies the metric in the page and in tests. */
  key: string;
  label: string;
  value(metrics: Metrics): number;
  /** Whether the metric means anything for a scenario; metrics without this always apply. */
  applies?(scenario: Scenario): boolean;
  /** Anchor on the metrics documentation page. */
  anchor: string;
  format(value: number): string;
  /** Whether smaller values are better, for comparisons. */
  lowerIsBetter: boolean;
}

const units = (v: number) => formatAmount(v);
const count = (v: number) => v.toLocaleString("en-GB");

const usesBackorders = (s: Scenario) =>
  s.stations.some((p) => p.consumers.some((c) => c.unmet === "backorder"));
const usesExpiry = (s: Scenario) => s.stations.some((p) => p.resources.some((r) => r.expires));
const usesSuppliers = (s: Scenario) => s.stations.some((p) => p.suppliers.length > 0);
const usesConverters = (s: Scenario) => s.stations.some((p) => p.converters.length > 0);

/** Whether a scenario states any cost. */
export function usesCosts(s: Scenario): boolean {
  return (
    s.vehicles.some((v) => (v.costPerDistance ?? 0) > 0) ||
    s.stations.some(
      (p) =>
        p.resources.some((r) => (r.holdingCost ?? 0) > 0) ||
        p.suppliers.some((x) => (x.orderCost ?? 0) > 0 || (x.unitCost ?? 0) > 0) ||
        p.producers.some((f) => (f.stallCost ?? 0) > 0) ||
        p.consumers.some((f) => (f.lostCost ?? 0) > 0 || (f.backorderCost ?? 0) > 0),
    )
  );
}

const costs: MetricDefinition[] = (
  [
    ["total", "Total cost", "total-cost"],
    ["holding", "Holding cost", "holding-cost"],
    ["ordering", "Ordering cost", "ordering-cost"],
    ["transport", "Transport cost", "transport-cost"],
    ["lostDemand", "Lost demand cost", "lost-demand-cost"],
    ["backorders", "Backorder cost", "backorder-cost"],
    ["stalledProduction", "Stalled production cost", "stalled-production-cost"],
  ] as const
).map(([part, label, anchor]) => ({
  key: `costs.${part}`,
  value: (m: Metrics) => m.costs[part],
  label,
  anchor,
  // Costs are reported in thousandths, like milli-units.
  format: units,
  lowerIsBetter: true,
  applies: usesCosts,
}));

export const METRICS: MetricDefinition[] = [
  {
    key: "unmetDemandWeighted",
    value: (m) => m.unmetDemandWeighted,
    label: "Unmet demand (weighted)",
    anchor: "unmet-demand-weighted",
    format: units,
    lowerIsBetter: true,
  },
  {
    key: "unmetDemand",
    value: (m) => m.unmetDemand,
    label: "Unmet demand",
    anchor: "unmet-demand",
    format: units,
    lowerIsBetter: true,
  },
  {
    key: "stalledProduction",
    value: (m) => m.stalledProduction,
    label: "Stalled production",
    anchor: "stalled-production",
    format: units,
    lowerIsBetter: true,
  },
  {
    key: "demandMet",
    value: (m) => m.demandMet,
    label: "Demand met",
    anchor: "demand-met",
    format: units,
    lowerIsBetter: false,
  },
  {
    key: "emptyDistanceShare",
    value: (m) => m.emptyDistanceShare,
    label: "Empty distance",
    anchor: "empty-distance-share",
    format: formatPercent,
    lowerIsBetter: true,
  },
  {
    key: "dwellMs",
    value: (m) => m.dwellMs,
    label: "Total dwell time",
    anchor: "dwell-time",
    format: formatDuration,
    lowerIsBetter: true,
  },
  {
    key: "oscillations",
    value: (m) => m.oscillations,
    label: "Oscillations",
    anchor: "oscillations",
    format: count,
    lowerIsBetter: true,
  },
  {
    key: "stops",
    value: (m) => m.stops,
    label: "Stops",
    anchor: "stops",
    format: count,
    lowerIsBetter: false,
  },
  {
    key: "transferred",
    value: (m) => m.transferred,
    label: "Transferred",
    anchor: "transferred",
    format: units,
    lowerIsBetter: false,
  },
  {
    key: "warnings",
    value: (m) => m.warnings,
    label: "Clamped actions",
    anchor: "warnings",
    format: count,
    lowerIsBetter: true,
  },
  {
    key: "policyErrors",
    value: (m) => m.policyErrors,
    label: "Policy errors",
    anchor: "policy-errors",
    format: count,
    lowerIsBetter: true,
  },
  {
    key: "budgetOverruns",
    value: (m) => m.budgetOverruns,
    label: "Budget overruns",
    anchor: "budget-overruns",
    format: count,
    lowerIsBetter: true,
  },
  {
    key: "backorderAverage",
    value: (m) => m.backorderAverage,
    label: "Backorders (average)",
    anchor: "backorders-average",
    format: units,
    lowerIsBetter: true,
    applies: usesBackorders,
  },
  {
    key: "backorderPeak",
    value: (m) => m.backorderPeak,
    label: "Backorders (peak)",
    anchor: "backorders-peak",
    format: units,
    lowerIsBetter: true,
    applies: usesBackorders,
  },
  {
    key: "expired",
    value: (m) => m.expired,
    label: "Expired stock",
    anchor: "expired-stock",
    format: units,
    lowerIsBetter: true,
    applies: usesExpiry,
  },
  {
    key: "overflow",
    value: (m) => m.overflow,
    label: "Delivery overflow",
    anchor: "delivery-overflow",
    format: units,
    lowerIsBetter: true,
    applies: usesSuppliers,
  },
  {
    key: "converterStarvedMs",
    value: (m) => m.converterStarvedMs,
    label: "Converters starved",
    anchor: "converters-starved",
    format: formatDuration,
    lowerIsBetter: true,
    applies: usesConverters,
  },
  {
    key: "converterBlockedMs",
    value: (m) => m.converterBlockedMs,
    label: "Converters blocked",
    anchor: "converters-blocked",
    format: formatDuration,
    lowerIsBetter: true,
    applies: usesConverters,
  },
  ...costs,
];

/** The metrics that mean something for a scenario, in display order. */
export function metricsFor(scenario: Scenario | null | undefined): MetricDefinition[] {
  return METRICS.filter((metric) => !metric.applies || (scenario && metric.applies(scenario)));
}
