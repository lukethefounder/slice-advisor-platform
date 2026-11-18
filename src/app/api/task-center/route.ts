import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import { requireCurrentAccessContext } from "@/lib/access-control";
import {
  checkRateLimit,
  isPotentiallyCrossSiteUnsafeRequest,
} from "@/lib/security";
import {
  readResearchJson,
  strategyFailure,
} from "@/lib/strategy-lab/http";
import { TaskError, type TaskActor } from "@/lib/task-center/core";
import { listTasks, saveTask } from "@/lib/task-center/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function actor(
  request: Request,
  write = false,
): Promise<TaskActor> {
  if (write && isPotentiallyCrossSiteUnsafeRequest(request)) {
    throw new ApiError({
      status: 403,
      code: "CROSS_SITE",
      message: "Cross-site changes are blocked.",
      expose: true,
    });
  }

  const context = await requireCurrentAccessContext({
    requireFirm: true,
  });

  if (
    !context.firm ||
    !context.membership ||
    context.membership.status !== "Active"
  ) {
    throw new ApiError({
      status: 403,
      code: "MEMBERSHIP",
      message: "An active firm membership is required.",
      expose: true,
    });
  }

  const rate = checkRateLimit({
    key: `task-center:${context.firm.id}:${context.user.id}:${
      write ? "write" : "read"
    }`,
    limit: write ? 40 : 120,
    windowMs: 60_000,
  });

  if (!rate.allowed) {
    throw new ApiError({
      status: 429,
      code: "SECURITY_RATE",
      message: "Too many task requests. Retry shortly.",
      expose: true,
    });
  }

  return {
    userId: context.user.id,
    firmId: context.firm.id,
    membershipId: context.membership.id,
    canManage: context.permissions.includes("projects.manage"),
    name: context.user.name || "Team member",
  };
}

function fail(error: unknown): never {
  if (error instanceof TaskError) {
    throw new ApiError({
      status: error.status,
      code: error.code,
      message: error.message,
      expose: true,
    });
  }

  strategyFailure(error);
}

export const GET = withApiRoute(
  {
    route: "/api/task-center",
    timeoutMs: 18_000,
    cacheControl: "private, no-store",
  },
  async ({ request }) => {
    const access = await actor(request);

    try {
      // URL.searchParams is a property, not a function.
      const searchParams = new URL(request.url).searchParams;
      return apiJson(await listTasks(access, searchParams));
    } catch (error) {
      fail(error);
    }
  },
);

export const POST = withApiRoute(
  {
    route: "/api/task-center",
    timeoutMs: 18_000,
    cacheControl: "private, no-store",
  },
  async ({ request }) => {
    const access = await actor(request, true);

    try {
      return apiJson(
        await saveTask(access, await readResearchJson(request)),
      );
    } catch (error) {
      fail(error);
    }
  },
);