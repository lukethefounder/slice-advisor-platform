import "server-only";

import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import { getCurrentUser } from "@/lib/auth";
import {
  noStoreJson,
  protectClientDataRoute,
} from "@/lib/client-data-security";
import {
  listClientSection,
  requireClientRepositoryContext,
} from "@/lib/clients/repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
    section: string;
  }>;
};

async function exposeClientErrors(operation: () => Promise<Response>) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ApiError && error.expose) {
      return apiJson(
        {
          ok: false,
          error: error.message,
          code: error.code,
        },
        { status: error.status },
      );
    }

    throw error;
  }
}

export const GET = async (request: Request, routeContext: RouteContext) => {
  const handler = withApiRoute(
    {
      route: "/api/clients/[id]/sections/[section]",
      timeoutMs: 12_000,
      cacheControl: "private, no-store, max-age=0",
    },
    async () =>
      exposeClientErrors(async () => {
        const user = await getCurrentUser();

        if (!user) {
          throw new ApiError({
            status: 401,
            code: "AUTHENTICATION_REQUIRED",
            message: "Authentication required.",
            expose: true,
          });
        }

        const protection = await protectClientDataRoute({
          request,
          user,
          area: "Client Data",
          eventType: "client.section.read",
          title: "Client section read",
          limit: 180,
          windowMs: 60 * 1000,
        });

        if (!protection.allowed) {
          return (
            protection.response ??
            noStoreJson(
              { error: "Security policy blocked this client-data request." },
              { status: 403 },
            )
          );
        }

        const { id, section } = await routeContext.params;
        const clientId = id.trim();

        if (!clientId) {
          throw new ApiError({
            status: 400,
            code: "CLIENT_ID_REQUIRED",
            message: "Client ID is required.",
            expose: true,
          });
        }

        const context = await requireClientRepositoryContext(user.id);

        return apiJson(
          await listClientSection({
            context,
            clientId,
            section,
            params: new URL(request.url).searchParams,
          }),
        );
      }),
  );

  return handler(request);
};