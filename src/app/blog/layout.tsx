import type { Metadata } from "next";

export const metadata: Metadata = {
  title:
    "Slice Intelligence Journal | Six Daily Sourced Articles",
  description:
    "Six sourced market, technology, economic, policy, and client-impact articles selected by the Slice intelligence engine each day at 6:00 AM Eastern Time.",
};

export default function BlogLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
