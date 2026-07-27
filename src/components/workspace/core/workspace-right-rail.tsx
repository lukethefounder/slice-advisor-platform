"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  BellRing,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  FileChartColumnIncreasing,
  ListChecks,
  UsersRound,
} from "lucide-react";

import type {
  FirmWorkspaceSummary,
  SentTeamInvite,
  WorkspaceBriefSummary,
} from "@/lib/workspace-green-core";
import {
  shortDateTime,
} from "@/lib/workspace-green-core";
import WorkspaceInvitePanel from "@/components/workspace/core/workspace-invite-panel";
import {
  SectionEyebrow,
  WorkspaceMetric,
  WorkspacePill,
  WorkspaceSurface,
} from "@/components/workspace/core/workspace-ui";

function BriefPanel({
  brief,
}: {
  brief: WorkspaceBriefSummary | null;
}) {
  const latest = brief?.latest ?? null;

  return (
    <WorkspaceSurface className="p-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-lime-500/12 via-emerald-500/[0.025] to-transparent" />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <SectionEyebrow>Autonomous brief</SectionEyebrow>
            <h2 className="mt-2 text-lg font-black tracking-[-0.03em] text-white">
              Daily market priorities
            </h2>
          </div>
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-lime-300/18 bg-lime-500/[0.07] text-lime-200">
            <FileChartColumnIncreasing className="h-5 w-5" />
          </div>
        </div>

        {latest ? (
          <>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <WorkspacePill tone="lime">
                Quality {Math.round(latest.brief.dataQuality)}/100
              </WorkspacePill>
              <WorkspacePill
                tone={
                  latest.brief.providerMode.toLowerCase().includes("real")
                    ? "emerald"
                    : "amber"
                }
              >
                {latest.brief.providerMode}
              </WorkspacePill>
            </div>

            <p className="mt-3 line-clamp-4 text-xs font-semibold leading-5 text-slate-400">
              {latest.brief.executiveSummary}
            </p>

            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {latest.brief.topIndustries.slice(0, 3).map((industry) => (
                <div
                  key={industry.id}
                  className="min-w-0 rounded-xl border border-white/8 bg-white/[0.03] p-2"
                >
                  <p className="truncate text-[8px] font-black uppercase tracking-[0.1em] text-slate-600">
                    #{industry.rank}
                  </p>
                  <p className="mt-1 truncate text-[10px] font-black text-white">
                    {industry.name}
                  </p>
                  <p className="mt-1 text-[9px] font-black text-lime-200">
                    {industry.score.toFixed(1)}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="truncate text-[9px] font-bold text-slate-600">
                {shortDateTime(latest.createdAt)}
              </p>
              <Link
                href="/workspace/brief"
                className="inline-flex items-center gap-1.5 text-[10px] font-black text-lime-200 hover:text-white"
              >
                Open Brief
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-black/25 p-4">
            <p className="text-xs font-bold leading-5 text-slate-500">
              No autonomous market briefing has been generated for this advisor yet.
            </p>
            <Link
              href="/workspace/brief"
              className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-black text-lime-200 hover:text-white"
            >
              Generate the first brief
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </div>
    </WorkspaceSurface>
  );
}

function FirmPulse({
  firm,
}: {
  firm: FirmWorkspaceSummary | null;
}) {
  const metrics = firm?.operations?.sprintMetrics;
  const activeMembers = firm?.members.filter((member) => member.status === "Active")
    .length ?? 0;
  const pendingInvites = firm?.invites.filter((invite) => invite.status === "Pending")
    .length ?? 0;
  const openWork =
    Number(metrics?.open ?? 0) +
    Number(metrics?.inProgress ?? 0) +
    Number(metrics?.review ?? 0);
  const overdue = Number(metrics?.overdue ?? 0);

  return (
    <WorkspaceSurface className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionEyebrow>Operating pulse</SectionEyebrow>
          <h2 className="mt-2 text-lg font-black tracking-[-0.03em] text-white">
            Firm execution
          </h2>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/18 bg-cyan-500/[0.07] text-cyan-200">
          <BriefcaseBusiness className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <WorkspaceMetric
          label="Active team"
          value={activeMembers}
          helper="firm members"
          tone="emerald"
          icon={<UsersRound className="h-4 w-4" />}
        />
        <WorkspaceMetric
          label="Open work"
          value={openWork}
          helper="active tasks"
          tone="cyan"
          icon={<ListChecks className="h-4 w-4" />}
        />
        <WorkspaceMetric
          label="Pending access"
          value={pendingInvites}
          helper="advisor invites"
          tone="lime"
          icon={<BellRing className="h-4 w-4" />}
        />
        <WorkspaceMetric
          label="Overdue"
          value={overdue}
          helper="needs review"
          tone={overdue ? "amber" : "slate"}
          icon={
            overdue ? (
              <CalendarClock className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )
          }
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          href="/workspace/team-board"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5 text-[10px] font-black text-slate-300 hover:border-emerald-300/20 hover:text-white"
        >
          Team Board
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
        <Link
          href="/workspace/client-portal-inbox"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5 text-[10px] font-black text-slate-300 hover:border-emerald-300/20 hover:text-white"
        >
          Client Inbox
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </WorkspaceSurface>
  );
}

export default function WorkspaceRightRail({
  firm,
  brief,
  canInvite,
  sentInvites,
  onInviteCreated,
}: {
  firm: FirmWorkspaceSummary | null;
  brief: WorkspaceBriefSummary | null;
  canInvite: boolean;
  sentInvites: SentTeamInvite[];
  onInviteCreated: (invite: SentTeamInvite) => void;
}) {
  return (
    <aside className="grid min-w-0 content-start gap-3">
      <WorkspaceInvitePanel
        firmId={firm?.firm?.id ?? null}
        firmName={firm?.firm?.name ?? "Slice Advisory Group"}
        canInvite={canInvite}
        initialInvites={sentInvites}
        onInviteCreated={onInviteCreated}
      />
      <BriefPanel brief={brief} />
      <FirmPulse firm={firm} />
    </aside>
  );
}