"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  DEFAULT_CLIENT_ALLOCATION,
  DEFAULT_CLIENT_PROFILE,
  DEFAULT_RISK_SURVEY,
  loadClientPortalProfile,
  saveClientPortalProfile,
  saveClientPortalSession,
} from "@/lib/client-portal-demo-store";
// SLICE_ACCESS_SURFACE_V1 — existing authentication and client context retained.
import { AccessFrame } from "@/components/access-experience/access-frame";


type AccessPayload = {
  ok: boolean;
  client: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    householdName: string;
    preferredContactMethod: string;
    onboardingStatus: string;
    onboardingComplete: boolean;
  };
  advisor: {
    membershipId: string;
    name: string;
    email: string;
    role: string;
    calendlyUrl: string | null;
    calendlyLabel: string;
  } | null;
  firm: {
    id: string;
    name: string;
  };
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Pill({
  children,
  tone = "red",
}: {
  children: React.ReactNode;
  tone?: "red" | "cyan" | "purple" | "amber" | "green";
}) {
  const tones = {
    red: "border-rose-500/30 bg-rose-500/10 text-rose-200",
    cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
    purple: "border-purple-500/30 bg-purple-500/10 text-purple-200",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  };

  return (
    <span
      className={cx(
        "inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

function saveLocalPortalContext(data: AccessPayload) {
  if (!data.advisor) return;

  const now = new Date().toISOString();
  saveClientPortalSession({
    clientId: data.client.id,
    clientName: data.client.fullName,
    clientEmail: data.client.email,
    advisorId: data.advisor.membershipId,
    advisorName: data.advisor.name,
    firmId: data.firm.id,
    firmName: data.firm.name,
    inviteCode: "SECURE-SERVER-SESSION",
    signupComplete: data.client.onboardingComplete,
    riskSurveyComplete: false,
    signedInAt: now,
  });

  const existing = loadClientPortalProfile();
  const preserve = existing.clientId === data.client.id;

  saveClientPortalProfile({
    ...(preserve ? existing : DEFAULT_CLIENT_PROFILE),
    clientId: data.client.id,
    clientName: data.client.fullName,
    clientEmail: data.client.email,
    phone: data.client.phone || "",
    preferredContactMethod:
      data.client.preferredContactMethod || "Portal + email",
    advisorId: data.advisor.membershipId,
    advisorName: data.advisor.name,
    firmId: data.firm.id,
    firmName: data.firm.name,
    householdName: data.client.householdName || "",
    onboardingStep: data.client.onboardingComplete ? "Portal Ready" : "Signup",
    riskSurvey: preserve ? existing.riskSurvey : DEFAULT_RISK_SURVEY,
    allocation: preserve ? existing.allocation : DEFAULT_CLIENT_ALLOCATION,
    permissionsAcknowledged: preserve
      ? existing.permissionsAcknowledged
      : false,
    advisorAccessStatus: "Active",
    advisorAccessNote:
      "Portal submissions route only to the advisor currently assigned by the firm.",
    createdAt: preserve ? existing.createdAt : now,
    updatedAt: now,
  });

  const savedProfile = loadClientPortalProfile();
  const syncKey = `slice-client-portal-server-sync-v1:${data.client.id}`;
  let synced: string[] = [];
  try {
    synced = JSON.parse(window.localStorage.getItem(syncKey) || "[]");
  } catch {
    synced = [];
  }
  const profileKey = `profile:${savedProfile.clientId}:${savedProfile.updatedAt}`;
  window.localStorage.setItem(
    syncKey,
    JSON.stringify(Array.from(new Set([...synced, profileKey])).slice(-1000)),
  );
}

export default function ClientLoginPage() {
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmail(params.get("email") || "");
    setInviteCode(params.get("code") || params.get("invite") || "");

    if (params.has("code") || params.has("invite") || params.has("email")) {
      window.history.replaceState({}, "", "/client-login");
    }
  }, []);

  async function continueToPortal(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    if (!email.trim() || !inviteCode.trim()) {
      setMessage("Enter the client email and secure advisor invite code.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/client-portal/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          email: email.trim(),
          inviteCode: inviteCode.trim(),
        }),
      });
      const data = (await response.json()) as AccessPayload & { error?: string };

      if (!response.ok) {
        setMessage(data.error || "Unable to open the client portal.");
        return;
      }

      if (!data.advisor) {
        setMessage("This client must be assigned to an advisor before portal access.");
        return;
      }

      saveLocalPortalContext(data);
      window.location.href = data.client.onboardingComplete
        ? "/client-portal"
        : "/client-signup";
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to open the client portal.",
      );
    } finally {
      setLoading(false);
    }
  }

  return <AccessFrame variant="client" email={email} secret={inviteCode} onEmailChange={setEmail} onSecretChange={setInviteCode} onSubmit={continueToPortal} loading={loading} message={message}/>;
}