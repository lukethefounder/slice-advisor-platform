import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Slice | Real-Time Market Intelligence",
  description:
    "Slice is a real-time market intelligence and alert platform for investors, advisors, and institutions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}