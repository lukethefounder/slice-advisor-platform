"use client";

import type {
  AdvisorBriefApiPayload,
  AdvisorBriefIndustry,
  AdvisorBriefPreference,
  AdvisorBriefSource,
  AdvisorMarketBrief,
} from "@/lib/advisor-briefing/types";
import BriefSecurityResults from "@/components/advisor-brief/security-results";
import BriefResearchDetails from "@/components/advisor-brief/research-details";

export default function BriefResultsPanel({
  payload,
  brief,
  activeIndustry,
  sourceMap,
  preference,
}: {
  payload: AdvisorBriefApiPayload | null;
  brief: AdvisorMarketBrief | null;
  activeIndustry: AdvisorBriefIndustry | null;
  sourceMap: Map<string, AdvisorBriefSource>;
  preference: AdvisorBriefPreference;
}) {
  return (
    <>
      <BriefSecurityResults
        brief={brief}
        activeIndustry={activeIndustry}
        sourceMap={sourceMap}
      />
      <BriefResearchDetails
        payload={payload}
        brief={brief}
        preference={preference}
      />
    </>
  );
}