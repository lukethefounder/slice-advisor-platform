import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Slice Advisor Platform",
  description: "Advisor operating system for client, market, AI, and team workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}