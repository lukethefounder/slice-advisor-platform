import type { Metadata } from "next";

import "./globals.css";
import "./market-green.css";

export const metadata: Metadata = {
  title: "Slice Advisor Platform",
  description:
    "Advisor operating system for client, market, AI, briefing, and team workflows.",
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
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}