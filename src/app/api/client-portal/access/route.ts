import { timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import {
  CLIENT_PORTAL_SESSION_COOKIE,
  clearClientPortalCookieOptions,
  clientPortalCookieOptions,
  createClientPortalSession,
  getCurrentClientPortalSession,
  hashClientPortalToken,
  hashPortalInviteCode,
} from "@/lib/client-portal-auth";
import {
  cleanEmail,
  cleanText,
  noStoreJson,
} from "@/lib/client-data-security";
import {
  decryptSensitiveText,
  encryptSensitiveText,
} from "@/lib/data-vault";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const db = prisma as any;

function sameText(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function crossSiteBlocked(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) return false;

  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

async function portalContext(client: any) {
  const assignment = client.assignedAdvisorMembershipId
    ? await db.firmMembership.findFirst({
        where: {
          id: client.assignedAdvisorMembershipId,
          firmId: client.firmId,
          status: "Active",
        },
        include: {
          user: true,
          firm: true,
        },
      })
    : null;

  const clientEmail = client.email
    ? decryptSensitiveText(client.email) ?? ""
    : "";

  return {
    ok: true,
    client: {
      id: client.id,
      fullName: client.fullName,
      email: clientEmail,
      phone: client.phone ?? "",
      householdName: client.householdName ?? "",
      preferredContactMethod:
        client.preferredContactMethod || "Portal + email",
      riskProfile: client.riskProfile,
      liquidityNeeds: client.liquidityNeeds,
      timeHorizon: client.timeHorizon,
      objective: client.objective,
      onboardingStatus: client.portalOnboardingStatus,
      onboardingComplete:
        client.portalOnboardingStatus === "Portal Ready",
    },
    advisor: assignment
      ? {
          membershipId: assignment.id,
          userId: assignment.userId,
          name:
            assignment.user?.name ||
            assignment.user?.email ||
            "Advisor",
          email: assignment.user?.email || "",
          role: assignment.role,
          calendlyUrl:
            assignment.calendlyEnabled && assignment.calendlyUrl
              ? assignment.calendlyUrl
              : null,
          calendlyLabel:
            assignment.calendlyLabel || "Schedule a meeting",
        }
      : null,
    firm: assignment?.firm
      ? {
          id: assignment.firm.id,
          name: assignment.firm.name,
        }
      : {
          id: client.firmId ?? "",
          name: "Advisory Firm",
        },
  };
}

export async function GET() {
  const current = await getCurrentClientPortalSession();

  if (!current) {
    return noStoreJson(
      { error: "Client portal session required." },
      { status: 401 },
    );
  }

  return noStoreJson(await portalContext(current.client));
}

export async function POST(request: Request) {
  if (crossSiteBlocked(request)) {
    return noStoreJson(
      { error: "Security policy blocked this portal request." },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return noStoreJson(
      { error: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  const action = cleanText(body.action);

  if (action === "login") {
    const email = cleanEmail(body.email);
    const inviteCode = cleanText(body.inviteCode);

    if (!email || !inviteCode) {
      return noStoreJson(
        {
          error:
            "Client email and secure invite code are required.",
        },
        { status: 400 },
      );
    }

    const client = await db.clientProfile.findFirst({
      where: {
        portalInviteCodeHash: hashPortalInviteCode(inviteCode),
        portalEnabled: true,
        portalInviteExpiresAt: {
          gt: new Date(),
        },
      },
    });

    const storedEmail = client?.email
      ? String(
          decryptSensitiveText(client.email) ?? "",
        ).toLowerCase()
      : "";

    if (
      !client ||
      !storedEmail ||
      !sameText(storedEmail, email)
    ) {
      return noStoreJson(
        {
          error:
            "The email or portal invite code is invalid or expired.",
        },
        { status: 401 },
      );
    }

    if (
      !client.assignedAdvisorMembershipId ||
      !client.firmId
    ) {
      return noStoreJson(
        {
          error:
            "This client must be assigned to an advisor before portal access.",
        },
        { status: 409 },
      );
    }

    const portalSession = await createClientPortalSession(
      client.id,
    );

    await db.clientProfile.update({
      where: { id: client.id },
      data: {
        portalLastLoginAt: new Date(),
      },
    });

    const response = noStoreJson(
      await portalContext(client),
    );

    response.cookies.set(
      CLIENT_PORTAL_SESSION_COOKIE,
      portalSession.token,
      clientPortalCookieOptions(portalSession.expiresAt),
    );

    return response;
  }

  if (action === "logout") {
    const cookieStore = await cookies();
    const token = cookieStore.get(
      CLIENT_PORTAL_SESSION_COOKIE,
    )?.value;

    if (token) {
      await db.clientPortalSession.deleteMany({
        where: {
          tokenHash: hashClientPortalToken(token),
        },
      });
    }

    const response = noStoreJson({ ok: true });

    response.cookies.set(
      CLIENT_PORTAL_SESSION_COOKIE,
      "",
      clearClientPortalCookieOptions(),
    );

    return response;
  }

  if (action === "completeProfile") {
    const current = await getCurrentClientPortalSession();

    if (!current) {
      return noStoreJson(
        { error: "Client portal session required." },
        { status: 401 },
      );
    }

    const fullName = cleanText(
      body.fullName,
      current.client.fullName,
    ).slice(0, 240);

    const phone =
      cleanText(body.phone).slice(0, 80) || null;

    const householdName =
      cleanText(body.householdName).slice(0, 240) || null;

    const preferredContactMethod = cleanText(
      body.preferredContactMethod,
      "Portal + email",
    ).slice(0, 120);

    const client = await db.clientProfile.update({
      where: { id: current.client.id },
      data: {
        fullName: fullName || current.client.fullName,
        phone,
        householdName,
        preferredContactMethod,
        portalOnboardingStatus: "Portal Ready",
        portalLastLoginAt: new Date(),
      },
    });

    const sourceEventId = `profile-onboarding:${client.id}`;

    const existing =
      await db.advisorClientInboxItem.findUnique({
        where: {
          firmId_sourceEventId: {
            firmId: client.firmId,
            sourceEventId,
          },
        },
      });

    if (
      !existing &&
      client.assignedAdvisorMembershipId &&
      client.firmId
    ) {
      const assignment =
        await db.firmMembership.findFirst({
          where: {
            id: client.assignedAdvisorMembershipId,
            firmId: client.firmId,
            status: "Active",
          },
          include: {
            user: true,
          },
        });

      await db.$transaction([
        db.advisorClientInboxItem.create({
          data: {
            firmId: client.firmId,
            clientId: client.id,
            assignedAdvisorMembershipId:
              client.assignedAdvisorMembershipId,
            kind: "Profile Update",
            title: "Client portal profile completed",
            body:
              "The client completed their portal profile and confirmed contact preferences.",
            status: "Unread",
            priority: "Medium",
            sourceEventId,
            senderName: client.fullName,
            senderEmail: encryptSensitiveText(
              client.email
                ? decryptSensitiveText(client.email)
                : null,
            ),
            metadataJson: JSON.stringify({
              householdName,
              preferredContactMethod,
              phoneProvided: Boolean(phone),
            }),
          },
        }),
        ...(assignment
          ? [
              db.notificationDelivery.create({
                data: {
                  userId: assignment.userId,
                  alertEventId: null,
                  channel: "Dashboard",
                  destination:
                    assignment.user?.email ?? null,
                  status: "Delivered",
                  urgency: "Medium",
                  score: 75,
                  title:
                    "Client portal profile completed",
                  body: `${client.fullName} completed their portal profile and contact preferences.`,
                  reason:
                    "Routed exclusively to the advisor assigned to this client.",
                  simulated: false,
                  deliveredAt: new Date(),
                },
              }),
            ]
          : []),
      ]);
    }

    return noStoreJson(await portalContext(client));
  }

  return noStoreJson(
    { error: "Unknown client portal action." },
    { status: 400 },
  );
}