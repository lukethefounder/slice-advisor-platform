import type { ReactNode } from "react";

import IntelligenceNavigation from "@/components/intelligence/intelligence-navigation";

export default function IntelligenceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-full bg-[var(--slice-bg)] text-[var(--slice-text)]">
      <IntelligenceNavigation />
      {children}
    </div>
  );
}