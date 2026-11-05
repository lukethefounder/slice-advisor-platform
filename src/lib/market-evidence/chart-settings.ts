/** Browser-safe chart preferences. Presentation never changes provider observations. */
export type ChartSettings = {
  mode: "area" | "line" | "candles";
  scale: "price" | "percent" | "log";
  height: "compact" | "standard" | "tall";
  accent: "emerald" | "cyan" | "violet";
  session: "all" | "regular";
  showVolume: boolean;
  showGrid: boolean;
  showCrosshair: boolean;
  sma20: boolean;
  sma50: boolean;
  ema20: boolean;
  bands20: boolean;
  compareSymbol: string | null;
  referencePrice: number | null;
};
export const DEFAULT_CHART: ChartSettings = {
  mode: "area", scale: "price", height: "standard", accent: "emerald", session: "all",
  showVolume: true, showGrid: true, showCrosshair: true,
  sma20: false, sma50: false, ema20: false, bands20: false,
  compareSymbol: null, referencePrice: null,
};
export const WIDGET_IDS = ["tasks", "research", "scenarios", "news"] as const;
export type WidgetId = typeof WIDGET_IDS[number];
export class ChartSettingsError extends Error {}
function record(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new ChartSettingsError("Chart settings must be an object.");
  return v as Record<string, unknown>;
}
function choice<T extends string>(v: unknown, values: readonly T[], fallback: T, label: string): T {
  if (v === undefined) return fallback;
  if (typeof v !== "string" || !values.includes(v as T)) throw new ChartSettingsError(`Choose a supported ${label}.`);
  return v as T;
}
export function parseChartSettings(value: unknown, universe?: string[], primary?: string): ChartSettings {
  if (value === undefined) return { ...DEFAULT_CHART };
  const p = record(value), flags = { ...DEFAULT_CHART };
  for (const k of ["showVolume", "showGrid", "showCrosshair", "sma20", "sma50", "ema20", "bands20"] as const) {
    if (p[k] !== undefined && typeof p[k] !== "boolean") throw new ChartSettingsError(`Use a true/false value for ${k}.`);
    if (typeof p[k] === "boolean") flags[k] = p[k];
  }
  let compareSymbol: string | null = null;
  if (p.compareSymbol !== undefined && p.compareSymbol !== null && p.compareSymbol !== "") {
    if (typeof p.compareSymbol !== "string") throw new ChartSettingsError("Choose a valid comparison ticker.");
    compareSymbol = p.compareSymbol.trim().toUpperCase();
    if (!/^(?:INDEX:)?[A-Z][A-Z0-9.-]{0,14}$/.test(compareSymbol) || (universe && !universe.includes(compareSymbol))) throw new ChartSettingsError("Choose a comparison from your selected symbols.");
    // Selecting a new primary must never make an otherwise valid saved view unusable.
    if (compareSymbol === primary) compareSymbol = null;
  }
  const referencePrice = p.referencePrice === undefined || p.referencePrice === null ? null : p.referencePrice;
  if (referencePrice !== null && (typeof referencePrice !== "number" || !Number.isFinite(referencePrice) || referencePrice <= 0 || referencePrice > 1e9)) throw new ChartSettingsError("Reference price must be a positive number, or left blank.");
  return {
    ...flags,
    mode: choice(p.mode, ["area", "line", "candles"], "area", "chart style"),
    scale: choice(p.scale, ["price", "percent", "log"], "price", "price scale"),
    height: choice(p.height, ["compact", "standard", "tall"], "standard", "chart height"),
    accent: choice(p.accent, ["emerald", "cyan", "violet"], "emerald", "chart accent"),
    session: choice(p.session, ["all", "regular"], "all", "session filter"),
    compareSymbol, referencePrice,
  };
}
export function parseWidgetOrder(value: unknown): WidgetId[] {
  if (value === undefined) return [...WIDGET_IDS];
  if (!Array.isArray(value) || value.length !== WIDGET_IDS.length || new Set(value).size !== WIDGET_IDS.length || !value.every(v => WIDGET_IDS.includes(v))) throw new ChartSettingsError("Widget order must contain each workspace section exactly once.");
  return [...value] as WidgetId[];
}
export function chartPreset(name: "overview" | "technical" | "minimal", current: ChartSettings): ChartSettings {
  const base = { ...DEFAULT_CHART, accent: current.accent, height: current.height, compareSymbol: current.compareSymbol, session: current.session };
  if (name === "technical") return { ...base, mode: "candles", sma20: true, ema20: true };
  if (name === "minimal") return { ...base, mode: "line", showVolume: false, showGrid: false };
  return base;
}
