/** Display-only settings. Never store transcripts, quotes, credentials or client data here. */
export type EffectLevel = "balanced" | "rich" | "quiet";
export const EFFECT_OPTIONS: ReadonlyArray<{ value: EffectLevel; label: string; description: string }> = [
  { value: "balanced", label: "Balanced", description: "Crisp surfaces, gentle feedback and restrained effects." },
  { value: "rich", label: "Immersive", description: "More depth and soft glass on supported surfaces." },
  { value: "quiet", label: "Low effects", description: "Remove decorative animation and expensive surface effects. All data and tools remain." },
];
export function parseEffectLevel(value: unknown): EffectLevel {
  return value === "rich" || value === "quiet" ? value : "balanced";
}
export function effectStorageKey(scope: string | null): string | null {
  if (!scope || scope.length > 512) return null;
  return `slice-display-effects-v1:${encodeURIComponent(scope)}`;
}
export function readEffectLevel(storage: Pick<Storage, "getItem"> | null, scope: string | null): EffectLevel {
  const key = effectStorageKey(scope);
  if (!storage || !key) return "balanced";
  try { return parseEffectLevel(storage.getItem(key)); } catch { return "balanced"; }
}
export function saveEffectLevel(storage: Pick<Storage, "setItem"> | null, scope: string | null, level: EffectLevel): boolean {
  const key = effectStorageKey(scope);
  if (!storage || !key) return false;
  try { storage.setItem(key, parseEffectLevel(level)); return true; } catch { return false; }
}
