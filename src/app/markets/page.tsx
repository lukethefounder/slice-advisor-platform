import type { Metadata } from "next";
import {
  Activity,
  CheckCircle2,
  Clock3,
  Database,
  KeyRound,
  ServerCog,
  ShieldCheck,
  Signal,
} from "lucide-react";

import LiveMarketBoard from "@/components/public-site/live-market-board";
import {
  PublicHero,
  PublicPage,
  PublicSurface,
  SecondaryLink,
  SectionHeading,
  TrustLine,
} from "@/components/public-site/public-shell";

export const metadata: Metadata = {
  title: "Markets",
  description:
    "Inspect compact Alpha Vantage market quotes, freshness, entitlement, quality, and optional full symbol intelligence in Slice.",
};

const SAFEGUARDS = [
  {
    title: "Server-only credentials",
    description:
      "ALPHA_VANTAGE_API_KEY is read only by server code. The browser receives provider status, not the credential value.",
    icon: KeyRound,
  },
  {
    title: "Compact first request",
    description:
      "The public board requests a fixed quote set without daily technical-history calls, sharply reducing cold-load provider work.",
    icon: Signal,
  },
  {
    title: "Explicit deep analysis",
    description:
      "Six-endpoint symbol intelligence starts only after a person presses Load full analysis for the selected security.",
    icon: Activity,
  },
  {
    title: "Last-confirmed recovery",
    description:
      "Fresh and stale server caches plus session retention keep confirmed data visible through transient provider errors.",
    icon: Database,
  },
];

function MarketsAside() {
  return (
    <PublicSurface className="p-6 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-800">
            Loading sequence
          </div>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--slice-heading)]">
            Fast quote context before expensive research.
          </h2>
        </div>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-emerald-700/15 bg-emerald-50 text-emerald-800">
          <ServerCog className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {[
          ["1", "Render the route shell immediately"],
          ["2", "Load one compact public quote summary"],
          ["3", "Show provider, entitlement, and timestamp state"],
          ["4", "Fetch full analysis only after user intent"],
        ].map(([number, text]) => (
          <div
            key={number}
            className="flex items-center gap-3 rounded-2xl border border-emerald-950/10 bg-[var(--slice-surface-muted)] p-3.5"
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-700 text-xs font-black text-white">
              {number}
            </div>
            <div className="text-sm font-black text-[var(--slice-heading)]">
              {text}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-700/15 bg-emerald-50 p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-800" />
        <p className="text-xs font-semibold leading-6 text-emerald-950">
          Realtime labels appear only when the configured Alpha Vantage
          entitlement and provider timestamp support that claim.
        </p>
      </div>
    </PublicSurface>
  );
}

export default function MarketsPage() {
  return (
    <PublicPage active="markets">
      <PublicHero
        eyebrow="Live provider intelligence"
        title={
          <>
            Market data that shows <span className="text-emerald-700">what it is, when it arrived, and how it loaded.</span>
          </>
        }
        description="The market route is intentionally separate from the homepage. It loads a compact Alpha Vantage summary, exposes freshness and entitlement, retains confirmed results, and delays expensive symbol intelligence until someone requests it."
        actions={
          <>
            <SecondaryLink href="/opportunity-radar">Open opportunity radar</SecondaryLink>
            <SecondaryLink href="/workspace/custom-board">Open advisor board</SecondaryLink>
          </>
        }
        aside={<MarketsAside />}
      />

      <section className="pb-16 sm:pb-20">
        <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8">
          <LiveMarketBoard />
        </div>
      </section>

      <section className="border-y border-emerald-950/10 bg-white/45 py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Provider safeguards"
            title="The route is optimized for both speed and truthfulness."
            description="Instead of hiding delays behind a generic live badge, the board carries provider state, configured entitlement, timestamp age, quality, cache mode, and warnings into the interface."
            action={<SecondaryLink href="/backend-readiness">Check integration readiness</SecondaryLink>}
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

          <PublicSurface className="mt-6 grid gap-7 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-800">
                <Clock3 className="h-3.5 w-3.5" />
                Before production deployment
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <TrustLine>
                  Set ALPHA_VANTAGE_API_KEY only in .env.local and the Vercel server environment.
                </TrustLine>
                <TrustLine>
                  Set ALPHA_VANTAGE_ENTITLEMENT to realtime only when the account has that market-data entitlement.
                </TrustLine>
                <TrustLine>
                  Never create NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY or embed a key in a browser fetch URL.
                </TrustLine>
                <TrustLine>
                  Run environment validation, typecheck, lint, and production build before deployment.
                </TrustLine>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-700/20 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-900">
              <CheckCircle2 className="h-4 w-4" />
              Credential-safe design
            </div>
          </PublicSurface>
        </div>
      </section>
    </PublicPage>
  );
}
