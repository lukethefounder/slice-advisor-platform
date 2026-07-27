import { NextResponse } from "next/server";

import {
  generateAdvisorMarketBrief,
  loadAdvisorBriefApiPayload,
  loadAdvisorMarketBriefHistory,
  saveAdvisorBriefPreference,
  sendAdvisorMarketBrief,
} from "@/lib/advisor-briefing/engine";
import type { AdvisorBriefPreference } from "@/lib/advisor-briefing/types";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const MAXIMUM_BODY_BYTES = 48_000;

type RequestBody = {
  action?: unknown;
  preference?: Partial<AdvisorBriefPreference>;
  destination?: unknown;
  force?: unknown;
};

function clean(value: unknown, maximum = 320) {
  return typeof value === "string"
    ? value.trim().slice(0, maximum)
    : "";
}

function json(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return json({ error: "Unauthorized." }, { status: 401 });
  }

  return json(
    await loadAdvisorBriefApiPayload({
      userId: user.id,
      userEmail: user.email,
    }),
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const rawBody = await request.text();

    if (Buffer.byteLength(rawBody, "utf8") > MAXIMUM_BODY_BYTES) {
      return json(
        {
          error: `Advisor brief request exceeds ${MAXIMUM_BODY_BYTES} bytes.`,
        },
        { status: 413 },
      );
    }

    let body: RequestBody;

    try {
      body = JSON.parse(rawBody || "{}") as RequestBody;
    } catch {
      return json(
        { error: "Request body must contain valid JSON." },
        { status: 400 },
      );
    }

    const action = clean(body.action, 50).toLowerCase();

    if (action === "save-preference") {
      const preference = await saveAdvisorBriefPreference(
        user.id,
        body.preference ?? {},
        user.email,
      );

      return json({
        ok: true,
        action,
        preference,
      });
    }

    if (action === "generate" || action === "generate-and-send") {
      const savedPreference = body.preference
        ? await saveAdvisorBriefPreference(
            user.id,
            body.preference,
            user.email,
          )
        : null;
      const generated = await generateAdvisorMarketBrief({
        userId: user.id,
        userEmail: user.email,
        force: body.force === true,
        minimumDataQuality:
          savedPreference?.minimumDataQuality ??
          body.preference?.minimumDataQuality,
      });
      let email:
        | Awaited<ReturnType<typeof sendAdvisorMarketBrief>>
        | null = null;

      if (action === "generate-and-send") {
        email = await sendAdvisorMarketBrief({
          userId: user.id,
          userEmail: user.email,
          record: generated.record,
          destination: clean(body.destination),
        });
      }

      return json({
        ok: true,
        action,
        record: generated.record,
        preference: generated.preference,
        email,
      });
    }

    if (action === "send-latest") {
      const latest = (
        await loadAdvisorMarketBriefHistory(user.id, 1)
      )[0];

      if (!latest) {
        return json(
          {
            error:
              "Generate an advisor market brief before sending it.",
          },
          { status: 409 },
        );
      }

      const email = await sendAdvisorMarketBrief({
        userId: user.id,
        userEmail: user.email,
        record: latest,
        destination: clean(body.destination),
      });

      return json({
        ok: email.ok,
        action,
        record: latest,
        email,
      });
    }

    return json(
      {
        error:
          "Unsupported action. Use save-preference, generate, generate-and-send, or send-latest.",
      },
      { status: 400 },
    );
  } catch (error) {
    return json(
      {
        error: "Advisor briefing action failed.",
        detail:
          error instanceof Error
            ? error.message
            : "Unknown briefing error.",
      },
      { status: 409 },
    );
  }
}