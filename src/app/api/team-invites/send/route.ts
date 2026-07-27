import "server-only";

import {
  randomBytes,
} from "node:crypto";

import { NextResponse } from "next/server";

import {
  getCurrentUser,
} from "@/lib/auth";
import {
  sendEmail,
} from "@/lib/integrations/email";
import {
  prisma,
} from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MAXIMUM_BODY_BYTES = 32_000;
const INVITE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

const ALLOWED_ROLES = new Set([
  "Principal Advisor",
  "Lead Advisor",
  "Senior Wealth Advisor",
  "Associate Advisor",
  "Service Advisor",
  "Portfolio Manager",
  "Investment Analyst",
  "Financial Planning Analyst",
  "Paraplanner",
  "Client Service Associate",
  "Relationship Manager",
  "Operations Associate",
  "Compliance Officer",
  "Chief Compliance Officer",
  "Admin",
  "Ops",
]);

type InviteBody = {
  action?: unknown;
  firmId?: unknown;
  firmName?: unknown;
  email?: unknown;
  role?: unknown;
};

function json(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function cleanText(value: unknown, maximum = 500) {
  return typeof value === "string"
    ? value.replace(/\u0000/g, "").trim().slice(0, maximum)
    : "";
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function inviteCode() {
  return randomBytes(18).toString("hex").toUpperCase();
}

function firmCode(name: string) {
  const prefix = name.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase();
  return `${prefix || "FIRM"}-${randomBytes(5).toString("hex").toUpperCase()}`;
}

function appOrigin(request: Request) {
  const configured = cleanText(
    process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL,
    2_000,
  );

  if (configured) {
    const normalized = configured.startsWith("http")
      ? configured
      : `https://${configured}`;
    return normalized.replace(/\/+$/, "");
  }

  return new URL(request.url).origin;
}

function canInvite(membership: {
  role: string;
  canInviteMembers: boolean;
  canManageFirm: boolean;
}) {
  return (
    membership.role === "Owner" ||
    membership.canInviteMembers ||
    membership.canManageFirm
  );
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");

  if (!local || !domain) {
    return email;
  }

  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function inviteEmail(input: {
  firmName: string;
  role: string;
  inviterName: string;
  inviteCode: string;
  inviteLink: string;
  expiresAt: Date;
}) {
  const expires = input.expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const subject = `Join ${input.firmName} on Slice`;
  const text = [
    `${input.inviterName} invited you to join ${input.firmName} on Slice as ${input.role}.`,
    "",
    "Create or connect your secure advisor account:",
    input.inviteLink,
    "",
    `Invite code: ${input.inviteCode}`,
    `Expires: ${expires}`,
    "",
    "This link creates a real beta account and firm membership. Demo credentials are no longer used.",
    "",
    "— Slice",
  ].join("\n");

  const html = `
    <div style="margin:0;background:#010604;padding:32px;color:#ecfdf5;font-family:Inter,Arial,sans-serif;">
      <div style="max-width:680px;margin:0 auto;overflow:hidden;border:1px solid rgba(52,211,153,.22);border-radius:28px;background:linear-gradient(145deg,rgba(2,44,34,.96),rgba(2,8,6,.98) 48%,rgba(6,78,59,.86));box-shadow:0 28px 80px rgba(0,0,0,.45);">
        <div style="padding:30px;">
          <div style="display:inline-block;border:1px solid rgba(52,211,153,.32);border-radius:999px;background:rgba(16,185,129,.12);padding:7px 11px;color:#a7f3d0;font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;">
            Slice beta advisor invitation
          </div>

          <div style="display:flex;align-items:center;gap:12px;margin-top:22px;">
            <div style="display:grid;width:48px;height:48px;place-items:center;border:1px solid rgba(52,211,153,.28);border-radius:16px;background:linear-gradient(145deg,#064e3b,#020806,#059669);font-size:20px;font-weight:900;color:white;">S</div>
            <div>
              <div style="font-size:22px;font-weight:900;color:white;">Slice</div>
              <div style="margin-top:2px;color:#6ee7b7;font-size:10px;font-weight:900;letter-spacing:.2em;text-transform:uppercase;">Advisor Operating System</div>
            </div>
          </div>

          <h1 style="margin:28px 0 10px;color:white;font-size:34px;line-height:1.08;letter-spacing:-.03em;">
            Join ${escapeHtml(input.firmName)}.
          </h1>

          <p style="margin:0;color:#cbd5e1;font-size:15px;line-height:1.75;">
            ${escapeHtml(input.inviterName)} invited you to join the firm workspace as
            <strong style="color:#d1fae5;">${escapeHtml(input.role)}</strong>.
            Create a real beta account or connect your existing Slice account.
          </p>

          <div style="margin:24px 0;padding:18px;border:1px solid rgba(255,255,255,.10);border-radius:18px;background:rgba(0,0,0,.28);">
            <div style="color:#64748b;font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;">Secure invite code</div>
            <div style="margin-top:7px;color:#ecfdf5;font-size:20px;font-weight:900;letter-spacing:.08em;">${escapeHtml(input.inviteCode)}</div>
            <div style="margin-top:9px;color:#94a3b8;font-size:12px;">Expires ${escapeHtml(expires)}</div>
          </div>

          <a href="${escapeHtml(input.inviteLink)}" style="display:inline-block;border:1px solid rgba(110,231,183,.42);border-radius:16px;background:linear-gradient(90deg,#10b981,#047857,#022c22);padding:15px 22px;color:white;text-decoration:none;font-size:14px;font-weight:900;box-shadow:0 14px 36px rgba(6,78,59,.38);">
            Create secure advisor account
          </a>

          <p style="margin:24px 0 0;color:#64748b;font-size:12px;line-height:1.7;">
            If the button does not open, copy this URL into your browser:<br />
            <span style="color:#6ee7b7;word-break:break-all;">${escapeHtml(input.inviteLink)}</span>
          </p>
        </div>
      </div>
    </div>
  `;

  return { subject, text, html };
}

async function activeMembership(userId: string, requestedFirmId: string) {
  if (requestedFirmId) {
    return prisma.firmMembership.findFirst({
      where: {
        userId,
        firmId: requestedFirmId,
        status: "Active",
        firm: {
          platformStatus: "Active",
        },
      },
      include: {
        firm: true,
      },
    });
  }

  return prisma.firmMembership.findFirst({
    where: {
      userId,
      status: "Active",
      firm: {
        platformStatus: "Active",
      },
    },
    include: {
      firm: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

async function bootstrapFirm(input: {
  userId: string;
  firmName: string;
  userEmail: string;
}) {
  const name = input.firmName || "Slice Advisory Group";

  return prisma.$transaction(async (tx) => {
    const firm = await tx.firm.create({
      data: {
        name,
        firmEmail: input.userEmail,
        firmCode: firmCode(name),
        createdByUserId: input.userId,
      },
    });
    const membership = await tx.firmMembership.create({
      data: {
        firmId: firm.id,
        userId: input.userId,
        role: "Owner",
        status: "Active",
        calendarColor: "#10b981",
        canAccessPortfolios: true,
        canManageProjects: true,
        canInviteMembers: true,
        canManageFirm: true,
      },
      include: {
        firm: true,
      },
    });

    return membership;
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = cleanText(url.searchParams.get("code"), 100).toUpperCase();

  if (!code) {
    return json(
      {
        ok: false,
        error: "Invite code is required.",
      },
      { status: 400 },
    );
  }

  const invite = await prisma.firmInvite.findUnique({
    where: {
      inviteCode: code,
    },
    include: {
      firm: true,
      sentBy: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!invite || invite.status !== "Pending") {
    return json(
      {
        ok: false,
        error: "This invitation is invalid or no longer pending.",
      },
      { status: 404 },
    );
  }

  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return json(
      {
        ok: false,
        error: "This invitation has expired. Ask the firm owner for a new link.",
      },
      { status: 410 },
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email: invite.email.toLowerCase(),
    },
    select: {
      id: true,
    },
  });

  return json({
    ok: true,
    invite: {
      inviteCode: invite.inviteCode,
      firmName: invite.firm.name,
      role: invite.role,
      emailMasked: maskEmail(invite.email),
      inviterName: invite.sentBy.name,
      expiresAt: invite.expiresAt?.toISOString() ?? null,
      existingAccount: Boolean(existingUser),
    },
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return json(
      {
        ok: false,
        error: "Authentication is required to invite an advisor.",
      },
      { status: 401 },
    );
  }

  const rawBody = await request.text();

  if (Buffer.byteLength(rawBody, "utf8") > MAXIMUM_BODY_BYTES) {
    return json(
      {
        ok: false,
        error: "The invitation request is too large.",
      },
      { status: 413 },
    );
  }

  let body: InviteBody;

  try {
    body = JSON.parse(rawBody || "{}") as InviteBody;
  } catch {
    return json(
      {
        ok: false,
        error: "Request body must contain valid JSON.",
      },
      { status: 400 },
    );
  }

  const email = cleanText(body.email, 320).toLowerCase();
  const roleCandidate = cleanText(body.role, 100);
  const role = ALLOWED_ROLES.has(roleCandidate)
    ? roleCandidate
    : "Associate Advisor";
  const requestedFirmId = cleanText(body.firmId, 100);
  const requestedFirmName =
    cleanText(body.firmName, 250) || "Slice Advisory Group";

  if (!validEmail(email)) {
    return json(
      {
        ok: false,
        error: "A valid advisor email is required.",
      },
      { status: 400 },
    );
  }

  if (email === user.email.trim().toLowerCase()) {
    return json(
      {
        ok: false,
        error: "Use another email address for the invited advisor.",
      },
      { status: 400 },
    );
  }

  let membership = await activeMembership(user.id, requestedFirmId);

  if (!membership) {
    membership = await bootstrapFirm({
      userId: user.id,
      firmName: requestedFirmName,
      userEmail: user.email,
    });
  }

  if (!canInvite(membership)) {
    return json(
      {
        ok: false,
        error: "Your firm role does not allow advisor invitations.",
      },
      { status: 403 },
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    const existingMembership = await prisma.firmMembership.findUnique({
      where: {
        firmId_userId: {
          firmId: membership.firmId,
          userId: existingUser.id,
        },
      },
    });

    if (existingMembership?.status === "Active") {
      return json(
        {
          ok: false,
          error: "This advisor already belongs to the firm workspace.",
        },
        { status: 409 },
      );
    }
  }

  await prisma.firmInvite.updateMany({
    where: {
      firmId: membership.firmId,
      email,
      status: "Pending",
    },
    data: {
      status: "Replaced",
    },
  });

  const expiresAt = new Date(Date.now() + INVITE_LIFETIME_MS);
  const invite = await prisma.firmInvite.create({
    data: {
      firmId: membership.firmId,
      email,
      role,
      inviteCode: inviteCode(),
      status: "Pending",
      expiresAt,
      sentByUserId: user.id,
    },
  });
  const inviteLink = `${appOrigin(request)}/workspace/team-invite?code=${encodeURIComponent(
    invite.inviteCode,
  )}`;
  const copy = inviteEmail({
    firmName: membership.firm.name,
    role,
    inviterName: user.name,
    inviteCode: invite.inviteCode,
    inviteLink,
    expiresAt,
  });
  const delivery = await sendEmail({
    to: email,
    from: cleanText(process.env.TEAM_INVITES_FROM_EMAIL, 320) || undefined,
    subject: copy.subject,
    text: copy.text,
    html: copy.html,
    idempotencyKey: `firm-invite:${invite.id}`,
  });

  await prisma.notificationDelivery
    .create({
      data: {
        userId: user.id,
        channel: "Email",
        destination: email,
        status:
          delivery.status === "sent"
            ? "Delivered"
            : delivery.status === "simulated"
              ? "Simulated"
              : "Failed",
        urgency: "Medium",
        score: 75,
        title: copy.subject,
        body: `Advisor invitation for ${email} as ${role}.`,
        reason:
          delivery.error ||
          `Firm invitation ${invite.inviteCode} processed through ${delivery.provider}.`,
        simulated: delivery.status !== "sent",
        deliveredAt: delivery.status === "sent" ? new Date() : null,
      },
    })
    .catch(() => undefined);

  const responseBody = {
    ok: delivery.ok,
    invite: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      inviteCode: invite.inviteCode,
      inviteLink,
      firmName: membership.firm.name,
      expiresAt: expiresAt.toISOString(),
      createdAt: invite.createdAt.toISOString(),
    },
    delivery,
  };

  return json(
    responseBody,
    delivery.ok
      ? { status: 200 }
      : { status: 502 },
  );
}