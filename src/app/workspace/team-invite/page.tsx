"use client";

import Link from "next/link";
import {
  CheckCircle2,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UsersRound,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  BrandMark,
  Card,
  Pill,
  SliceBackground,
  cx,
} from "@/components/slice-ui";

type InviteDetails = {
  inviteCode: string;
  firmName: string;
  role: string;
  emailMasked: string;
  inviterName: string;
  expiresAt: string | null;
  existingAccount: boolean;
};

type InviteLookupResponse = {
  ok: boolean;
  invite?: InviteDetails;
  error?: string;
};

type RegisterResponse = {
  user?: {
    id: string;
    name: string;
    email: string;
  };
  firm?: {
    id: string;
    name: string;
  };
  membership?: {
    role: string;
  };
  error?: string;
  detail?: string;
};

export default function TeamInvitePage() {
  const [inviteCode, setInviteCode] = useState("");
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const code =
      new URLSearchParams(window.location.search)
        .get("code")
        ?.trim()
        .toUpperCase() || "";

    if (!code) {
      setLoadingInvite(false);
      setMessage("This invitation link is missing its secure code.");
      return;
    }

    setInviteCode(code);

    async function loadInvite() {
      try {
        const response = await fetch(
          `/api/team-invites/send?code=${encodeURIComponent(code)}`,
          {
            cache: "no-store",
          },
        );
        const payload = (await response.json()) as InviteLookupResponse;

        if (!response.ok || !payload.ok || !payload.invite) {
          throw new Error(
            payload.error || "The invitation could not be verified.",
          );
        }

        setInvite(payload.invite);
        setMessage("");
      } catch (error) {
        setInvite(null);
        setMessage(
          error instanceof Error
            ? error.message
            : "The invitation could not be verified.",
        );
      } finally {
        setLoadingInvite(false);
      }
    }

    void loadInvite();
  }, []);

  const ready = useMemo(
    () =>
      Boolean(
        invite &&
          inviteCode &&
          name.trim() &&
          password.length >= 8 &&
          password === confirmPassword,
      ),
    [confirmPassword, invite, inviteCode, name, password],
  );

  async function acceptInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!invite || !inviteCode) {
      setMessage("The invitation is not ready for account creation.");
      return;
    }

    if (!name.trim()) {
      setMessage("Enter your full name.");
      return;
    }

    if (password.length < 8) {
      setMessage("Use a password with at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/invite-register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inviteCode,
          name: name.trim(),
          password,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as RegisterResponse;

      if (!response.ok) {
        throw new Error(
          payload.detail
            ? `${payload.error || "Invite acceptance failed."} ${payload.detail}`
            : payload.error || "Invite acceptance failed.",
        );
      }

      setPassword("");
      setConfirmPassword("");
      setComplete(true);
      setMessage("Your secure advisor account is ready.");
      window.setTimeout(() => {
        window.location.href = "/workspace";
      }, 650);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Invite acceptance failed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SliceBackground>
      <div className="mx-auto grid min-h-screen max-w-7xl gap-5 px-4 py-5 sm:px-6">
        <header className="rounded-[1.7rem] border border-emerald-300/12 bg-black/65 p-4 shadow-xl shadow-emerald-950/25 backdrop-blur-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <BrandMark subtitle="Secure Advisor Invitation" />
            <Link
              href="/founder-login"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black text-slate-300 hover:border-emerald-400/25 hover:text-white"
            >
              Existing account sign in
            </Link>
          </div>
        </header>

        <section className="grid items-center gap-5 lg:grid-cols-[0.88fr_1.12fr]">
          <Card className="p-6 sm:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(16,185,129,0.24),transparent_30%),radial-gradient(circle_at_85%_20%,rgba(34,211,238,0.10),transparent_30%)]" />

            <div className="relative">
              <div className="flex flex-wrap gap-2">
                <Pill tone="green">Database verified</Pill>
                <Pill tone="cyan">Expiring beta access</Pill>
              </div>

              <h1 className="mt-6 text-4xl font-black leading-[0.98] tracking-[-0.05em] text-white sm:text-6xl">
                Join the advisor operating system.
              </h1>

              <p className="mt-5 text-sm font-semibold leading-7 text-slate-400">
                This invitation creates or connects a real Slice account, assigns the
                firm role selected by leadership, and establishes a protected session.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {[
                  {
                    icon: ShieldCheck,
                    label: "Secure firm membership",
                    helper: "Database-backed access",
                  },
                  {
                    icon: LockKeyhole,
                    label: "Protected session",
                    helper: "HTTP-only login cookie",
                  },
                  {
                    icon: UsersRound,
                    label: "Role-aware workspace",
                    helper: "Firm permissions applied",
                  },
                  {
                    icon: KeyRound,
                    label: "No demo credentials",
                    helper: "Real beta account creation",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/8 bg-white/[0.035] p-4"
                  >
                    <item.icon className="h-5 w-5 text-emerald-300" />
                    <p className="mt-3 text-sm font-black text-white">
                      {item.label}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-600">
                      {item.helper}
                    </p>
                  </div>
                ))}
              </div>

              {invite ? (
                <div className="mt-7 grid gap-3">
                  <div className="rounded-2xl border border-emerald-300/14 bg-emerald-500/[0.055] p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-300">
                      Firm
                    </p>
                    <p className="mt-1 text-lg font-black text-white">
                      {invite.firmName}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-600">
                        Invited account
                      </p>
                      <p className="mt-1 truncate text-sm font-black text-white">
                        {invite.emailMasked}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-600">
                        Role
                      </p>
                      <p className="mt-1 truncate text-sm font-black text-white">
                        {invite.role}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs font-semibold leading-5 text-slate-500">
                    Invited by {invite.inviterName}
                    {invite.expiresAt
                      ? ` · expires ${new Date(invite.expiresAt).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          },
                        )}`
                      : ""}
                  </p>
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="p-6 sm:p-8">
            {loadingInvite ? (
              <div className="grid min-h-[520px] place-items-center text-center">
                <div>
                  <RefreshCw className="mx-auto h-9 w-9 animate-spin text-emerald-300" />
                  <h2 className="mt-5 text-2xl font-black text-white">
                    Verifying invitation
                  </h2>
                  <p className="mt-2 text-sm font-semibold text-slate-500">
                    Checking firm, role, expiration, and account status.
                  </p>
                </div>
              </div>
            ) : complete ? (
              <div className="grid min-h-[520px] place-items-center text-center">
                <div>
                  <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-emerald-400/25 bg-emerald-500/[0.08] text-emerald-200">
                    <CheckCircle2 className="h-9 w-9" />
                  </div>
                  <h2 className="mt-6 text-3xl font-black text-white">
                    Account created.
                  </h2>
                  <p className="mx-auto mt-3 max-w-lg text-sm font-semibold leading-7 text-slate-400">
                    Your firm membership is active. Slice is opening the green-market
                    advisor workspace.
                  </p>
                  <Link
                    href="/workspace"
                    className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl border border-emerald-400/25 bg-gradient-to-r from-emerald-500 via-emerald-700 to-emerald-950 px-6 text-sm font-black text-white"
                  >
                    Open Workspace
                  </Link>
                </div>
              </div>
            ) : invite ? (
              <form onSubmit={acceptInvite}>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="green">
                    {invite.existingAccount
                      ? "Connect existing account"
                      : "Create advisor account"}
                  </Pill>
                  <Pill tone="cyan">{invite.role}</Pill>
                </div>

                <h2 className="mt-5 text-3xl font-black tracking-[-0.04em] text-white">
                  Finish secure account setup.
                </h2>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
                  {invite.existingAccount
                    ? "This email already has a Slice account. Enter the account name and existing password to connect the firm membership."
                    : "Choose your account name and password. The password is hashed server-side and is never stored in browser storage."}
                </p>

                {message ? (
                  <div
                    className={cx(
                      "mt-4 rounded-2xl border p-4 text-sm font-bold leading-6",
                      message.includes("ready")
                        ? "border-emerald-400/25 bg-emerald-500/[0.08] text-emerald-100"
                        : "border-amber-400/25 bg-amber-500/[0.08] text-amber-100",
                    )}
                  >
                    {message}
                  </div>
                ) : null}

                <div className="mt-6 grid gap-4">
                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
                      Full name
                    </span>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoComplete="name"
                      placeholder="Your full name"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-4 text-sm font-bold text-white outline-none ring-emerald-500 placeholder:text-slate-700 focus:ring-2"
                    />
                  </label>

                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
                      {invite.existingAccount
                        ? "Existing account password"
                        : "Create password"}
                    </span>
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete={
                        invite.existingAccount
                          ? "current-password"
                          : "new-password"
                      }
                      placeholder="Minimum 8 characters"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-4 text-sm font-bold text-white outline-none ring-emerald-500 placeholder:text-slate-700 focus:ring-2"
                    />
                  </label>

                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
                      Confirm password
                    </span>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      autoComplete="new-password"
                      placeholder="Repeat password"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-4 text-sm font-bold text-white outline-none ring-emerald-500 placeholder:text-slate-700 focus:ring-2"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={!ready || submitting}
                  className="group relative mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl border border-emerald-400/25 bg-gradient-to-r from-emerald-500 via-emerald-700 to-emerald-950 px-5 text-sm font-black text-white shadow-lg shadow-emerald-950/40 transition hover:brightness-110 disabled:opacity-40"
                >
                  {submitting ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserCheck className="h-4 w-4" />
                  )}
                  {submitting
                    ? "Creating secure access…"
                    : invite.existingAccount
                      ? "Connect account to firm"
                      : "Create account and join firm"}
                </button>
              </form>
            ) : (
              <div className="grid min-h-[520px] place-items-center text-center">
                <div>
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-amber-400/20 bg-amber-500/[0.07] text-amber-200">
                    <LockKeyhole className="h-7 w-7" />
                  </div>
                  <h2 className="mt-5 text-2xl font-black text-white">
                    Invitation unavailable
                  </h2>
                  <p className="mx-auto mt-3 max-w-lg text-sm font-semibold leading-7 text-slate-500">
                    {message ||
                      "Ask the firm owner to send a new secure beta invitation."}
                  </p>
                  <Link
                    href="/founder-login"
                    className="mt-6 inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-slate-300 hover:text-white"
                  >
                    Go to sign in
                  </Link>
                </div>
              </div>
            )}
          </Card>
        </section>
      </div>
    </SliceBackground>
  );
}