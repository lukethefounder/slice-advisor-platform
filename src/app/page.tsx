import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Clock3,
  Database,
  FileCheck2,
  GitBranch,
  LockKeyhole,
  Mail,
  Network,
  Newspaper,
  Radar,
  Scale,
  ShieldCheck,
  Target,
  UsersRound,
  Workflow,
} from "lucide-react";

import {
  GovernanceBadge,
  PrimaryLink,
  PublicHero,
  PublicPage,
  PublicSurface,
  SectionHeading,
  SecondaryLink,
  TrustLine,
} from "@/components/public-site/public-shell";
import {
  DEFAULT_PUBLIC_ARTICLE_MAX_AGE_MS,
  DEFAULT_PUBLIC_EDITION_MAX_AGE_MS,
  freshenPublicSnapshot,
  isTimestampWithin,
} from "@/lib/intelligence/freshness";
import { getPublicIntelligence } from "@/lib/public-intelligence";
import type { PublicArticle } from "@/lib/public-intelligence-types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Slice | Advisor Intelligence and Operations",
  description:
    "Source-aware market intelligence, forecasting, client workflows, evidence, and governance for modern advisory firms.",
};

const OPERATING_STAGES = [
  {
    number: "01",
    title: "Observe",
    description:
      "Collect timestamped market, company, source, and economic evidence.",
    icon: Radar,
  },
  {
    number: "02",
    title: "Analyze",
    description:
      "Apply equal-third research, forecast models, and relationship intelligence.",
    icon: BrainCircuit,
  },
  {
    number: "03",
    title: "Operate",
    description:
      "Connect findings to client, communication, portfolio, task, and meeting workflows.",
    icon: Workflow,
  },
  {
    number: "04",
    title: "Govern",
    description:
      "Preserve evidence, require review, measure outcomes, and record decisions.",
    icon: ShieldCheck,
  },
] as const;

const SYSTEMS = [
  {
    title: "Market intelligence",
    description:
      "Provider-timestamped quotes, technical structure, company context, news, and economic evidence.",
    href: "/markets",
    action: "Open markets",
    icon: BarChart3,
  },
  {
    title: "Research and forecasting",
    description:
      "Three independent research cohorts, eight forecast horizons, calibration, and retained accuracy history.",
    href: "/daily-intelligence",
    action: "Read intelligence",
    icon: Target,
  },
  {
    title: "Knowledge graph",
    description:
      "Evidence, sources, agents, sectors, topics, contradictions, and score pathways in one inspectable network.",
    href: "/knowledge-graph",
    action: "Explore relationships",
    icon: Network,
  },
  {
    title: "Advisor operations",
    description:
      "Client profiles, risk context, documents, communications, tasks, scheduling, and approval queues.",
    href: "/platform",
    action: "See the platform",
    icon: BriefcaseBusiness,
  },
  {
    title: "Evidence and governance",
    description:
      "Point-in-time evidence, model validation, human promotion, audit history, and explicit operating safeguards.",
    href: "/capabilities",
    action: "Review capabilities",
    icon: Scale,
  },
] as const;

const OPERATING_STANDARD = [
  {
    title: "Current-source discipline",
    description:
      "Public articles require a valid publication time and remain within the seven-day currentness contract.",
    icon: Newspaper,
  },
  {
    title: "Thirty-day operating memory",
    description:
      "Forecasts, model activity, outcomes, evidence audits, and drift review remain available in durable operating memory.",
    icon: Database,
  },
  {
    title: "Source and model transparency",
    description:
      "Provider time, evidence age, model version, calibration, confidence, and limitations remain visible.",
    icon: GitBranch,
  },
  {
    title: "Human-controlled decisions",
    description:
      "Sensitive client output, model promotion, and advisor actions remain reviewable and approval-gated.",
    icon: FileCheck2,
  },
] as const;

