import { NextRequest, NextResponse } from "next/server";
import {
  ComplianceInput,
  SiteActionInput,
  evaluateSiteAction,
  reviewWealthManagementContent,
  runSiteComplianceAudit,
} from "@/lib/compliance/advisor-compliance-engine";

export async function GET() {
  return NextResponse.json({
    ok: true,
    audit: runSiteComplianceAudit(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.mode === "site-action") {
      const decision = evaluateSiteAction(body.action as SiteActionInput);

      return NextResponse.json({
        ok: true,
        mode: "site-action",
        reviewedAt: new Date().toISOString(),
        decision,
      });
    }

    const result = reviewWealthManagementContent(body.review as ComplianceInput);

    return NextResponse.json({
      ok: true,
      mode: "content-review",
      reviewedAt: new Date().toISOString(),
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Compliance review failed.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}