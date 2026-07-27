import "server-only";

import type {
  AdvisorBriefEmailResult,
  AdvisorBriefSource,
  AdvisorMarketBrief,
  AdvisorMarketBriefRecord,
} from "@/lib/advisor-briefing/types";
import {
  cleanText,
} from "@/lib/advisor-briefing/shared";
import {
  getAdvisorBriefPreference,
  saveAdvisorBriefPreference,
} from "@/lib/advisor-briefing/persistence";
import {
  sendEmail,
} from "@/lib/integrations/email";
import {
  prisma,
} from "@/lib/prisma";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

function emailText(brief: AdvisorMarketBrief) {
  return [
    brief.title,
    `Generated: ${brief.generatedAt}`,
    `Market as of: ${brief.marketAsOf ?? "unavailable"}`,
    `Provider mode: ${brief.providerMode}`,
    `Data quality: ${brief.dataQuality.toFixed(0)}/100`,
    "",
    brief.executiveSummary,
    "",
    ...brief.topIndustries.flatMap((industry) => [
      `${industry.rank}. ${industry.name} — ${industry.score.toFixed(1)}/100`,
      industry.thesis,
      ...industry.stocks.map(
        (security) =>
          `   ${security.industryRank}. ${security.symbol} (#${security.overallRank} overall) — ${security.score.toFixed(1)}/100\n      ${security.explanation}`,
      ),
      "",
    ]),
    "Monitoring priorities only. This is decision-support evidence, not a trade instruction or guaranteed outcome.",
  ].join("\n");
}

function emailHtml(brief: AdvisorMarketBrief) {
  const sourceMap = new Map(
    brief.sources.map((source) => [source.id, source]),
  );
  const industries = brief.topIndustries
    .map((industry) => {
      const rows = industry.stocks
        .map((security) => {
          const sources = security.sourceIds
            .map((sourceId) => sourceMap.get(sourceId))
            .filter(
              (source): source is AdvisorBriefSource =>
                Boolean(source),
            )
            .slice(0, 4)
            .map((source) => {
              const url = safeHttpUrl(source.url);
              return url
                ? `<a href="${escapeHtml(
                    url,
                  )}" style="color:#059669;text-decoration:none;">${escapeHtml(
                    source.publisher || source.label,
                  )}</a>`
                : escapeHtml(source.label);
            })
            .join(" · ");

          return `<tr>
            <td style="padding:14px;border-top:1px solid #e5e7eb;font-weight:800;">#${security.overallRank} ${escapeHtml(
              security.symbol,
            )}</td>
            <td style="padding:14px;border-top:1px solid #e5e7eb;">${escapeHtml(
              security.name,
            )}</td>
            <td style="padding:14px;border-top:1px solid #e5e7eb;font-weight:800;">${security.score.toFixed(
              1,
            )}</td>
            <td style="padding:14px;border-top:1px solid #e5e7eb;">${
              security.quote.changePercent >= 0 ? "+" : ""
            }${security.quote.changePercent.toFixed(2)}%</td>
            <td style="padding:14px;border-top:1px solid #e5e7eb;line-height:1.55;">${escapeHtml(
              security.explanation,
            )}<div style="margin-top:8px;font-size:12px;color:#64748b;">${sources}</div></td>
          </tr>`;
        })
        .join("");

      return `<section style="margin-top:24px;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;">
        <div style="background:#111827;color:white;padding:18px 20px;">
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#6ee7b7;">Industry #${industry.rank}</div>
          <div style="font-size:24px;font-weight:900;margin-top:4px;">${escapeHtml(
            industry.name,
          )} · ${industry.score.toFixed(1)}/100</div>
          <div style="margin-top:10px;color:#d1d5db;line-height:1.6;">${escapeHtml(
            industry.thesis,
          )}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:#f8fafc;text-align:left;"><th style="padding:12px;">Rank</th><th style="padding:12px;">Security</th><th style="padding:12px;">Score</th><th style="padding:12px;">Move</th><th style="padding:12px;">Why monitor</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>`;
    })
    .join("");

  return `<div style="font-family:Inter,Arial,sans-serif;max-width:1100px;margin:0 auto;color:#0f172a;">
    <div style="background:linear-gradient(135deg,#020617,#022c22,#065f46);padding:30px;border-radius:24px;color:white;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.16em;color:#6ee7b7;font-weight:800;">Slice autonomous advisor briefing</div>
      <h1 style="margin:10px 0 0;font-size:34px;line-height:1.15;">${escapeHtml(
        brief.title,
      )}</h1>
      <p style="margin:14px 0 0;line-height:1.7;color:#e5e7eb;">${escapeHtml(
        brief.executiveSummary,
      )}</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px;font-size:12px;">
        <span style="border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:8px 12px;">${escapeHtml(
          brief.providerMode,
        )}</span>
        <span style="border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:8px 12px;">Data quality ${brief.dataQuality.toFixed(
          0,
        )}/100</span>
        <span style="border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:8px 12px;">Market as of ${escapeHtml(
          brief.marketAsOf ?? "unavailable",
        )}</span>
      </div>
    </div>
    ${industries}
    <div style="margin-top:24px;padding:18px;border:1px solid #fde68a;background:#fffbeb;border-radius:16px;font-size:13px;line-height:1.6;color:#78350f;">
      These rankings identify securities and industries requiring advisor monitoring. They are not automatic trade recommendations, guarantees, or client communications.
    </div>
  </div>`;
}

export async function sendAdvisorMarketBrief(input: {
  userId: string;
  userEmail: string;
  record: AdvisorMarketBriefRecord;
  destination?: string;
}) {
  const preference = await getAdvisorBriefPreference(
    input.userId,
    input.userEmail,
  );
  const destination =
    cleanText(input.destination, 320).toLowerCase() ||
    preference.emailAddress ||
    input.userEmail;
  const result = await sendEmail({
    to: destination,
    subject: input.record.brief.title,
    text: emailText(input.record.brief),
    html: emailHtml(input.record.brief),
    idempotencyKey: `advisor-market-brief:${input.userId}:${input.record.brief.briefId}`,
  });
  const deliveredAt = result.status === "sent" ? new Date() : null;

  await prisma.notificationDelivery.create({
    data: {
      userId: input.userId,
      channel: "Email",
      destination,
      status:
        result.status === "sent"
          ? "Delivered"
          : result.status === "simulated"
            ? "Simulated"
            : "Failed",
      urgency: "Medium",
      score: Math.round(input.record.brief.dataQuality),
      title: input.record.brief.title,
      body: input.record.brief.executiveSummary.slice(0, 4_000),
      reason:
        result.error ??
        "Advisor-configured autonomous market-brief delivery.",
      simulated: result.status !== "sent",
      ...(deliveredAt ? { deliveredAt } : {}),
    },
  });

  if (result.ok) {
    await prisma.advisorDayBrief.update({
      where: {
        id: input.record.id,
      },
      data: {
        status:
          result.status === "sent"
            ? "Delivered"
            : "Simulated Delivery",
      },
    });

    await saveAdvisorBriefPreference(
      input.userId,
      {
        ...preference,
        lastSentAt:
          result.status === "sent"
            ? new Date().toISOString()
            : preference.lastSentAt,
        lastDeliveryStatus: result.status,
      },
      input.userEmail,
    );
  }

  return result as AdvisorBriefEmailResult;
}