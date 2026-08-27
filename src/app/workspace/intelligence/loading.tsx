import {
  IntelligencePage,
  IntelligenceSurface,
} from "@/components/intelligence/intelligence-ui";

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-2xl border border-[var(--slice-border)] bg-[linear-gradient(90deg,var(--slice-surface-muted)_25%,var(--slice-surface-strong)_42%,var(--slice-surface-muted)_63%)] bg-[length:300%_100%] ${className}`}
      aria-hidden="true"
    />
  );
}

export default function IntelligenceLoading() {
  return (
    <IntelligencePage>
      <IntelligenceSurface className="p-5 sm:p-7" aria-busy="true">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <Skeleton className="h-7 w-56" />
            <Skeleton className="mt-5 h-14 w-full max-w-4xl" />
            <Skeleton className="mt-3 h-14 w-full max-w-3xl" />
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          </div>
          <Skeleton className="min-h-64" />
        </div>
      </IntelligenceSurface>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-32" />
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </IntelligencePage>
  );
}
