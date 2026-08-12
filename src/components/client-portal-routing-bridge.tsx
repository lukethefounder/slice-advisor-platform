"use client";

import { useEffect, useRef, useState } from "react";
import {
  addClientPortalMessage,
  addClientPortalThread,
  clearClientPortalSession,
  createMessage,
  createThread,
  loadClientPortalEvents,
  loadClientPortalProfile,
  loadClientPortalSession,
  loadClientPortalThreads,
  saveClientPortalProfile,
  saveClientPortalSession,
} from "@/lib/client-portal-demo-store";

type SchedulingView = {
  configured: boolean;
  enabled: boolean;
  available: boolean;
  url: string | null;
  label: string;
  provider: string | null;
  fallbackMessage: string;
};

type RoutingPayload = {
  ok: boolean;
  client: {
    id: string;
    name: string;
  };
  firm: {
    id: string;
    name: string;
  };
  advisor: {
    membershipId: string;
    name: string;
    email: string;
    role: string;
    calendlyUrl: string | null;
    calendlyLabel: string;
    scheduling: SchedulingView;
  };
  syncCursor: string | null;
  outboundMessages: Array<{
    id: string;
    inboxItemId: string;
    threadId: string | null;
    title?: string;
    advisorName: string;
    body: string;
    createdAt: string;
  }>;
};

type PendingPortalEvent = {
  key: string;
  payload: Record<string, unknown>;
};

type BatchResponse = {
  ok: boolean;
  results?: Array<{
    sourceEventId: string;
    ok: boolean;
  }>;
  error?: string | { message?: string };
};

function priorityForUrgency(urgency: string) {
  if (urgency === "Urgent") return "Critical";
  if (urgency === "High") return "High";
  if (urgency === "Low") return "Low";
  return "Medium";
}

function readSyncedKeys(syncKey: string) {
  try {
    const value = JSON.parse(window.localStorage.getItem(syncKey) || "[]");

    return Array.isArray(value)
      ? value.filter(
          (item): item is string => typeof item === "string",
        )
      : [];
  } catch {
    return [];
  }
}

function storeSyncedKeys(syncKey: string, values: Iterable<string>) {
  window.localStorage.setItem(
    syncKey,
    JSON.stringify(Array.from(new Set(values)).slice(-1_000)),
  );
}

function rememberSyncedKey(syncKey: string, value: string) {
  storeSyncedKeys(syncKey, [...readSyncedKeys(syncKey), value]);
}

function kindForEvent(type: string) {
  if (type === "Meeting Request") return "Meeting";
  if (type === "Risk Tolerance Update") return "Risk Update";

  if (type === "Document Upload" || type.includes("Document")) {
    return "Document";
  }

  if (type === "Portfolio Preference Update") return "Profile Update";
  if (type === "Holdings Permission") return "Holding Update";
  if (type.includes("Request")) return "Request";
  return "Message";
}

function responseError(value: BatchResponse, fallback: string) {
  if (typeof value.error === "string") return value.error;

  if (
    value.error &&
    typeof value.error === "object" &&
    typeof value.error.message === "string"
  ) {
    return value.error.message;
  }

  return fallback;
}

