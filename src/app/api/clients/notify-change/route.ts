import { getCurrentUser } from "@/lib/auth";
import {
  cleanEmail,
  cleanText,
  noStoreJson,
  protectClientDataRoute,
} from "@/lib/client-data-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CurrentUserShape = {
  id: string;
  name: string;
  email: string;
};

function protectedRouteResponse(
  protection: Awaited<ReturnType<typeof protectClientDataRoute>>,
) {
  return (
    protection.response ??
    noStoreJson(
      {
        error: "Security policy blocked this client notification request.",
      },
      { status: 403 },
    )
  );
}

function htmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendResendEmail(input: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return {
      sent: false,
      reason: "RESEND_API_KEY is not configured.",
    };
  }

  const from =
    process.env.CLIENT_PROFILE_FROM_EMAIL ||
    process.env.WATCHLIST_ALERTS_FROM_EMAIL ||
    process.env.TEAM_INVITES_FROM_EMAIL ||
    "Slice <onboarding@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const text = await response.text();

    return {
      sent: false,
      reason: text.slice(0, 240),
    };
  }

  return {
    sent: true,
    reason: "",
  };
}

export async function POST(request: Request) {
  const user = (await getCurrentUser()) as CurrentUserShape | null;

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const protection = await protectClientDataRoute({
    request,
    user,
    area: "Client Data",
    eventType: "client.change_notification",
    title: "Client profile change notification",
    limit: 80,
    windowMs: 60 * 1000,
  });

  if (!protection.allowed) {
    return protectedRouteResponse(protection);
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const advisorEmail = cleanEmail(body.advisorEmail) || cleanEmail(user.email);
    const clientName = cleanText(body.clientName, "Client profile");
    const changeType = cleanText(body.changeType, "Client profile changed");
    const summary = cleanText(body.summary, "A client profile was updated.");
    const source = cleanText(body.source, "Slice Client Profiles");

    if (!advisorEmail) {
      return noStoreJson({
        ok: true,
        sent: false,
        reason: "No valid advisor email was available.",
      });
    }

    const html = `
      <div style="font-family:Arial,sans-serif;background:#050505;color:#ffffff;padding:24px;border-radius:18px;">
        <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#f87171;font-weight:800;">
          Slice Client Profile Update
        </div>
        <h1 style="margin:10px 0 4px;font-size:24px;">${htmlEscape(changeType)}</h1>
        <p style="color:#cbd5e1;line-height:1.6;">${htmlEscape(summary)}</p>
        <div style="margin-top:16px;padding:14px;border:1px solid rgba(255,255,255,0.12);border-radius:14px;background:rgba(255,255,255,0.05);">
          <div><strong>Client:</strong> ${htmlEscape(clientName)}</div>
          <div><strong>Source:</strong> ${htmlEscape(source)}</div>
          <div><strong>Advisor:</strong> ${htmlEscape(user.name || user.email)}</div>
          <div><strong>Time:</strong> ${htmlEscape(new Date().toLocaleString())}</div>
        </div>
        <p style="margin-top:18px;color:#94a3b8;font-size:12px;line-height:1.6;">
          Review the updated profile in Slice before using this information in client-specific recommendations.
        </p>
      </div>
    `;

    const email = await sendResendEmail({
      to: advisorEmail,
      subject: `Slice Client Update: ${changeType}`,
      html,
    });

    return noStoreJson({
      ok: true,
      sent: email.sent,
      reason: email.reason,
    });
  } catch (error) {
    return noStoreJson(
      {
        ok: false,
        sent: false,
        error: error instanceof Error ? error.message : "Client change notification failed.",
      },
      { status: 500 },
    );
  }
}