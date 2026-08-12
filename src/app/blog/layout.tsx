import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Slice Intelligence Journal | Sourced Market Articles",
  description:
    "The day’s most relevant sourced market, technology, economic, policy, and client-impact articles ranked by the Slice intelligence engine.",
};

export default function BlogLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}