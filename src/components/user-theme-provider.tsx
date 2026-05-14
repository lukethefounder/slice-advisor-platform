"use client";

import { useEffect } from "react";

type UiPreference = {
  accentName: string;
  accentHex: string;
  accentDarkHex: string;
  accentSoftHex: string;
};

function hexToRgb(hex: string) {
  const cleaned = hex.replace("#", "");
  const value = Number.parseInt(cleaned, 16);

  if (!Number.isFinite(value)) return null;

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function lighten(hex: string, amount: number) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const r = Math.round(rgb.r + (255 - rgb.r) * amount);
  const g = Math.round(rgb.g + (255 - rgb.g) * amount);
  const b = Math.round(rgb.b + (255 - rgb.b) * amount);

  return `rgb(${r} ${g} ${b})`;
}

function darken(hex: string, amount: number) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const r = Math.round(rgb.r * (1 - amount));
  const g = Math.round(rgb.g * (1 - amount));
  const b = Math.round(rgb.b * (1 - amount));

  return `rgb(${r} ${g} ${b})`;
}

export default function UserThemeProvider() {
  useEffect(() => {
    async function loadTheme() {
      try {
        const response = await fetch("/api/personal-bot", {
          cache: "no-store",
        });

        if (!response.ok) return;

        const payload = await response.json();
        const preference = payload.uiPreference as UiPreference | undefined;

        if (!preference?.accentHex) return;

        const root = document.documentElement;

        root.dataset.sliceUserTheme = "true";
        root.style.setProperty("--slice-accent-300", lighten(preference.accentHex, 0.55));
        root.style.setProperty("--slice-accent-400", lighten(preference.accentHex, 0.32));
        root.style.setProperty("--slice-accent-500", preference.accentHex);
        root.style.setProperty("--slice-accent-600", preference.accentHex);
        root.style.setProperty("--slice-accent-700", darken(preference.accentHex, 0.18));
        root.style.setProperty("--slice-accent-900", preference.accentDarkHex || darken(preference.accentHex, 0.45));
        root.style.setProperty("--slice-accent-soft", preference.accentSoftHex || lighten(preference.accentHex, 0.78));
      } catch {
        // Theme should not block app rendering.
      }
    }

    void loadTheme();

    window.addEventListener("slice-theme-updated", loadTheme);

    return () => {
      window.removeEventListener("slice-theme-updated", loadTheme);
    };
  }, []);

  return null;
}