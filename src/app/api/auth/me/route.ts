import { publicAccessContext, getCurrentAccessContext } from "@/lib/access-control";
import { apiJson, withApiRoute } from "@/lib/api-route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withApiRoute(
  {
    route: "/api/auth/me",
    timeoutMs: 10_000,
  },
  async () => {
    const context = await getCurrentAccessContext();

    if (!context) {
      return apiJson({
        authenticated: false,
        user: null,
        access: null,
      });
    }

    const access = publicAccessContext(context);

    return apiJson({
      authenticated: true,
      user: access.user,
      access: {
        isFounder: access.isFounder,
        firm: access.firm,
        membership: access.membership,
        permissions: access.permissions,
      },
    });
  },
);