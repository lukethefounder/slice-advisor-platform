import "server-only";

import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import { getCurrentUser } from "@/lib/auth";
import {
  noStoreJson,
  protectClientDataRoute,
} from "@/lib/client-data-security";
import { dispatchClientMutation } from "@/lib/clients/mutations";
import {
  getClientCompatibilityDetail,
  getCompatibilityClientPayload,
  listClientOptions,
  listClients,
  parseClientListQuery,
  requireClientRepositoryContext,
} from "@/lib/clients/repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function authenticatedUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new ApiError({
      status: 401,
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication required.",
      expose: true,
    });
  }

  return user;
}

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

export const GET = withApiRoute(
  {
    route: "/api/clients",
    timeoutMs: 15_000,
    cacheControl: "private, no-store, max-age=0",
  },
  async ({ request }) =>
    exposeClientErrors(async () => {
      const user = await authenticatedUser();
      const protection = await protectClientDataRoute({
        request,
        user,
        area: "Client Data",
        eventType: "client.list",
        title: "Client list access",
        limit: 120,
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

      const context = await requireClientRepositoryContext(user.id);
      const url = new URL(request.url);
      const mode = url.searchParams.get("mode")?.trim() || "compat";

      if (mode === "list") {
        return apiJson(
          await listClients({
            context,
            query: parseClientListQuery(url.searchParams),
          }),
        );
      }

      if (mode === "options") {
        return apiJson(
          await listClientOptions({
            context,
            params: url.searchParams,
          }),
        );
      }

      if (mode === "compat") {
        return apiJson(
          await getCompatibilityClientPayload({
            context,
            params: url.searchParams,
          }),
        );
      }

      throw new ApiError({
        status: 400,
        code: "INVALID_CLIENT_MODE",
        message: "mode must be compat, list, or options.",
        expose: true,
      });
    }),
);

export const POST = withApiRoute(
  {
    route: "/api/clients",
    timeoutMs: 15_000,
    cacheControl: "private, no-store, max-age=0",
  },
  async ({ request }) =>
    exposeClientErrors(async () => {
      const user = await authenticatedUser();
      const protection = await protectClientDataRoute({
        request,
        user,
        area: "Client Data",
        eventType: "client.action",
        title: "Client profile action",
        limit: 80,
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

      const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

      if (!contentType.includes("application/json")) {
        throw new ApiError({
          status: 415,
          code: "JSON_REQUIRED",
          message: "This endpoint requires an application/json request body.",
          expose: true,
        });
      }

      let body: Record<string, unknown>;

      try {
        body = (await request.json()) as Record<string, unknown>;
      } catch {
        throw new ApiError({
          status: 400,
          code: "INVALID_JSON",
          message: "The request body is not valid JSON.",
          expose: true,
        });
      }

      const responseMode =
        new URL(request.url).searchParams.get("response")?.trim() || "compat";

      if (responseMode !== "compat" && responseMode !== "compact") {
        throw new ApiError({
          status: 400,
          code: "INVALID_CLIENT_RESPONSE_MODE",
          message: "response must be compat or compact.",
          expose: true,
        });
      }

      const mutation = await dispatchClientMutation(
        {
          user,
          request,
          body,
        },
        {
          includeClientDetail: responseMode === "compact",
        },
      );

      if (responseMode === "compact") {
        return apiJson(mutation);
      }

      const context = await requireClientRepositoryContext(user.id);
      const compatibility = await getCompatibilityClientPayload({
        context,
        params: new URLSearchParams({ limit: "50" }),
      });
      const client = await getClientCompatibilityDetail({
        context,
        clientId: mutation.clientId,
      });

      return apiJson({
        ...compatibility,
        ...mutation,
        client,
        responseMode: "compat",
      });
    }),
);