export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const SOL_MS = 24 * HOUR_MS;

/** Milli-units as units, with one decimal place when needed. */
export function formatAmount(milliUnits: number): string {
  const units = milliUnits / 1000;
  return Number.isInteger(units)
    ? units.toLocaleString("en-GB")
    : units.toLocaleString("en-GB", { maximumFractionDigits: 1 });
}

/** Game time as "Sol 2, 14:05", counting sols from 1. */
export function formatGameTime(ms: number): string {
  const sol = Math.floor(ms / SOL_MS) + 1;
  const withinSol = ms - (sol - 1) * SOL_MS;
  const hours = Math.floor(withinSol / HOUR_MS);
  const minutes = Math.floor((withinSol - hours * HOUR_MS) / MINUTE_MS);
  return `Sol ${sol}, ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatDuration(ms: number): string {
  if (ms >= SOL_MS)
    return `${(ms / SOL_MS).toLocaleString("en-GB", { maximumFractionDigits: 1 })} sols`;
  if (ms >= HOUR_MS)
    return `${(ms / HOUR_MS).toLocaleString("en-GB", { maximumFractionDigits: 1 })} h`;
  return `${Math.round(ms / MINUTE_MS)} min`;
}

export function formatPercent(fraction: number): string {
  return `${(fraction * 100).toLocaleString("en-GB", { maximumFractionDigits: 1 })}%`;
}

/** Link to a documentation page, respecting the base path. */
export function docsHref(slug: string): string {
  return `${import.meta.env.BASE_URL}docs/${slug}`;
}

/** Distinct colours for resources and trains, readable on light and dark backgrounds. */
export const PALETTE = [
  "#d9632b",
  "#2f8fbf",
  "#6aa84f",
  "#b35ea8",
  "#c9a227",
  "#4c9a8c",
  "#8f6bd6",
];