export function ClientPortalRoutingBridge() {
  const [routing, setRouting] = useState<RoutingPayload | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [syncMessage, setSyncMessage] = useState("");
  const syncingRef = useRef(false);
  const latestCursorRef = useRef<string | null>(null);
  const advisorIdRef = useRef<string | null>(null);

  async function secureSignOut() {
    await fetch("/api/client-portal/access", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "logout",
      }),
    }).catch(() => null);

    clearClientPortalSession();
    window.location.href = "/client-login";
  }

  async function fetchRouting() {
    const params = new URLSearchParams();

    if (latestCursorRef.current) {
      params.set("after", latestCursorRef.current);
    }

    const response = await fetch(
      `/api/client-portal/routing${params.size ? `?${params.toString()}` : ""}`,
      {
        cache: "no-store",
      },
    );

    if (response.status === 401) {
      await secureSignOut();
      return null;
    }

    if (!response.ok) return null;

    const data = (await response.json()) as RoutingPayload;

    if (
      advisorIdRef.current &&
      advisorIdRef.current !== data.advisor.membershipId
    ) {
      latestCursorRef.current = null;
    }

    advisorIdRef.current = data.advisor.membershipId;
    latestCursorRef.current = data.syncCursor || latestCursorRef.current;
    setRouting((current) => ({
      ...data,
      outboundMessages: data.outboundMessages.length
        ? data.outboundMessages
        : current?.outboundMessages ?? [],
    }));

    const session = loadClientPortalSession();

    if (session && session.clientId === data.client.id) {
      saveClientPortalSession({
        ...session,
        advisorId: data.advisor.membershipId,
        advisorName: data.advisor.name,
        firmId: data.firm.id,
        firmName: data.firm.name,
      });
    }

    const profile = loadClientPortalProfile();

    if (
      profile.clientId === data.client.id &&
      (profile.advisorId !== data.advisor.membershipId ||
        profile.advisorName !== data.advisor.name ||
        profile.firmId !== data.firm.id ||
        profile.firmName !== data.firm.name)
    ) {
      saveClientPortalProfile({
        ...profile,
        advisorId: data.advisor.membershipId,
        advisorName: data.advisor.name,
        firmId: data.firm.id,
        firmName: data.firm.name,
      });

      const savedProfile = loadClientPortalProfile();
      rememberSyncedKey(
        `slice-client-portal-server-sync-v1:${data.client.id}`,
        `profile:${savedProfile.clientId}:${savedProfile.updatedAt}`,
      );
    }

    return data;
  }

  function pendingPortalEvents(
    data: RoutingPayload,
    synced: Set<string>,
  ): PendingPortalEvent[] {
    const session = loadClientPortalSession();

    if (!session || session.clientId !== data.client.id) return [];

    const pending: PendingPortalEvent[] = [];

    for (const event of loadClientPortalEvents().filter(
      (entry) =>
        entry.clientId === data.client.id && entry.source !== "Demo Seed",
    )) {
      const key = `event:${event.id}`;

      if (synced.has(key)) continue;

      pending.push({
        key,
        payload: {
          sourceEventId: key,
          kind: kindForEvent(event.type),
          title: event.title,
          body: event.message,
          priority: priorityForUrgency(event.urgency),
          senderName: event.clientName,
          senderEmail: event.clientEmail,
          metadata: {
            eventId: event.id,
            eventType: event.type,
            createdAt: event.createdAt,
          },
        },
      });
    }

    for (const thread of loadClientPortalThreads().filter(
      (entry) => entry.clientId === data.client.id,
    )) {
      for (const message of thread.messages.filter(
        (entry) => entry.senderRole === "Client",
      )) {
        const key = `message:${message.id}`;

        if (synced.has(key)) continue;

        pending.push({
          key,
          payload: {
            sourceEventId: key,
            kind: thread.category === "Meeting" ? "Meeting" : "Message",
            title: thread.subject,
            body: message.body,
            priority: priorityForUrgency(thread.priority),
            senderName: message.senderName,
            senderEmail: message.senderEmail || session.clientEmail,
            metadata: {
              threadId: thread.id,
              messageId: message.id,
              category: thread.category,
              createdAt: message.createdAt,
            },
          },
        });
      }
    }

    const profile = loadClientPortalProfile();

    if (profile.clientId === data.client.id) {
      const key = `profile:${profile.clientId}:${profile.updatedAt}`;

      if (!synced.has(key)) {
        pending.push({
          key,
          payload: {
            sourceEventId: key,
            kind: "Profile Update",
            title: "Client profile preferences updated",
            body:
              "The client updated portal profile, contact, risk, allocation, or permission information.",
            priority: "Medium",
            senderName: profile.clientName,
            senderEmail: profile.clientEmail,
            metadata: {
              preferredContactMethod: profile.preferredContactMethod,
              onboardingStep: profile.onboardingStep,
              advisorAccessStatus: profile.advisorAccessStatus,
              updatedAt: profile.updatedAt,
            },
          },
        });
      }
    }

    return pending.slice(0, 50);
  }

  async function synchronizePendingEvents(
    data: RoutingPayload,
    syncKey: string,
    synced: Set<string>,
  ) {
    const pending = pendingPortalEvents(data, synced);

    if (!pending.length) return false;

    const response = await fetch("/api/client-portal/routing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        events: pending.map((item) => item.payload),
      }),
    });
    const result = (await response.json()) as BatchResponse;

    if (!response.ok) {
      throw new Error(responseError(result, "Portal synchronization failed."));
    }

    const successful = new Set(
      (result.results ?? [])
        .filter((item) => item.ok)
        .map((item) => item.sourceEventId),
    );

    for (const item of pending) {
      if (successful.has(item.key)) synced.add(item.key);
    }

    storeSyncedKeys(syncKey, synced);
    return successful.size > 0;
  }

  function applyOutboundMessages(
    data: RoutingPayload,
    syncKey: string,
    synced: Set<string>,
  ) {
    let changed = false;

    for (const reply of data.outboundMessages) {
      const key = `reply:${reply.id}`;

      if (synced.has(key)) continue;

      const existingThreads = loadClientPortalThreads();
      const targetThread = reply.threadId
        ? existingThreads.find((thread) => thread.id === reply.threadId)
        : null;

      if (targetThread) {
        const message = createMessage(targetThread.id, {
          senderRole: "Advisor",
          senderName: reply.advisorName,
          body: reply.body,
          readByClient: false,
          readByAdvisor: true,
        });

        addClientPortalMessage(targetThread.id, {
          ...message,
          id: `server_reply_${reply.id}`,
          createdAt: reply.createdAt,
        });
      } else {
        const session = loadClientPortalSession();

        if (!session) continue;

        const thread = createThread({
          clientId: session.clientId,
          clientName: session.clientName,
          clientEmail: session.clientEmail,
          advisorId: data.advisor.membershipId,
          advisorName: data.advisor.name,
          firmId: data.firm.id,
          firmName: data.firm.name,
          subject: reply.title || "Message from your advisor",
          firstMessage: reply.body,
          senderRole: "Advisor",
          senderName: reply.advisorName,
          category: "General",
          priority: "Normal",
          status: "Waiting on Client",
        });

        addClientPortalThread({
          ...thread,
          id: `server_thread_${reply.id}`,
          messages: thread.messages.map((message) => ({
            ...message,
            id: `server_reply_${reply.id}`,
            threadId: `server_thread_${reply.id}`,
            createdAt: reply.createdAt,
          })),
        });
      }

      synced.add(key);
      changed = true;
    }

    if (changed) storeSyncedKeys(syncKey, synced);
    return changed;
  }

  async function syncPortalState() {
    if (syncingRef.current || document.visibilityState === "hidden") return;

    syncingRef.current = true;

    try {
      const data = await fetchRouting();
      const session = loadClientPortalSession();

      if (!data || !session || session.clientId !== data.client.id) return;

      const syncKey = `slice-client-portal-server-sync-v1:${data.client.id}`;
      const synced = new Set<string>(readSyncedKeys(syncKey));
      const sent = await synchronizePendingEvents(data, syncKey, synced);
      const received = applyOutboundMessages(data, syncKey, synced);

      if (sent || received) {
        setSyncMessage(
          sent && received
            ? "Portal updates were routed to your advisor and new advisor replies were received."
            : sent
              ? "Portal updates were routed securely to your assigned advisor."
              : "New advisor replies were synchronized.",
        );
      }
    } catch {
      setSyncMessage("Secure routing will retry automatically.");
    } finally {
      syncingRef.current = false;
    }
  }

  useEffect(() => {
    void syncPortalState();

    const timer = window.setInterval(() => void syncPortalState(), 30_000);
    const handlePortalChange = () => void syncPortalState();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void syncPortalState();
    };

    window.addEventListener(
      "slice-client-portal-storage-updated",
      handlePortalChange,
    );
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener(
        "slice-client-portal-storage-updated",
        handlePortalChange,
      );
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!routing) return null;

  return (
    <aside className="fixed bottom-4 left-4 z-[95] w-[min(400px,calc(100vw-2rem))] text-white">
      <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-zinc-950/95 shadow-2xl shadow-black/60 backdrop-blur-2xl">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="flex w-full items-center justify-between gap-4 border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.24),transparent_48%),rgba(0,0,0,0.55)] px-5 py-4 text-left"
        >
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
              Your assigned advisor
            </div>
            <div className="mt-1 text-base font-black">{routing.advisor.name}</div>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300">
            {expanded ? "Minimize" : "Open"}
          </span>
        </button>

        {expanded ? (
          <div className="grid gap-3 p-5">
            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
              <div className="text-xs font-black text-white">{routing.firm.name}</div>
              <div className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                {routing.advisor.role} · Messages and profile updates route to this advisor’s individual inbox. Authorized supervisors retain oversight access.
              </div>
            </div>

            {routing.advisor.scheduling.available &&
            routing.advisor.scheduling.url ? (
              <a
                href={routing.advisor.scheduling.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-2xl bg-emerald-600 px-5 py-3 text-center text-sm font-black text-white shadow-lg shadow-emerald-950/40"
              >
                {routing.advisor.scheduling.label}
                {routing.advisor.scheduling.provider
                  ? ` · ${routing.advisor.scheduling.provider}`
                  : ""}
              </a>
            ) : (
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-xs font-semibold leading-5 text-amber-50">
                {routing.advisor.scheduling.fallbackMessage}
              </div>
            )}

            {syncMessage ? (
              <div className="text-[11px] font-semibold leading-5 text-cyan-200">
                {syncMessage}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void secureSignOut()}
              className="rounded-xl border border-white/10 bg-white/[0.045] px-4 py-2 text-xs font-black text-slate-300"
            >
              Secure Sign Out
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}