import type { Metadata } from "next";
import {
  BellRing,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Globe2,
  Newspaper,
  ShieldCheck,
} from "lucide-react";

import DailyIntelligenceFeed from "@/components/public-site/daily-intelligence-feed";
import {
  PublicHero,
  PublicPage,
  PublicSurface,
  SecondaryLink,
  SectionHeading,
  TrustLine,
} from "@/components/public-site/public-shell";

export const metadata: Metadata = {
  title: "Daily Intelligence",
  description:
    "Read the completed Slice daily intelligence edition with source health, evidence, priority review, local filtering, and no visit-triggered provider scan.",
};

const SAFEGUARDS = [
  {
    title: "One completed edition",
    description:
      "The public route reads a retained scheduled snapshot instead of starting a new scan for every visitor.",
    icon: Clock3,
  },
  {
    title: "Source evidence attached",
    description:
      "Publisher, provider, timestamps, themes, tickers, score, urgency, and source health remain visible.",
    icon: Globe2,
  },
  {
    title: "Priority is review—not automation",
    description:
      "Alert candidates are surfaced for advisor review without turning a public story into an automatic client action.",
    icon: BellRing,
  },
  {
    title: "Local search and filters",
    description:
      "After the single edition response loads, search and category changes run entirely in the browser.",
    icon: FileCheck2,
  },
];

function IntelligenceAside() {
  return (
    <PublicSurface className="p-6 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-800">
            Publication model
          </div>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--slice-heading)]">
            A calm daily surface backed by a scheduled intelligence process.
          </h2>
        </div>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-emerald-700/15 bg-emerald-50 text-emerald-800">
          <Newspaper className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        <TrustLine>Scheduled for 6:00 AM Eastern Time.</TrustLine>
        <TrustLine>Six selected public stories per completed edition.</TrustLine>
        <TrustLine>Provider and official-feed source health retained.</TrustLine>
        <TrustLine>No continuous polling or background animation loop.</TrustLine>
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-700/15 bg-emerald-50 p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-800" />
        <p className="text-xs font-semibold leading-6 text-emerald-950">
          Public intelligence is context for professional review. Source evidence,
          freshness, suitability, and client-specific implications still require judgment.
        </p>
      </div>
    </PublicSurface>
  );
}

export default function DailyIntelligencePage() {
  return (
    <PublicPage active="intelligence">
      <PublicHero
        eyebrow="Scheduled public intelligence"
        title={
          <>
            The daily edition, <span className="text-emerald-700">separated from the homepage and designed for focused review.</span>
          </>
        }
        description="Slice now gives public intelligence its own light route. The page reads one retained edition, displays source and freshness state, and performs search and category filtering locally after the response arrives."
        actions={
          <>
            <SecondaryLink href="/markets">Open live markets</SecondaryLink>
            <SecondaryLink href="/workspace/intelligence">Open advisor intelligence</SecondaryLink>
          </>
        }
        aside={<IntelligenceAside />}
      />

      <section className="pb-16 sm:pb-20">
        <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8">
          <DailyIntelligenceFeed />
        </div>
      </section>

      <section className="border-y border-emerald-950/10 bg-white/45 py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Publication safeguards"
            title="Fast public reading without sacrificing evidence or review controls."
            description="The new route limits provider work, keeps article provenance visible, and clearly separates public intelligence from protected advisor analysis and client-specific action."
            action={
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-700/20 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-900">
                <CheckCircle2 className="h-4 w-4" />
                One scheduled response
              </div>
            }
          />

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {SAFEGUARDS.map((item) => {
              const Icon = item.icon;
              return (
                <PublicSurface key={item.title} className="p-6">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl border border-emerald-700/15 bg-emerald-50 text-emerald-800">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <h3 className="mt-5 text-lg font-black text-[var(--slice-heading)]">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm font-semibold leading-7 text-[var(--slice-muted)]">
                    {item.description}
                  </p>
                </PublicSurface>
              );
            })}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}