"use client";

import { RotateCcw } from "lucide-react";

import {
  WorkspaceAlert,
  WorkspaceButton,
  WorkspaceSurface,
} from "@/components/workspace/core/workspace-ui";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="grid min-h-[calc(100dvh-4rem)] place-items-center p-5">
      <WorkspaceSurface className="w-full max-w-2xl p-6 sm:p-8">
        <WorkspaceAlert tone="error" title="This workspace section could not load">
          The failure was contained to this route. Retry the section or return to the workspace home.
          {error.digest ? (
            <span className="mt-2 block text-xs text-rose-200/75">
              Error reference: {error.digest}
            </span>
          ) : null}
        </WorkspaceAlert>
        <div className="mt-5 flex flex-wrap gap-2">
          <WorkspaceButton
            variant="primary"
            icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}
            onClick={reset}
          >
            Retry section
          </WorkspaceButton>
          <WorkspaceButton href="/workspace" variant="secondary">
            Return to workspace
          </WorkspaceButton>
        </div>
      </WorkspaceSurface>
    </div>
  );
}