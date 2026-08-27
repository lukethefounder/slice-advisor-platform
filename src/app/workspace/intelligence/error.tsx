"use client";

import {
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

import {
  IntelligenceNotice,
  IntelligencePage,
  IntelligenceSurface,
} from "@/components/intelligence/intelligence-ui";

export default function IntelligenceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <IntelligencePage>
      <IntelligenceSurface className="p-6 sm:p-8">
        <div className="grid min-h-[420px] place-items-center text-center">
          <div className="max-w-2xl">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-rose-600/20 bg-rose-50 text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-100">
              <AlertTriangle className="h-8 w-8" />
            </span>
            <h1 className="mt-5 text-3xl font-black tracking-[-0.04em] text-[var(--slice-heading)]">
              This intelligence route could not finish loading
            </h1>
            <p className="mt-3 text-sm font-semibold leading-7 text-[var(--slice-muted)]">
              The failure is isolated to this route. The rest of the
              advisor workspace remains available, and retrying does not
              require a full application refresh.
            </p>

            <IntelligenceNotice className="mt-5 text-left" tone="rose">
              {error.message ||
                "An unexpected intelligence route error occurred."}
              {error.digest ? (
                <span className="mt-1 block text-[10px] opacity-70">
                  Diagnostic reference: {error.digest}
                </span>
              ) : null}
            </IntelligenceNotice>

            <button
              type="button"
              onClick={reset}
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--slice-accent-strong)] px-5 text-sm font-black text-white"
            >
              <RefreshCw className="h-4 w-4" />
              Retry this route
            </button>
          </div>
        </div>
      </IntelligenceSurface>
    </IntelligencePage>
  );
}
