import WorkspaceMotion from "@/components/performance/workspace-motion";
import "./strategy-motion.css";
import type { Metadata, Viewport } from "next";

import WebVitalsReporter from "@/components/production/web-vitals-reporter";
import ChunkRecovery from "@/components/system/chunk-recovery";

import "./globals.css";
import "./market-green.css";
import "./connected-experience.css";
import NavigationAccelerator from "@/components/performance/navigation-accelerator";
import "./experience-polish.css";
import "./scenario-experience.css";
import "./future-experience.css";
import "./neural-theme.css";
import PlatformAppearance from "@/components/experience/platform-appearance";
import { NEURAL_THEME_BOOTSTRAP } from "@/lib/workspace/theme-bootstrap";
import { researchBetaEnabled } from "@/lib/research/beta-policy";
// slice-market-speed-runtime-v1


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
  colorScheme: "dark light",
  themeColor: "#030811",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html data-scroll-behavior="smooth"
      lang="en"
      className="dark"
      data-slice-brand="neural"
      data-slice-beta={String(researchBetaEnabled(process.env))}
      data-slice-theme="dark"
      data-slice-appearance="dark"
      data-slice-theme-mode="dark"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: NEURAL_THEME_BOOTSTRAP }} />
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
        <NavigationAccelerator />
        <PlatformAppearance />
        <WebVitalsReporter />
        <ChunkRecovery />
      <WorkspaceMotion />
      </body>
    </html>
  );
}
