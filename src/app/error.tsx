"use client";

import { useEffect } from "react";

import { SystemStateScreen } from "@/components/system-state-screen";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Slice route error", {
      name: error.name,
      digest: error.digest,
    });
  }, [error]);

  return (
    <SystemStateScreen
      eyebrow="Workspace interruption"
      title="This area could not finish loading."
      description="Your information has not been intentionally changed. Retry the route, or return to the main Slice workspace and continue from there."
      primaryLabel="Try again"
      onPrimary={reset}
      secondaryLabel="Open workspace"
      secondaryHref="/workspace"
      reference={error.digest}
      announce
    />
  );
}