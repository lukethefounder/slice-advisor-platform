"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Mail,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  TEAM_ROLE_OPTIONS,
  type SentTeamInvite,
} from "@/lib/workspace-green-core";
import {
  SectionEyebrow,
  WorkspacePill,
  WorkspaceSurface,
  cx,
} from "@/components/workspace/core/workspace-ui";

type InviteDelivery = {
  ok: boolean;
  provider: string;
  status: "sent" | "simulated" | "failed" | "disabled";
  id?: string;
  error?: string;
  diagnostics?: {
    liveEnabled: boolean;
    hasApiKey: boolean;
    hasFrom: boolean;
    recipientCount: number;
  };
};

type InviteResponse = {
  ok: boolean;
  inviteCreated?: boolean;
  emailDelivered?: boolean;
  message?: string;
  warning?: string | null;
  invite?: {
    id: string;
    email: string;
    role: string;
    inviteCode: string;
    inviteLink: string;
    firmName: string;
    expiresAt: string;
    createdAt: string;
  };
  delivery?: InviteDelivery;
  error?: string;
  detail?: string;
};

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function deliveryTone(status: SentTeamInvite["deliveryStatus"]) {
  if (status === "sent") {
    return "emerald" as const;
  }

  if (status === "simulated" || status === "disabled") {
    return "amber" as const;
  }

  return "slate" as const;
}

function responseToInvite(payload: InviteResponse): SentTeamInvite | null {
  if (!payload.invite) {
    return null;
  }

  return {
    id: payload.invite.id,
    email: payload.invite.email,
    role: payload.invite.role,
    firmName: payload.invite.firmName,
    inviteCode: payload.invite.inviteCode,
    inviteLink: payload.invite.inviteLink,
    expiresAt: payload.invite.expiresAt,
    deliveryStatus:
      payload.delivery?.status === "sent"
        ? "sent"
        : payload.delivery?.status === "simulated"
          ? "simulated"
          : "failed",
    createdAt: payload.invite.createdAt,
  };
}

function inviteMessage(payload: InviteResponse) {
  if (payload.delivery?.status === "sent") {
    return `Invitation emailed to ${payload.invite?.email ?? "the advisor"}.`;
  }

  if (payload.delivery?.status === "simulated") {
    return (
      "The secure invitation was created, but external email is simulated. " +
      "Copy the link now or enable live email and retry."
    );
  }

  if (payload.delivery?.status === "disabled") {
    return (
      "The secure invitation was created, but email delivery is disabled. " +
      "Copy the link now or enable live email and retry."
    );
  }

  if (payload.invite) {
    return (
      payload.warning ||
      payload.delivery?.error ||
      payload.message ||
      "The secure invitation was created, but the email provider did not deliver it. Copy the link or retry email."
    );
  }

  return (
    payload.detail ||
    payload.error ||
    payload.message ||
    "The advisor invitation could not be processed."
  );
}

function isWarningMessage(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("could not") ||
    normalized.includes("does not allow") ||
    normalized.includes("valid") ||
    normalized.includes("failed") ||
    normalized.includes("disabled") ||
    normalized.includes("simulated") ||
    normalized.includes("did not deliver") ||
    normalized.includes("not configured")
  );
}

