import "server-only";

import { ApiError } from "@/lib/api-route";
import type { BackgroundJobRuntime } from "@/lib/background-jobs/queue";
import type { BackendContext } from "@/lib/backend/config";
import {
  markStoredWatchlistCheckFailed,
  runStoredWatchlistCheck,
} from "@/lib/watchlists/check";

export async function executeWorkspaceWatchlistScanJob(
  context: BackendContext,
  runtime: BackgroundJobRuntime,
) {
  const listId = String(
    runtime.payload.listId ?? "",
  ).trim();

  if (!listId) {
    throw new ApiError({
      status: 400,
      code: "WATCHLIST_JOB_PAYLOAD_INVALID",
      message:
        "The watchlist background-job payload is invalid.",
      expose: false,
    });
  }

  /*
   * BackendContext is shared by firm-scoped and user-only jobs, so firmId is
   * correctly nullable at the generic queue boundary. A persisted workspace
   * watchlist scan is always firm-scoped, however, and must not run without
   * an active firm. Narrow the value once and use the validated local string
   * for both execution and failure recording.
   */
  const firmId = context.firmId;

  if (!firmId) {
    throw new ApiError({
      status: 403,
      code: "WATCHLIST_ACTIVE_FIRM_REQUIRED",
      message:
        "An active firm workspace is required to run a watchlist scan.",
      expose: false,
    });
  }

  const userId = context.userId;

  try {
    return await runStoredWatchlistCheck({
      userId,
      firmId,
      listId,
      signal: runtime.signal,
      reportProgress:
        runtime.reportProgress,
    });
  } catch (error) {
    await markStoredWatchlistCheckFailed({
      userId,
      firmId,
      listId,
      error,
    }).catch(() => undefined);

    throw error;
  }
}