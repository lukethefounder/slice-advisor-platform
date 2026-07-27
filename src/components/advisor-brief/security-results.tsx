"use client";

import {
  BarChart3,
  Target,
} from "lucide-react";

import type {
  AdvisorBriefIndustry,
  AdvisorBriefSource,
  AdvisorMarketBrief,
} from "@/lib/advisor-briefing/types";
import {
  Badge,
  SecurityCard,
  cx,
  number,
  panelClass,
  signedPercent,
} from "@/components/advisor-brief/ui";

export default function BriefSecurityResults({
  brief,
  activeIndustry,
  sourceMap,
}: {
  brief: AdvisorMarketBrief | null;
  activeIndustry: AdvisorBriefIndustry | null;
  sourceMap: Map<string, AdvisorBriefSource>;
}) {
  return (
          <div className="space-y-5">
            <section
              className={cx(
                panelClass,
                "p-5 sm:p-6",
              )}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <Badge tone="red">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Security monitor list
                  </Badge>
                  <h2 className="mt-3 text-2xl font-black text-white sm:text-3xl">
                    {activeIndustry?.name ??
                      "Select an industry"}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                    {activeIndustry?.description ??
                      "The five strongest monitor candidates and their source-backed explanations appear here."}
                  </p>
                </div>
                {activeIndustry ? (
                  <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.05] px-5 py-4 text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
                      Industry score
                    </p>
                    <p className="mt-1 text-3xl font-black text-white">
                      {number(
                        activeIndustry.score,
                        1,
                      )}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="mt-5 space-y-3">
                {(activeIndustry?.stocks ??
                  []).map(
                  (security) => (
                    <SecurityCard
                      key={
                        security.symbol
                      }
                      security={
                        security
                      }
                      sourceMap={
                        sourceMap
                      }
                    />
                  ),
                )}
                {!activeIndustry ? (
                  <div className="grid min-h-[26rem] place-items-center rounded-[1.5rem] border border-dashed border-white/10 text-center">
                    <div>
                      <Target className="mx-auto h-9 w-9 text-emerald-300" />
                      <p className="mt-4 text-lg font-black text-white">
                        Industry research pending
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section
              className={cx(
                panelClass,
                "p-5 sm:p-6",
              )}
            >
              <div className="flex items-end justify-between gap-4">
                <div>
                  <Badge tone="cyan">
                    <Target className="h-3.5 w-3.5" />
                    Overall ranking
                  </Badge>
                  <h2 className="mt-3 text-2xl font-black text-white">
                    Top securities across selected industries
                  </h2>
                </div>
                <Badge tone="slate">
                  1–15
                </Badge>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[900px] border-separate border-spacing-y-2 text-left">
                  <thead>
                    <tr className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-700">
                      <th className="px-3 py-2">
                        Rank
                      </th>
                      <th className="px-3 py-2">
                        Security
                      </th>
                      <th className="px-3 py-2">
                        Industry
                      </th>
                      <th className="px-3 py-2">
                        Score
                      </th>
                      <th className="px-3 py-2">
                        Session
                      </th>
                      <th className="px-3 py-2">
                        Confidence
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(brief?.overallRankedSecurities ??
                      []).map(
                      (
                        security,
                      ) => (
                        <tr
                          key={
                            security.symbol
                          }
                          className="bg-white/[0.025] text-sm"
                        >
                          <td className="rounded-l-xl px-3 py-3 font-black text-emerald-300">
                            #
                            {
                              security.overallRank
                            }
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-black text-white">
                              {
                                security.symbol
                              }
                            </p>
                            <p className="mt-1 text-xs font-bold text-slate-600">
                              {
                                security.name
                              }
                            </p>
                          </td>
                          <td className="px-3 py-3 font-bold text-slate-400">
                            {
                              security.industryName
                            }
                          </td>
                          <td className="px-3 py-3 font-black text-white">
                            {number(
                              security.score,
                              1,
                            )}
                          </td>
                          <td
                            className={cx(
                              "px-3 py-3 font-black",
                              security
                                .quote
                                .changePercent >=
                                0
                                ? "text-emerald-300"
                                : "text-emerald-300",
                            )}
                          >
                            {signedPercent(
                              security
                                .quote
                                .changePercent,
                            )}
                          </td>
                          <td className="rounded-r-xl px-3 py-3 font-black text-white">
                            {number(
                              security.confidence,
                              0,
                            )}
                            %
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
  );
}