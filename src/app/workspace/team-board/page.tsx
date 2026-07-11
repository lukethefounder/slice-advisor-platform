"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import TeamBoardEmbedded from "@/components/workspace/team-board-embedded";

type Priority = "Critical" | "High" | "Medium" | "Low";
type Status = "Open" | "In Progress" | "Waiting" | "Done";
type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "slate";

type DelegatedTask = {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  owner: string;
  ownerRole: string;
  status: Status;
  priority: Priority;
  due: string;
  source: "Client Portal Inbox";
  sourceItemId: string;
  createdAt: string;
  detail: string;
};

const TEAM_DELEGATIONS_KEY = "slice-team-board-delegations-v1";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const toneClasses: Record<Tone, string> = {
  red: "border-red-500/30 bg-red-500/10 text-red-100",
  green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  purple: "border-purple-500/30 bg-purple-500/10 text-purple-100",
  cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
  slate: "border-slate-500/20 bg-slate-500/10 text-slate-100",
};

function priorityTone(priority: Priority): Tone {
  if (priority === "Critical") return "red";
  if (priority === "High") return "amber";
  if (priority === "Medium") return "cyan";
  return "slate";
}

function statusTone(status: Status): Tone {
  if (status === "Done") return "green";
  if (status === "In Progress") return "purple";
  if (status === "Waiting") return "amber";
  return "cyan";
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/82 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={cx("inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em]", toneClasses[tone])}>
      {children}
    </span>
  );
}

function LinkButton({ href, children, tone = "red" }: { href: string; children: ReactNode; tone?: Tone }) {
  return (
    <Link href={href} prefetch={false} className={cx("rounded-2xl border px-4 py-3 text-sm font-black transition hover:-translate-y-0.5", toneClasses[tone])}>
      {children}
    </Link>
  );
}

export default function TeamBoardPage() {
  const [delegations, setDelegations] = useState<DelegatedTask[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TEAM_DELEGATIONS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setDelegations(parsed);
      }
    } catch {
      setDelegations([]);
    }
  }, []);

  function updateTask(id: string, status: Status) {
    setDelegations((current) => {
      const next = current.map((task) => (task.id === id ? { ...task, status } : task));
      window.localStorage.setItem(TEAM_DELEGATIONS_KEY, JSON.stringify(next));
      return next;
    });
  }

  const openTasks = delegations.filter((task) => task.status !== "Done");
  const completedTasks = delegations.filter((task) => task.status === "Done");

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-16%] top-[-16%] h-[34rem] w-[34rem] rounded-full bg-red-700/22 blur-3xl" />
        <div className="absolute right-[-14%] top-[12%] h-[32rem] w-[32rem] rounded-full bg-purple-700/12 blur-3xl" />
        <div className="absolute bottom-[-18%] left-[28%] h-[30rem] w-[30rem] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>

      <div className="relative mx-auto grid max-w-[1900px] gap-4 px-4 py-4 md:px-6">
        <header className="rounded-[2rem] border border-white/10 bg-black/70 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Pill tone="green">Team Board</Pill>
                <Pill tone="cyan">{openTasks.length} client inbox tasks</Pill>
                <Pill tone="green">{completedTasks.length} completed</Pill>
              </div>

              <h1 className="mt-2 text-3xl font-black tracking-tight text-white md:text-5xl">
                Team execution, delegated client responses, brainstorm, calendar, My Work, and docs.
              </h1>

              <p className="mt-2 max-w-5xl text-sm font-semibold leading-7 text-slate-400">
                Client Portal Inbox assignments appear here first, then the full generated Team Board continues below for delegation, calendar, brainstorm, universal workspace, My Work, and docs.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <LinkButton href="/workspace" tone="slate">Workspace</LinkButton>
              <LinkButton href="/workspace/client-portal-inbox" tone="purple">Client Inbox</LinkButton>
              <LinkButton href="/workspace/clients" tone="purple">Client Profiles</LinkButton>
            </div>
          </div>
        </header>

        <Card>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-400">
                Client Inbox Delegations
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">Lead-advisor assigned client responses</h2>
              <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-slate-400">
                These tasks were created directly from the Client Portal Inbox. Use this as the bridge between client requests and advisor/team execution.
              </p>
            </div>
            <Pill tone="cyan">{delegations.length} total</Pill>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {delegations.length ? (
              delegations.map((task) => (
                <div key={task.id} className="rounded-3xl border border-white/10 bg-white/[0.045] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-black text-white">{task.title}</div>
                      <div className="mt-1 text-xs font-semibold text-slate-500">
                        {task.clientName} · {task.owner} · {task.due}
                      </div>
                    </div>
                    <Pill tone={priorityTone(task.priority)}>{task.priority}</Pill>
                  </div>

                  <p className="mt-3 line-clamp-3 text-sm font-semibold leading-6 text-slate-400">{task.detail}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Pill tone={statusTone(task.status)}>{task.status}</Pill>
                    <Pill tone="slate">{task.source}</Pill>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => updateTask(task.id, "In Progress")} className={cx("rounded-2xl border px-3 py-2 text-xs font-black", toneClasses.purple)}>
                      Progress
                    </button>
                    <button type="button" onClick={() => updateTask(task.id, "Waiting")} className={cx("rounded-2xl border px-3 py-2 text-xs font-black", toneClasses.amber)}>
                      Waiting
                    </button>
                    <button type="button" onClick={() => updateTask(task.id, "Done")} className={cx("rounded-2xl border px-3 py-2 text-xs font-black", toneClasses.green)}>
                      Done
                    </button>
                    <Link href={`/workspace/client-portal-inbox?itemId=${task.sourceItemId}`} prefetch={false} className={cx("rounded-2xl border px-3 py-2 text-xs font-black", toneClasses.cyan)}>
                      Open Request
                    </Link>
                    <Link href={`/workspace/clients?clientId=${task.clientId}`} prefetch={false} className={cx("rounded-2xl border px-3 py-2 text-xs font-black", toneClasses.purple)}>
                      Profile
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 text-sm font-semibold leading-6 text-slate-400">
                No delegated client inbox tasks yet. Go to Client Portal Inbox, select a client update, and assign it to a team member.
              </div>
            )}
          </div>
        </Card>

        <TeamBoardEmbedded />
      </div>
    </main>
  );
}