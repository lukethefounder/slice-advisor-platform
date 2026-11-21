export const NEURAL_THEME_MIGRATION_KEY = "slice-neural-default-v1";

/** Self-contained so the exact resolver can also run before React hydrates. */
export function resolveNeuralTheme(
  storage: Pick<Storage, "getItem" | "setItem"> | null,
  prefersDark = true,
) {
  const settingsKey = "slice-workspace-settings-v5";
  const themeKey = "slice-theme-mode-v1";
  const migrationKey = "slice-neural-default-v1";
  const record = (value: unknown): Record<string, unknown> =>
    value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown> : {};
  const read = (key: string) => { try { return storage?.getItem(key) ?? null; } catch { return null; } };
  const write = (key: string, value: string) => { try { if (!storage) return false; storage.setItem(key, value); return true; } catch { return false; } };
  let stored: Record<string, unknown> = {};
  try { stored = record(JSON.parse(read(settingsKey) || "{}")); } catch { /* Use the neural default. */ }
  let appearance = record(stored.appearance);
  if (read(migrationKey) !== "complete") {
    // Replace the previous forced light default once; retain every other setting.
    appearance = Object.assign({}, appearance, { mode: "dark" });
    stored = Object.assign({}, stored, { appearance });
    if (record(stored.privacy).allowBrowserStorage !== false) {
      if (write(settingsKey, JSON.stringify(stored))) {
        write(themeKey, "dark");
        write(migrationKey, "complete");
      }
    }
  }
  const candidate = appearance.mode ?? read(themeKey);
  const mode: "dark" | "light" | "system" = candidate === "light" || candidate === "system" || candidate === "dark" ? candidate : "dark";
  const resolvedTheme: "dark" | "light" = mode === "system" ? (prefersDark ? "dark" : "light") : mode;
  return { mode, resolvedTheme, stored };
}

/** The resolver contains no outer references, so build-time function serialization is safe. */
export const NEURAL_THEME_BOOTSTRAP = String.raw`
(function () {
  var storage = null;
  var prefersDark = true;
  try { storage = window.localStorage; } catch (_) {}
  try { prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches; } catch (_) {}
  var snapshot = (${resolveNeuralTheme.toString()})(storage, prefersDark);
  var root = document.documentElement;
  root.dataset.sliceTheme = snapshot.resolvedTheme;
  root.dataset.sliceAppearance = snapshot.resolvedTheme;
  root.dataset.sliceThemeMode = snapshot.mode;
  root.dataset.sliceAppearancePreference = snapshot.mode;
  root.dataset.sliceBrand = "neural";
  root.style.colorScheme = snapshot.resolvedTheme;
  root.classList.toggle("dark", snapshot.resolvedTheme === "dark");
  var appearance = snapshot.stored.appearance;
  if (!appearance || typeof appearance !== "object" || Array.isArray(appearance)) appearance = {};
  var density = appearance.density;
  if (density == null) { try { density = storage && storage.getItem("slice-density-mode-v1"); } catch (_) {} }
  root.dataset.sliceDensity = ["comfortable", "compact", "spacious"].indexOf(density) >= 0 ? density : "comfortable";
  root.dataset.sliceMotion = appearance.motion === "reduced" ? "reduced" : "full";
  var textScale = appearance.textScale === "large" || appearance.textScale === "extra-large" ? appearance.textScale : "standard";
  root.dataset.sliceTextScale = textScale;
  root.style.setProperty("--slice-text-scale", textScale === "extra-large" ? "1.095" : textScale === "large" ? "1.045" : "1");
})();
`;
