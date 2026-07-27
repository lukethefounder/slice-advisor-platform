"use client";

import {
  Building2,
  Sparkles,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  AdvisorBriefApiPayload,
  AdvisorBriefPreference,
  AdvisorMarketBriefRecord,
} from "@/lib/advisor-briefing/types";
import {
  Badge,
  IndustryCard,
  cx,
  dateTime,
  defaultAdvisorBriefPreference,
  fetchJson,
  panelClass,
} from "@/components/advisor-brief/ui";
import BriefHero from "@/components/advisor-brief/brief-hero";
import BriefSchedulePanel from "@/components/advisor-brief/schedule-panel";
import BriefResultsPanel from "@/components/advisor-brief/results-panel";

export default function AdvisorBriefPage() {
  const [
    payload,
    setPayload,
  ] =
    useState<AdvisorBriefApiPayload | null>(
      null,
    );
  const [
    preference,
    setPreference,
  ] =
    useState<AdvisorBriefPreference>(
      defaultAdvisorBriefPreference(),
    );
  const [
    activeIndustryId,
    setActiveIndustryId,
  ] =
    useState("");
  const [
    loading,
    setLoading,
  ] =
    useState(true);
  const [
    action,
    setAction,
  ] =
    useState<string | null>(null);
  const [
    message,
    setMessage,
  ] =
    useState(
      "Loading the advisor briefing center.",
    );

  const load = useCallback(
    async () => {
      setLoading(true);

      try {
        const next =
          await fetchJson<AdvisorBriefApiPayload>(
            "/api/advisor-brief",
          );
        setPayload(next);
        setPreference(
          next.preference,
        );
        setActiveIndustryId(
          (current) =>
            current ||
            next.latest?.brief
              .topIndustries[0]
              ?.id ||
            "",
        );
        setMessage(
          next.latest
            ? `Latest briefing loaded from ${dateTime(
                next.latest.createdAt,
              )}.`
            : "No briefing exists yet. Generate the first source-backed market brief.",
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load the advisor briefing center.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function savePreference() {
    setAction("save");

    try {
      const body = await fetchJson<{
        ok: boolean;
        preference: AdvisorBriefPreference;
      }>("/api/advisor-brief", {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          action:
            "save-preference",
          preference,
        }),
      });
      setPreference(
        body.preference,
      );
      setPayload((current) =>
        current
          ? {
              ...current,
              preference:
                body.preference,
            }
          : current,
      );
      setMessage(
        "Autonomous briefing schedule saved.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save the schedule.",
      );
    } finally {
      setAction(null);
    }
  }

  async function runBrief(
    generateAndSend = false,
  ) {
    setAction(
      generateAndSend
        ? "generate-send"
        : "generate",
    );
    setMessage(
      generateAndSend
        ? "Recalculating the market briefing and preparing the advisor email."
        : "Recalculating industry and security ranks from current provider evidence.",
    );

    try {
      await fetchJson<unknown>(
        "/api/advisor-brief",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action:
              generateAndSend
                ? "generate-and-send"
                : "generate",
            force: true,
            destination:
              preference.emailAddress,
            preference,
          }),
        },
      );
      await load();
      setMessage(
        generateAndSend
          ? "Briefing regenerated and advisor email processed."
          : "New source-backed briefing generated.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to generate the briefing.",
      );
    } finally {
      setAction(null);
    }
  }

  async function sendLatest() {
    setAction("send");
    setMessage(
      "Sending the latest briefing to the configured advisor email.",
    );

    try {
      await fetchJson<unknown>(
        "/api/advisor-brief",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action: "send-latest",
            destination:
              preference.emailAddress,
          }),
        },
      );
      await load();
      setMessage(
        "Latest advisor briefing email processed.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to send the email.",
      );
    } finally {
      setAction(null);
    }
  }

  const latest: AdvisorMarketBriefRecord | null =
    payload?.latest ?? null;
  const brief =
    latest?.brief ?? null;
  const activeIndustry =
    useMemo(
      () =>
        brief?.topIndustries.find(
          (industry) =>
            industry.id ===
            activeIndustryId,
        ) ??
        brief?.topIndustries[0] ??
        null,
      [
        activeIndustryId,
        brief,
      ],
    );
  const sourceMap =
    useMemo(
      () =>
        new Map(
          (
            brief?.sources ??
            []
          ).map((source) => [
            source.id,
            source,
          ]),
        ),
      [brief],
    );
  const busy =
    Boolean(action);


  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030303] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[-12rem] top-[-14rem] h-[38rem] w-[38rem] rounded-full bg-emerald-700/18 blur-3xl" />
        <div className="absolute right-[-14rem] top-[5rem] h-[36rem] w-[36rem] rounded-full bg-purple-800/10 blur-3xl" />
        <div className="absolute bottom-[-20rem] left-[35%] h-[42rem] w-[42rem] rounded-full bg-cyan-800/7 blur-3xl" />
      </div>

      <div className="mx-auto max-w-[1950px]">
        <BriefHero
          payload={payload}
          brief={brief}
          preference={preference}
          loading={loading}
          busy={busy}
          action={action}
          message={message}
          onGenerate={runBrief}
          onSendLatest={sendLatest}
        />

        <section className="mt-5 grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
          <div className="space-y-5">
            <section
              className={cx(
                panelClass,
                "p-5 sm:p-6",
              )}
            >
              <Badge tone="red">
                <Building2 className="h-3.5 w-3.5" />
                Top industries today
              </Badge>
              <h2 className="mt-3 text-2xl font-black text-white">
                Ranked monitor groups
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                Select an industry to inspect its five highest-ranked securities.
              </p>

              {brief?.topIndustries.length ? (
                <div className="mt-5 space-y-3">
                  {brief.topIndustries.map(
                    (industry) => (
                      <IndustryCard
                        key={
                          industry.id
                        }
                        industry={
                          industry
                        }
                        active={
                          activeIndustry?.id ===
                          industry.id
                        }
                        onClick={() =>
                          setActiveIndustryId(
                            industry.id,
                          )
                        }
                      />
                    ),
                  )}
                </div>
              ) : (
                <div className="mt-5 grid min-h-64 place-items-center rounded-[1.5rem] border border-dashed border-white/10 p-8 text-center">
                  <div>
                    <Sparkles className="mx-auto h-9 w-9 text-emerald-300" />
                    <h3 className="mt-4 text-xl font-black text-white">
                      Generate the first market brief
                    </h3>
                    <p className="mt-2 text-sm font-semibold text-slate-500">
                      Industry and security rankings appear after provider research completes.
                    </p>
                  </div>
                </div>
              )}
            </section>

            <BriefSchedulePanel
              preference={preference}
              setPreference={setPreference}
              busy={busy}
              action={action}
              onSave={savePreference}
            />
          </div>

          <BriefResultsPanel
            payload={payload}
            brief={brief}
            activeIndustry={activeIndustry}
            sourceMap={sourceMap}
            preference={preference}
          />
        </section>
      </div>
    </main>
  );
}