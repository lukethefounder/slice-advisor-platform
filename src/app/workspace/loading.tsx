import {
  WorkspaceSkeleton,
  WorkspaceSurface,
} from "@/components/workspace/core/workspace-ui";

export default function WorkspaceLoading() {
  return (
    <div className="min-h-[calc(100dvh-4rem)] p-4 sm:p-5 lg:p-6" role="status" aria-label="Loading workspace">
      <div className="mx-auto grid max-w-[1700px] gap-4">
        <WorkspaceSurface className="p-5 sm:p-6">
          <WorkspaceSkeleton lines={3} />
        </WorkspaceSurface>
        <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <WorkspaceSurface className="p-5">
            <WorkspaceSkeleton lines={7} />
          </WorkspaceSurface>
          <WorkspaceSurface className="p-5">
            <WorkspaceSkeleton lines={10} />
          </WorkspaceSurface>
        </div>
      </div>
      <span className="sr-only">Loading workspace content.</span>
    </div>
  );
}