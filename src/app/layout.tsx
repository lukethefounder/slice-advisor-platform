import type { Metadata, Viewport } from "next";

import WebVitalsReporter from "@/components/production/web-vitals-reporter";
import ChunkRecovery from "@/components/system/chunk-recovery";

import "./globals.css";
import "./market-green.css";

const themeBootstrap = String.raw`
(function () {
  try {
    var themeKey = "slice-theme-mode-v1";
    var settingsKey = "slice-workspace-settings-v5";
    var migrationKey = "slice-light-default-v1";
    var stored = {};

    try {
      stored = JSON.parse(localStorage.getItem(settingsKey) || "{}") || {};
    } catch (_) {
      stored = {};
    }

    if (!localStorage.getItem(migrationKey)) {
      stored.appearance = Object.assign({}, stored.appearance || {}, {
        mode: "light"
      });
      localStorage.setItem(settingsKey, JSON.stringify(stored));
      localStorage.setItem(themeKey, "light");
      localStorage.setItem(migrationKey, "complete");
    }

    var mode =
      (stored.appearance && stored.appearance.mode) ||
      localStorage.getItem(themeKey) ||
      "light";

    if (mode !== "dark" && mode !== "light" && mode !== "system") {
      mode = "light";
    }

    var resolved = mode === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : mode;

    var root = document.documentElement;
    root.dataset.sliceTheme = resolved;
    root.dataset.sliceAppearance = resolved;
    root.dataset.sliceThemeMode = mode;
    root.dataset.sliceBrand = "market-green";
    root.style.colorScheme = resolved;
    root.classList.toggle("dark", resolved === "dark");
  } catch (_) {
    document.documentElement.dataset.sliceTheme = "light";
    document.documentElement.dataset.sliceAppearance = "light";
    document.documentElement.dataset.sliceThemeMode = "light";
    document.documentElement.style.colorScheme = "light";
  }
})();
`;

export const metadata: Metadata = {
  title: {
    default: "Slice Advisor Platform",
    template: "%s | Slice",
  },
  description:
    "Advisor operating system for client, market, AI, briefing, document, communication, and firm workflows.",
  applicationName: "Slice Advisor Platform",
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7fcf9" },
    { media: "(prefers-color-scheme: dark)", color: "#010604" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-slice-brand="market-green"
      data-slice-theme="light"
      data-slice-appearance="light"
      data-slice-theme-mode="light"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="slice-app-theme" suppressHydrationWarning>
        <a
          href="#slice-main-content"
          className="sr-only z-[2147483647] rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white shadow-xl focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
        >
          Skip to main content
        </a>
        <div id="slice-main-content" className="min-h-dvh">
          {children}
        </div>
        <WebVitalsReporter />
        <ChunkRecovery />
      </body>
    </html>
  );
}