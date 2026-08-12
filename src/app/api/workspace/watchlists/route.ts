import { ApiError, withApiRoute } from "@/lib/api-route";
import { requireCurrentAccessContext } from "@/lib/access-control";
import { listBackgroundJobs } from "@/lib/background-jobs/queue";
import { enqueueBackendJob } from "@/lib/backend/jobs";
import { noStoreJson } from "@/lib/client-data-security";
import {
  isPotentiallyCrossSiteUnsafeRequest,
} from "@/lib/security";
import {
  eligibleWatchlist,
  findWatchlist,
  loadWatchlistWorkspace,
  nextWatchlistScanAt,
  saveWatchlistEditorState,
  saveWatchlistWorkspace,
  watchlistWorkspaceExists,
  type WatchlistWorkspaceState,
} from "@/lib/watchlists/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

type Body = {
  action?: unknown;
  state?: unknown;
  listId?: unknown;
};

function clean(value: unknown, maximum = 160) {
  return String(value ?? "")
    .replace(/[\r\n\u0000]+/g, " ")
    .trim()
    .slice(0, maximum);
}

async function context() {
  const access = await requireCurrentAccessContext({ requireFirm: true });

  if (!access.firm) {
    throw new ApiError({
      status: 403,
      code: "ACTIVE_FIRM_REQUIRED",
      message: "An active firm workspace is required.",
      expose: true,
    });
  }

  return access;
}

async function responsePayload(input: {
  userId: string;
  firmId: string;
  state?: WatchlistWorkspaceState;
}) {
  const [state, jobs] = await Promise.all([
    input.state ?? loadWatchlistWorkspace(input),
    listBackgroundJobs({
      userId: input.userId,
      firmId: input.firmId,
      limit: 50,
      includePayload: true,
    }),
  ]);
  const watchlistJobs = jobs.filter(
    (job) => job.jobKey === "workspace_watchlist_scan",
  );
  const allLists = [...state.lists, state.customBoardList];

  return {
    ok: true,
    state,
    jobs: watchlistJobs,
    metrics: {
      listCount: allLists.length,
      enabledCount: allLists.filter((list) => list.enabled).length,
      readyCount: allLists.filter(eligibleWatchlist).length,
      securityCount: allLists.reduce((sum, list) => sum + list.items.length, 0),
      ruleCount: allLists.reduce(
        (sum, list) => sum + list.constraints.filter((rule) => rule.enabled).length,
        0,
      ),
      eventCount: state.events.length,
      criticalEventCount: state.events.filter((event) => event.priority === "Critical").length,
      activeJobCount: watchlistJobs.filter((job) =>
        ["Queued", "Retrying", "Processing"].includes(job.status),
      ).length,
    },
    nextScans: Object.fromEntries(
      allLists.map((list) => [list.id, nextWatchlistScanAt(list)]),
    ),
    generatedAt: new Date().toISOString(),
  };
}

export const GET = withApiRoute(
  {
    route: "/api/workspace/watchlists",
    timeoutMs: 15_000,
  },
  async () => {
    const access = await context();
    return noStoreJson(
      await responsePayload({
        userId: access.user.id,
        firmId: access.firm!.id,
      }),
    );
  },
);

