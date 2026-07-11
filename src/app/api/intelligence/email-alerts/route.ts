import { NextResponse } from "next/server";

type AlertPayload = {
  id?: string;
  type?: "News" | "Technicals" | "Sentiment";
  title?: string;
  destination?: string;
  createdAt?: string;
  status?: string;
  detail?: string;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as AlertPayload;

    const destination = String(payload.destination ?? "").trim();
    const title = String(payload.title ?? "Slice Intelligence Alert").trim();
    const detail = String(payload.detail ?? "").trim();
    const type = String(payload.type ?? "Intelligence").trim();

    if (!destination || !isValidEmail(destination)) {
      return NextResponse.json({
        sent: false,
        simulated: true,
        message: "No valid advisor email was provided. Alert was simulated only.",
      });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.ALERT_FROM_EMAIL || "alerts@slice.ai";

    if (!resendApiKey) {
      return NextResponse.json({
        sent: false,
        simulated: true,
        message: "RESEND_API_KEY is not configured. Alert was queued in simulation mode.",
      });
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: destination,
        subject: `[Slice Intelligence] ${type}: ${title}`,
        html: `
          <div style="font-family: Arial, sans-serif; background: #09090b; color: #ffffff; padding: 24px;">
            <div style="max-width: 720px; margin: 0 auto; border: 1px solid rgba(248,113,113,.22); border-radius: 24px; padding: 24px; background: #111827;">
              <div style="font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: #f87171; font-weight: 800;">
                Slice Intelligence Alert
              </div>
              <h1 style="font-size: 24px; line-height: 1.3; margin: 12px 0 8px;">${title}</h1>
              <p style="font-size: 14px; line-height: 1.7; color: #d1d5db;">${detail}</p>
              <div style="margin-top: 20px; padding: 12px 16px; border-radius: 16px; background: rgba(239,68,68,.10); color: #fecaca; font-size: 13px;">
                Alert Type: ${type}<br/>
                Generated: ${new Date().toLocaleString()}
              </div>
              <p style="font-size: 12px; line-height: 1.6; color: #9ca3af; margin-top: 20px;">
                This is decision-support information only. Advisors should review evidence, suitability, compliance, and client context before acting.
              </p>
            </div>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      return NextResponse.json(
        {
          sent: false,
          simulated: false,
          message: `Email provider failed: ${errorText}`,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      sent: true,
      simulated: false,
      message: "Email alert sent.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        sent: false,
        simulated: false,
        message: error instanceof Error ? error.message : "Unable to process intelligence alert.",
      },
      { status: 500 },
    );
  }
}