import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  cleanMoneyLike,
  cleanNullableText,
  cleanText,
  cleanTicker,
  noStoreJson,
  protectClientDataRoute,
  recordClientMutation,
  requireClientAccess,
} from "@/lib/client-data-security";
import {
  decryptPortfolioHolding,
  encryptSensitiveText,
  vaultStatus,
} from "@/lib/data-vault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function protectedRouteResponse(
  protection: Awaited<ReturnType<typeof protectClientDataRoute>>
) {
  return (
    protection.response ??
    noStoreJson(
      {
        error: "Security policy blocked this client holding request.",
      },
      { status: 403 }
    )
  );
}

function clientAccessResponse(
  access: Awaited<ReturnType<typeof requireClientAccess>>
) {
  return (
    access.response ??
    noStoreJson(
      {
        error: "Client access denied.",
      },
      { status: 404 }
    )
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const protection = await protectClientDataRoute({
    request,
    user,
    area: "Client Data",
    eventType: "client.holding.create",
    title: "Client holding creation",
    limit: 60,
    windowMs: 60 * 1000,
  });

  if (!protection.allowed) {
    return protectedRouteResponse(protection);
  }

  try {
    const { id } = await context.params;

    const access = await requireClientAccess({
      user,
      clientId: id,
      scope: "write",
      request,
    });

    if (!access.allowed) {
      return clientAccessResponse(access);
    }

    const body = (await request.json().catch(() => ({}))) as {
      symbol?: string;
      assetName?: string;
      assetClass?: string;
      value?: string;
      allocationPct?: string;
      costBasis?: string;
      riskLevel?: string;
      thesis?: string;
    };

    const symbol = cleanTicker(body.symbol);
    const assetName = cleanText(body.assetName);

    if (!symbol || !assetName) {
      return noStoreJson(
        { error: "Symbol and asset name are required." },
        { status: 400 }
      );
    }

    const holding = await prisma.portfolioHolding.create({
      data: {
        clientId: id,
        symbol,
        assetName,
        assetClass: cleanText(body.assetClass, "Stock"),
        value: encryptSensitiveText(cleanMoneyLike(body.value)),
        allocationPct: encryptSensitiveText(cleanMoneyLike(body.allocationPct)),
        costBasis: encryptSensitiveText(cleanMoneyLike(body.costBasis)),
        riskLevel: cleanText(body.riskLevel, "Medium"),
        thesis: encryptSensitiveText(cleanNullableText(body.thesis)),
      },
    });

    await recordClientMutation({
      user,
      request,
      clientId: id,
      action: "holding.create",
      title: "Client holding created",
      detail: "A portfolio holding was added to a protected client profile.",
      metadata: {
        symbol,
        assetClass: holding.assetClass,
        riskLevel: holding.riskLevel,
        hasValue: Boolean(body.value),
        hasCostBasis: Boolean(body.costBasis),
        vault: vaultStatus(),
      },
    });

    return noStoreJson({
      holding: decryptPortfolioHolding(holding),
      vault: vaultStatus(),
    });
  } catch (error) {
    return noStoreJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create client holding.",
      },
      { status: 500 }
    );
  }
}