const ACCESS = [
  {
    title: "Advisor workspace",
    description:
      "Market intelligence, clients, portfolios, communications, tasks, forecasts, and evidence operations.",
    href: "/advisor-login",
    action: "Advisor login",
    icon: BriefcaseBusiness,
  },
  {
    title: "Client portal",
    description:
      "Secure messages, documents, risk updates, meeting access, and the assigned advisor relationship.",
    href: "/client-login",
    action: "Client login",
    icon: UsersRound,
  },
  {
    title: "Founder command",
    description:
      "Firm-wide operating health, integrations, governance, team control, and leadership oversight.",
    href: "/founder-login",
    action: "Founder login",
    icon: Building2,
  },
] as const;

type HomeIntelligence = {
  articles: PublicArticle[];
  generatedAt: string | null;
  newestPublishedAt: string | null;
  oldestPublishedAt: string | null;
};

async function loadHomeIntelligence(): Promise<HomeIntelligence> {
  try {
    const snapshot = await getPublicIntelligence({
      allowRefresh: false,
      maxAgeMs: DEFAULT_PUBLIC_EDITION_MAX_AGE_MS,
    });
    const editionCurrent = isTimestampWithin(
      snapshot.generatedAt,
      DEFAULT_PUBLIC_EDITION_MAX_AGE_MS,
    );

    if (!editionCurrent) {
      return {
        articles: [],
        generatedAt: snapshot.generatedAt,
        newestPublishedAt: null,
        oldestPublishedAt: null,
      };
    }

    const freshened = freshenPublicSnapshot(snapshot, {
      maximumAgeMs: DEFAULT_PUBLIC_ARTICLE_MAX_AGE_MS,
      limit: 4,
      maximumPerSource: 2,
    });

    return {
      articles: freshened.snapshot.items,
      generatedAt: snapshot.generatedAt,
      newestPublishedAt: freshened.freshness.newestPublishedAt,
      oldestPublishedAt: freshened.freshness.oldestPublishedAt,
    };
  } catch {
    return {
      articles: [],
      generatedAt: null,
      newestPublishedAt: null,
      oldestPublishedAt: null,
    };
  }
}

function displayDate(value: string | null | undefined) {
  if (!value) return "Timestamp unavailable";

  const parsed = new Date(value);

  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(parsed)
    : "Timestamp unavailable";
}

