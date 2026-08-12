import { ApiError, withApiRoute } from "@/lib/api-route";
import { requireCurrentAccessContext } from "@/lib/access-control";
import { noStoreJson } from "@/lib/client-data-security";
import { runStoredWatchlistCheck } from "@/lib/watchlists/check";
import {
  loadWatchlistWorkspace,
  normalizeAdvisorWatchlist,
  saveWatchlistWorkspace,
} from "@/lib/watchlists/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export const POST = withApiRoute(
  {
    route: "/api/workspace/watchlists/check",
    timeoutMs: 110_000,
  },
  async ({ request, signal }) => {
    const access = await requireCurrentAccessContext({ requireFirm: true });

    if (!access.firm) {
      throw new ApiError({
        status: 403,
        code: "ACTIVE_FIRM_REQUIRED",
        message: "An active firm workspace is required.",
        expose: true,
      });
    }

    const body = (await request.json().catch(() => null)) as
      | { list?: unknown }
      | null;
    const list = normalizeAdvisorWatchlist(body?.list, "compatibility-watchlist");

    if (!list.id || !list.name) {
      throw new ApiError({
        status: 400,
        code: "WATCHLIST_PAYLOAD_INVALID",
        message: "Invalid watchlist payload.",
        expose: true,
      });
    }

    const state = await loadWatchlistWorkspace({
      userId: access.user.id,
      firmId: access.firm.id,
    });
    const next =
      list.id === state.customBoardList.id
        ? { ...state, customBoardList: list }
        : {
            ...state,
            lists: [
              list,
              ...state.lists.filter((candidate) => candidate.id !== list.id),
            ],
          };

    await saveWatchlistWorkspace({
      userId: access.user.id,
      firmId: access.firm.id,
      state: next,
    });

    const result = await runStoredWatchlistCheck({
      userId: access.user.id,
      firmId: access.firm.id,
      listId: list.id,
      signal,
    });

    return noStoreJson(result);
  },
);