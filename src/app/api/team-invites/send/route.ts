import { NextResponse } from "next/server";

type InviteEmailRequest = {
  to?: string;
  firmName?: string;
  role?: string;
  inviteCode?: string;
  inviteLink?: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as InviteEmailRequest;

    const to = body.to?.trim().toLowerCase();
    const firmName = body.firmName?.trim();
    const role = body.role?.trim();
    const inviteCode = body.inviteCode?.trim();
    const inviteLink = body.inviteLink?.trim();

    if (!to || !firmName || !role || !inviteCode || !inviteLink) {
      return NextResponse.json(
        {
          ok: false,
          message: "Missing invite email fields.",
        },
        { status: 400 },
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.TEAM_INVITES_FROM_EMAIL || "Slice <onboarding@resend.dev>";

    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          message: "RESEND_API_KEY is not configured. Add it to .env.local to send invite emails.",
        },
        { status: 503 },
      );
    }

    const safeFirm = escapeHtml(firmName);
    const safeRole = escapeHtml(role);
    const safeCode = escapeHtml(inviteCode);
    const safeLink = escapeHtml(inviteLink);

    const subject = `Create your Slice account for ${firmName}`;

    const text = [
      `You have been invited to join ${firmName} on Slice as ${role}.`,
      "",
      "Create your advisor account and profile here:",
      inviteLink,
      "",
      `Invite code: ${inviteCode}`,
      "",
      "- Slice",
    ].join("\n");

    const html = `
      <div style="background:#050202;color:#ffffff;font-family:Arial,sans-serif;padding:32px;">
        <div style="max-width:640px;margin:0 auto;border:1px solid rgba(255,255,255,0.12);border-radius:28px;background:#090909;padding:28px;">
          <div style="display:inline-block;border:1px solid rgba(239,68,68,0.35);background:rgba(239,68,68,0.12);color:#fecaca;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;">
            Slice Team Invite
          </div>

          <h1 style="font-size:30px;line-height:1.1;margin:20px 0 12px;">
            Create your Slice account
          </h1>

          <p style="color:#cbd5e1;font-size:15px;line-height:1.7;">
            You have been invited to join <strong style="color:#ffffff;">${safeFirm}</strong> as <strong style="color:#ffffff;">${safeRole}</strong>.
          </p>

          <div style="margin:22px 0;padding:16px;border:1px solid rgba(255,255,255,0.12);border-radius:18px;background:rgba(255,255,255,0.04);">
            <div style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;font-weight:800;">Invite Code</div>
            <div style="font-size:20px;font-weight:900;margin-top:6px;">${safeCode}</div>
          </div>

          <a href="${safeLink}" style="display:inline-block;background:linear-gradient(90deg,#ef4444,#991b1b,#450a0a);color:white;text-decoration:none;border-radius:16px;padding:14px 20px;font-weight:900;">
            Create Account + Profile
          </a>

          <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin-top:22px;">
            If the button does not work, copy and paste this link into your browser:<br />
            <span style="color:#fecaca;">${safeLink}</span>
          </p>
        </div>
      </div>
    `;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        html,
        text,
      }),
    });

    const result = (await resendResponse.json()) as { id?: string; message?: string };

    if (!resendResponse.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: result.message || "Resend could not send the invite email.",
        },
        { status: resendResponse.status },
      );
    }

    return NextResponse.json({
      ok: true,
      id: result.id,
      message: "Email sent successfully.",
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Unexpected error while sending invite email.",
      },
      { status: 500 },
    );
  }
}