function safeArticleUrl(value: string | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function urgencyClass(urgency: string) {
  const value = urgency.toLowerCase();

  if (value === "critical" || value === "high") {
    return "border-amber-700/20 bg-amber-50 text-amber-900";
  }

  if (value === "medium") {
    return "border-cyan-700/20 bg-cyan-50 text-cyan-900";
  }

  return "border-emerald-700/20 bg-emerald-50 text-emerald-900";
}

function OperatingMap() {
  return (
    <PublicSurface className="p-5 sm:p-6 lg:p-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-800">
            Slice operating loop
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--slice-heading)]">
            Evidence moves into controlled action.
          </h2>
        </div>
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-emerald-700/20 bg-emerald-50 text-emerald-800">
          <Workflow className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-6 grid gap-3">
        {OPERATING_STAGES.map((stage, index) => {
          const Icon = stage.icon;

          return (
            <div
              key={stage.number}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-emerald-950/10 bg-[var(--slice-surface-muted)] p-3.5"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-emerald-700/15 bg-white text-emerald-800 shadow-sm">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-700">
                    {stage.number}
                  </span>
                  <span className="text-sm font-black text-[var(--slice-heading)]">
                    {stage.title}
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold leading-5 text-[var(--slice-muted)]">
                  {stage.description}
                </p>
              </div>
              {index < OPERATING_STAGES.length - 1 ? (
                <ArrowRight className="h-4 w-4 text-emerald-600" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-emerald-700/15 bg-[linear-gradient(120deg,rgba(16,163,111,0.10),rgba(6,182,212,0.06))] p-4">
        <GovernanceBadge />
        <p className="mt-3 text-xs font-semibold leading-6 text-[var(--slice-muted)]">
          Slice accelerates research, preparation, routing, drafting, and
          monitoring. Advisors and designated reviewers remain responsible for
          client-specific decisions and sensitive output.
        </p>
      </div>
    </PublicSurface>
  );
}

export default async function HomePage() {
  const intelligence = await loadHomeIntelligence();

  return (
    <PublicPage active="home">
      <PublicHero
        eyebrow="Advisor intelligence and operating control"
        title={
          <>
            Evidence-aware intelligence.{" "}
            <span className="text-emerald-700">
              One operating system for the advisory firm.
            </span>
          </>
        }
        description="Slice connects current market evidence, research, forecasting, portfolios, clients, documents, communications, workflows, and governance without hiding source time, model state, or review responsibility."
        actions={
          <>
            <PrimaryLink href="/platform">Explore Slice</PrimaryLink>
            <SecondaryLink href="/advisor-login">
              Advisor login
            </SecondaryLink>
          </>
        }
        aside={<OperatingMap />}
      />

      <section className="border-y border-emerald-950/10 bg-white/50 py-14 sm:py-18">
        <div className="mx-auto grid w-full max-w-[1500px] gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          {[
            ["7 days", "Maximum age of public source articles"],
            ["30 days", "Durable intelligence operating memory"],
            ["8", "Independent forecast horizons"],
            ["3 × ⅓", "Media, technical, and economy research"],
          ].map(([value, label]) => (
            <PublicSurface key={label} className="p-5">
              <p className="text-3xl font-black tracking-[-0.05em] text-[var(--slice-heading)]">
                {value}
              </p>
              <p className="mt-2 text-xs font-bold leading-5 text-[var(--slice-muted)]">
                {label}
              </p>
            </PublicSurface>
          ))}
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Current intelligence"
            title="Source articles within the active freshness window."
            description="The public edition displays only articles with a valid provider publication timestamp inside the seven-day currentness contract. If no current edition is available, Slice shows no article rather than substituting old content."
            action={
              <SecondaryLink href="/daily-intelligence">
                Open daily intelligence
              </SecondaryLink>
            }
          />

          {intelligence.articles.length ? (
            <>
              <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                {intelligence.articles.map((article) => {
                  const external = safeArticleUrl(article.link);

                  return (
                    <PublicSurface
                      key={article.id}
                      as="article"
                      className="flex min-h-[22rem] flex-col p-5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${urgencyClass(
                            article.urgency,
                          )}`}
                        >
                          {article.urgency}
                        </span>
                        <span className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-[var(--slice-subtle)]">
                          {article.sourceName}
                        </span>
                      </div>

                      <h3 className="mt-5 line-clamp-3 text-xl font-black leading-7 tracking-[-0.03em] text-[var(--slice-heading)]">
                        {article.title}
                      </h3>
                      <p className="mt-3 line-clamp-4 text-sm font-semibold leading-7 text-[var(--slice-muted)]">
                        {article.summary ||
                          "Open the original source for the complete report."}
                      </p>

                      <div className="mt-auto pt-5">
                        <p className="text-[10px] font-bold text-[var(--slice-subtle)]">
                          Published {displayDate(article.publishedAt)}
                        </p>
                        {article.matchedThemes.length ? (
                          <p className="mt-2 line-clamp-1 text-[9px] font-black uppercase tracking-[0.1em] text-emerald-800">
                            {article.matchedThemes.slice(0, 3).join(" · ")}
                          </p>
                        ) : null}
                        {external ? (
                          <a
                            href={external}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="mt-4 inline-flex items-center gap-2 text-xs font-black text-emerald-800 hover:underline"
                          >
                            Read original source
                            <ArrowRight className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                      </div>
                    </PublicSurface>
                  );
                })}
              </div>

              <p className="mt-5 text-center text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--slice-subtle)]">
                Edition {displayDate(intelligence.generatedAt)} · Newest source{" "}
                {displayDate(intelligence.newestPublishedAt)} · Oldest displayed
                source {displayDate(intelligence.oldestPublishedAt)}
              </p>
            </>
          ) : (
            <PublicSurface className="mt-10 p-8 text-center sm:p-12">
              <Clock3 className="mx-auto h-8 w-8 text-emerald-700" />
              <h3 className="mt-4 text-2xl font-black tracking-[-0.04em] text-[var(--slice-heading)]">
                Current public intelligence is temporarily unavailable.
              </h3>
              <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold leading-7 text-[var(--slice-muted)]">
                Slice did not substitute an older edition. The protected
                publication and recovery process will make the next
                source-verified edition available after it passes the freshness
                contract.
              </p>
            </PublicSurface>
          )}
        </div>
      </section>

      <section className="border-y border-emerald-950/10 bg-white/45 py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Platform systems"
            title="The operating capabilities behind Slice."
            description="Each system has a defined job, evidence source, operating status, and review path."
          />

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
            {SYSTEMS.map((system) => {
              const Icon = system.icon;

              return (
                <Link
                  key={system.href}
                  href={system.href}
                  prefetch={false}
                  className="group flex min-h-[20rem] flex-col rounded-[1.8rem] border border-emerald-950/10 bg-white/88 p-5 shadow-[0_20px_60px_rgba(6,78,55,0.09)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-emerald-700/25 hover:shadow-[0_24px_70px_rgba(6,78,55,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-2xl border border-emerald-700/15 bg-emerald-50 text-emerald-800">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-6 text-xl font-black tracking-[-0.035em] text-[var(--slice-heading)]">
                    {system.title}
                  </h3>
                  <p className="mt-3 text-sm font-semibold leading-7 text-[var(--slice-muted)]">
                    {system.description}
                  </p>
                  <span className="mt-auto inline-flex items-center gap-2 pt-6 text-xs font-black text-emerald-800">
                    {system.action}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Operating standard"
            title="Current data, retained evidence, and controlled decisions."
            description="Slice is built to preserve the difference between current observation, saved history, model evaluation, and human approval."
          />

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {OPERATING_STANDARD.map((item) => {
              const Icon = item.icon;

              return (
                <PublicSurface key={item.title} className="p-6">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl border border-emerald-700/15 bg-emerald-50 text-emerald-800">
                    <Icon className="h-5 w-5" />
                  </span>
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

          <PublicSurface className="mt-6 grid gap-7 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-800">
                Protected operating boundary
              </div>
              <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--slice-heading)]">
                Credentials, client information, and sensitive actions remain
                inside protected systems.
              </h3>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <TrustLine>
                  Provider credentials remain server-side and are never
                  displayed in the browser.
                </TrustLine>
                <TrustLine>
                  Current, delayed, stale, saved, and unavailable states are
                  labeled separately.
                </TrustLine>
                <TrustLine>
                  Forecasts retain source time, model version, confidence,
                  uncertainty, and limitations.
                </TrustLine>
                <TrustLine>
                  Model promotion and sensitive client-facing actions require
                  human review.
                </TrustLine>
              </div>
            </div>
            <span className="grid h-20 w-20 place-items-center rounded-[1.4rem] border border-emerald-700/20 bg-emerald-50 text-emerald-800">
              <LockKeyhole className="h-8 w-8" />
            </span>
          </PublicSurface>
        </div>
      </section>

      <section className="border-t border-emerald-950/10 bg-white/45 py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Secure access"
            title="A dedicated operating view for each role."
            description="Advisors, clients, and firm leadership enter through protected portals designed around their responsibilities."
          />

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {ACCESS.map((item) => {
              const Icon = item.icon;

              return (
                <PublicSurface
                  key={item.href}
                  className="flex min-h-[18rem] flex-col p-6"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-2xl border border-emerald-700/15 bg-emerald-50 text-emerald-800">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 text-xl font-black text-[var(--slice-heading)]">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm font-semibold leading-7 text-[var(--slice-muted)]">
                    {item.description}
                  </p>
                  <Link
                    href={item.href}
                    prefetch={false}
                    className="mt-auto inline-flex items-center gap-2 pt-6 text-xs font-black text-emerald-800"
                  >
                    {item.action}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </PublicSurface>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-14">
        <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8">
          <PublicSurface className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-800">
                <Mail className="h-4 w-4" />
                Advisor operating system
              </div>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.045em] text-[var(--slice-heading)]">
                Enter Slice through the portal that matches your role.
              </h2>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-[var(--slice-muted)]">
                Market intelligence and forecasting support advisor judgment.
                They do not replace suitability review, source verification, or
                the advisor’s responsibility to the client.
              </p>
            </div>
            <PrimaryLink href="/advisor-login">Advisor login</PrimaryLink>
          </PublicSurface>
        </div>
      </section>
    </PublicPage>
  );
}