export default function WorkspaceInvitePanel({
  firmId,
  firmName,
  canInvite,
  initialInvites,
  onInviteCreated,
}: {
  firmId: string | null;
  firmName: string;
  canInvite: boolean;
  initialInvites: SentTeamInvite[];
  onInviteCreated: (invite: SentTeamInvite) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof TEAM_ROLE_OPTIONS)[number]>(
    "Lead Advisor",
  );
  const [sending, setSending] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState(
    canInvite
      ? "Create a database-backed beta account invitation."
      : "Slice will verify your invitation permission securely on the server.",
  );
  const [lastInvite, setLastInvite] = useState<SentTeamInvite | null>(
    initialInvites[0] ?? null,
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!lastInvite && initialInvites[0]) {
      setLastInvite(initialInvites[0]);
    }
  }, [initialInvites, lastInvite]);

  useEffect(() => {
    setMessage((current) => {
      if (
        current === "Firm-owner or invite-member permission is required." ||
        current ===
          "Slice will verify your invitation permission securely on the server."
      ) {
        return canInvite
          ? "Create a database-backed beta account invitation."
          : "Slice will verify your invitation permission securely on the server.";
      }

      return current;
    });
  }, [canInvite]);

  const recentInvites = useMemo(
    () =>
      [
        ...(lastInvite ? [lastInvite] : []),
        ...initialInvites.filter((invite) => invite.id !== lastInvite?.id),
      ].slice(0, 3),
    [initialInvites, lastInvite],
  );

  async function readPayload(response: Response) {
    return (await response.json().catch(() => ({}))) as InviteResponse;
  }

  function applyInvitePayload(payload: InviteResponse) {
    const invite = responseToInvite(payload);

    if (invite) {
      setLastInvite(invite);
      onInviteCreated(invite);
      setCopied(false);
    }

    setMessage(inviteMessage(payload));
    return invite;
  }

  async function sendInvite() {
    const cleanEmail = email.trim().toLowerCase();

    if (!validEmail(cleanEmail)) {
      setMessage("Enter a valid advisor email address.");
      return;
    }


    setSending(true);
    setMessage("Creating the secure invitation and contacting the email provider.");

    try {
      const response = await fetch("/api/team-invites/send", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "create",
          firmId,
          firmName,
          email: cleanEmail,
          to: cleanEmail,
          role,
        }),
      });
      const payload = await readPayload(response);
      const invite = applyInvitePayload(payload);

      if (!response.ok && !invite) {
        throw new Error(inviteMessage(payload));
      }

      if (invite) {
        setEmail("");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The advisor invitation could not be processed.",
      );
    } finally {
      setSending(false);
    }
  }

  async function retryInviteEmail() {
    if (!lastInvite || retrying) {
      return;
    }

    setRetrying(true);
    setMessage("Refreshing the secure code and retrying email delivery.");

    try {
      const response = await fetch("/api/team-invites/send", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "resend",
          firmId,
          inviteId: lastInvite.id,
          inviteCode: lastInvite.inviteCode,
        }),
      });
      const payload = await readPayload(response);
      const invite = applyInvitePayload(payload);

      if (!response.ok && !invite) {
        throw new Error(inviteMessage(payload));
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The invitation email could not be retried.",
      );
    } finally {
      setRetrying(false);
    }
  }

  async function copyLatest() {
    if (!lastInvite?.inviteLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(lastInvite.inviteLink);
      setCopied(true);
      setMessage("Secure invitation link copied.");
    } catch {
      setMessage("The browser could not copy the invitation link.");
    }
  }

  return (
    <WorkspaceSurface className="p-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-emerald-500/15 via-cyan-500/[0.035] to-transparent" />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <SectionEyebrow>Firm access</SectionEyebrow>
            <h2 className="mt-2 text-xl font-black tracking-[-0.035em] text-white">
              Invite an advisor
            </h2>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
              Creates a secure, expiring firm invitation first, then attempts the
              advisor email without losing the link when delivery is unavailable.
            </p>
          </div>

          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-emerald-300/18 bg-emerald-500/[0.08] text-emerald-200">
            <UserPlus className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          <label>
            <span className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-600">
              Advisor email
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void sendInvite();
                }
              }}
              placeholder="advisor@firm.com"
              autoComplete="email"
              disabled={sending || retrying}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm font-bold text-white outline-none ring-emerald-500 placeholder:text-slate-700 focus:ring-2 disabled:opacity-50"
            />
          </label>

          <label>
            <span className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-600">
              Firm role
            </span>
            <select
              value={role}
              onChange={(event) =>
                setRole(event.target.value as (typeof TEAM_ROLE_OPTIONS)[number])
              }
              disabled={sending || retrying}
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#020806] px-3 py-3 text-sm font-bold text-white outline-none ring-emerald-500 focus:ring-2 disabled:opacity-50"
            >
              {TEAM_ROLE_OPTIONS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => void sendInvite()}
            disabled={sending || retrying}
            className="group relative mt-1 inline-flex min-h-12 items-center justify-center gap-2 overflow-hidden rounded-xl border border-emerald-400/25 bg-gradient-to-r from-emerald-500 via-emerald-700 to-emerald-950 px-4 text-xs font-black text-white shadow-lg shadow-emerald-950/35 transition hover:brightness-110 disabled:opacity-45"
          >
            <span className="absolute inset-0 -translate-x-[120%] bg-gradient-to-r from-transparent via-white/16 to-transparent transition duration-700 group-hover:translate-x-[120%]" />
            {sending ? (
              <RefreshCw className="relative h-4 w-4 animate-spin" />
            ) : (
              <Send className="relative h-4 w-4" />
            )}
            <span className="relative">
              {sending ? "Creating invitation…" : "Create and email invitation"}
            </span>
          </button>
        </div>

        <div
          className={cx(
            "mt-3 flex items-start gap-2 rounded-xl border p-3 text-[11px] font-semibold leading-5",
            isWarningMessage(message)
              ? "border-amber-400/20 bg-amber-500/[0.07] text-amber-100"
              : "border-emerald-300/14 bg-emerald-500/[0.05] text-emerald-50/80",
          )}
        >
          {isWarningMessage(message) ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
          )}
          <span>{message}</span>
        </div>

        {lastInvite ? (
          <div className="mt-3 rounded-xl border border-white/8 bg-black/30 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-black text-white">
                  {lastInvite.email}
                </p>
                <p className="mt-1 truncate text-[9px] font-black uppercase tracking-[0.11em] text-slate-600">
                  {lastInvite.role} · expires{" "}
                  {new Date(lastInvite.expiresAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
              <WorkspacePill tone={deliveryTone(lastInvite.deliveryStatus)}>
                {lastInvite.deliveryStatus}
              </WorkspacePill>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void copyLatest()}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-black text-slate-300 hover:border-emerald-300/20 hover:text-white"
              >
                {copied ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied" : "Copy secure link"}
              </button>

              <a
                href={lastInvite.inviteLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300/16 bg-emerald-500/[0.055] px-3 py-2 text-[10px] font-black text-emerald-100 hover:bg-emerald-500/10"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Test secure link
              </a>
            </div>

            {lastInvite.deliveryStatus !== "sent" ? (
              <button
                type="button"
                onClick={() => void retryInviteEmail()}
                disabled={retrying || sending}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber-400/20 bg-amber-500/[0.07] px-3 py-2 text-[10px] font-black text-amber-100 transition hover:bg-amber-500/12 disabled:opacity-50"
              >
                {retrying ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                {retrying ? "Retrying email…" : "Refresh link and retry email"}
              </button>
            ) : null}
          </div>
        ) : null}

        {recentInvites.length ? (
          <div className="mt-3 border-t border-white/8 pt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-600">
                Recent beta invites
              </p>
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
            </div>

            <div className="mt-2 space-y-1.5">
              {recentInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex min-w-0 items-center gap-2 rounded-lg border border-white/8 bg-white/[0.025] px-2.5 py-2"
                >
                  {invite.deliveryStatus === "sent" ? (
                    <Mail className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                  ) : (
                    <Clock3 className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-slate-300">
                    {invite.email}
                  </span>
                  <span className="truncate text-[8px] font-black uppercase tracking-[0.08em] text-slate-700">
                    {invite.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </WorkspaceSurface>
  );
}