export const POST = withApiRoute(
  {
    route: "/api/workspace/watchlists",
    timeoutMs: 20_000,
  },
  async ({ request }) => {
    const access = await context();

    if (isPotentiallyCrossSiteUnsafeRequest(request)) {
      throw new ApiError({
        status: 403,
        code: "CROSS_SITE_REQUEST_BLOCKED",
        message: "Security policy blocked this watchlist request.",
        expose: true,
      });
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      throw new ApiError({
        status: 415,
        code: "JSON_CONTENT_TYPE_REQUIRED",
        message: "Watchlist actions require a JSON request body.",
        expose: true,
      });
    }

    const body = (await request.json().catch(() => null)) as Body | null;
    if (!body) {
      throw new ApiError({
        status: 400,
        code: "INVALID_JSON_BODY",
        message: "Enter a valid watchlist request.",
        expose: true,
      });
    }

    const action = clean(body.action, 50);

    if (action === "syncLegacyState") {
      const exists = await watchlistWorkspaceExists({
        userId: access.user.id,
        firmId: access.firm!.id,
      });
      const state = exists
        ? await loadWatchlistWorkspace({
            userId: access.user.id,
            firmId: access.firm!.id,
          })
        : await saveWatchlistWorkspace({
            userId: access.user.id,
            firmId: access.firm!.id,
            state: body.state,
          });

      return noStoreJson(
        {
          ...(await responsePayload({
            userId: access.user.id,
            firmId: access.firm!.id,
            state,
          })),
          message: exists
            ? "Existing server watchlists were preserved."
            : "Browser watchlists were migrated to durable Slice storage.",
        },
      );
    }

    let state = await loadWatchlistWorkspace({
      userId: access.user.id,
      firmId: access.firm!.id,
    });

    if (action === "saveState") {
      state = await saveWatchlistEditorState({
        userId: access.user.id,
        firmId: access.firm!.id,
        state: body.state,
      });

      return noStoreJson(
        await responsePayload({
          userId: access.user.id,
          firmId: access.firm!.id,
          state,
        }),
      );
    }


    if (action === "clearEvents") {
      const listId = clean(body.listId, 160);
      state = await saveWatchlistWorkspace({
        userId: access.user.id,
        firmId: access.firm!.id,
        state: {
          ...state,
          events: listId
            ? state.events.filter((event) => event.listId !== listId)
            : [],
        },
      });

      return noStoreJson(
        await responsePayload({
          userId: access.user.id,
          firmId: access.firm!.id,
          state,
        }),
      );
    }

    if (action === "scanNow" || action === "scanAll") {
      if (body.state) {
        state = await saveWatchlistEditorState({
          userId: access.user.id,
          firmId: access.firm!.id,
          state: body.state,
        });
      }

      const requestedListId = clean(body.listId, 160);
      const targets =
        action === "scanAll"
          ? [...state.lists, state.customBoardList].filter(eligibleWatchlist)
          : [findWatchlist(state, requestedListId)].filter(
              (list): list is NonNullable<typeof list> => Boolean(list),
            );

      if (!targets.length) {
        throw new ApiError({
          status: 409,
          code: "WATCHLIST_SCAN_TARGET_MISSING",
          message: "No enabled watchlist with securities and active rules is ready to scan.",
          expose: true,
        });
      }

      const minuteBucket = Math.floor(Date.now() / 60_000);
      const activeJobs = await listBackgroundJobs({
        userId: access.user.id,
        firmId: access.firm!.id,
        statuses: ["Queued", "Retrying", "Processing"],
        limit: 50,
        includePayload: true,
      });
      const activeByList = new Map(
        activeJobs
          .filter((job) => job.jobKey === "workspace_watchlist_scan")
          .map((job) => [String(job.payload?.listId ?? "").trim(), job] as const)
          .filter(([listId]) => Boolean(listId)),
      );
      const queued: Array<{
        listId: string;
        jobId: string;
        duplicate: boolean;
      }> = [];

      for (const list of targets) {
        if (!eligibleWatchlist(list)) continue;
        const active = activeByList.get(list.id);

        if (active) {
          queued.push({
            listId: list.id,
            jobId: active.id,
            duplicate: true,
          });
          continue;
        }

        const result = await enqueueBackendJob(
          {
            userId: access.user.id,
            firmId: access.firm!.id,
            actorName: access.user.name,
            actorEmail: access.user.email,
          },
          "workspace_watchlist_scan",
          {
            payload: {
              listId: list.id,
              source: "manual",
              requestedAt: new Date().toISOString(),
            },
            idempotencyKey: `workspace-watchlist:manual:${access.user.id}:${list.id}:${minuteBucket}`,
          },
        );
        queued.push({
          listId: list.id,
          jobId: result.job.id,
          duplicate: result.duplicate,
        });
      }

      return noStoreJson(
        {
          ...(await responsePayload({
            userId: access.user.id,
            firmId: access.firm!.id,
            state,
          })),
          queued,
          message: `${queued.length} watchlist scan job${queued.length === 1 ? "" : "s"} queued.`,
        },
        { status: 202 },
      );
    }

    throw new ApiError({
      status: 400,
      code: "WATCHLIST_ACTION_UNSUPPORTED",
      message: "Use saveState, syncLegacyState, scanNow, scanAll, or clearEvents.",
      expose: true,
    });
  },
);