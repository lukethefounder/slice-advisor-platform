import type {
  ClientDetailPayload,
  ClientListPayload,
  ClientListSort,
  ClientSectionName,
  ClientSectionPayload,
} from "@/lib/clients/contracts";

export type ClientMutationResponse = {
  ok: true;
  action: string;
  clientId: string;
  entityId: string | null;
  affectedCount: number;
  message: string;
  client?: ClientDetailPayload["client"] | null;
  updatedAt: string;
  refreshRecommended: boolean;
};

export type ClientListRequest = {
  q?: string;
  status?: string;
  risk?: string;
  advisorMembershipId?: string;
  sort?: ClientListSort;
  direction?: "asc" | "desc";
  limit?: number;
  cursor?: string | null;
  metrics?: boolean;
};

export type ClientSectionRequest = {
  clientId: string;
  section: ClientSectionName;
  q?: string;
  status?: string;
  type?: string;
  limit?: number;
  cursor?: string | null;
};

export class ClientApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(input: { message: string; status: number; code?: string | null }) {
    super(input.message);
    this.name = "ClientApiError";
    this.status = input.status;
    this.code = input.code ?? null;
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    detail?: string;
    code?: string;
  };

  if (!response.ok) {
    throw new ClientApiError({
      status: response.status,
      code: body.code ?? null,
      message:
        body.error || body.detail || `Request failed with HTTP ${response.status}.`,
    });
  }

  return body;
}

export async function fetchClientList(
  input: ClientListRequest,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    mode: "list",
    limit: String(Math.max(1, Math.min(100, input.limit ?? 25))),
    sort: input.sort ?? "updatedAt",
    direction: input.direction ?? "desc",
    metrics: input.metrics === false ? "false" : "true",
  });

  if (input.q?.trim()) params.set("q", input.q.trim());
  if (input.status?.trim()) params.set("status", input.status.trim());
  if (input.risk?.trim()) params.set("risk", input.risk.trim());
  if (input.advisorMembershipId?.trim()) {
    params.set("advisorMembershipId", input.advisorMembershipId.trim());
  }
  if (input.cursor) params.set("cursor", input.cursor);

  const response = await fetch(`/api/clients?${params.toString()}`, {
    cache: "no-store",
    signal,
  });

  return readJson<ClientListPayload>(response);
}

export async function fetchClientDetail(clientId: string, signal?: AbortSignal) {
  const response = await fetch(
    `/api/clients/${encodeURIComponent(clientId)}?view=overview`,
    {
      cache: "no-store",
      signal,
    },
  );

  return readJson<ClientDetailPayload>(response);
}

export async function fetchClientSection(
  input: ClientSectionRequest,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    limit: String(Math.max(1, Math.min(50, input.limit ?? 25))),
  });

  if (input.q?.trim()) params.set("q", input.q.trim());
  if (input.status?.trim()) params.set("status", input.status.trim());
  if (input.type?.trim()) params.set("type", input.type.trim());
  if (input.cursor) params.set("cursor", input.cursor);

  const response = await fetch(
    `/api/clients/${encodeURIComponent(input.clientId)}/sections/${encodeURIComponent(
      input.section,
    )}?${params.toString()}`,
    {
      cache: "no-store",
      signal,
    },
  );

  return readJson<ClientSectionPayload>(response);
}

export async function mutateClient(
  body: Record<string, unknown>,
  sensitiveAction?: string,
) {
  const response = await fetch("/api/clients?response=compact", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-slice-sensitive-action":
        sensitiveAction || String(body.action || "client-action"),
    },
    body: JSON.stringify(body),
  });

  return readJson<ClientMutationResponse>(response);
}

export async function deleteClient(clientId: string) {
  const response = await fetch(`/api/clients/${encodeURIComponent(clientId)}`, {
    method: "DELETE",
    headers: {
      "x-slice-sensitive-action": "delete-client-profile",
    },
  });

  return readJson<{
    ok: true;
    deletedClientId: string;
    deletedClientName: string;
  }>(response);
}

export async function notifyAdvisorOfClientChange(input: {
  advisorEmail: string;
  clientName: string;
  changeType: string;
  summary: string;
}) {
  if (!input.advisorEmail.trim()) return null;

  const response = await fetch("/api/clients/notify-change", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-slice-sensitive-action": "client-change-notification",
    },
    body: JSON.stringify({
      ...input,
      advisorEmail: input.advisorEmail.trim(),
      source: "Advisor Client Profiles",
    }),
  });

  if (!response.ok) return null;
  return response.json().catch(() => null);
}