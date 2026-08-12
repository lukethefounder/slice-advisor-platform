import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  AccessControlError,
  clientScopeWhere,
  getAccessContextForUser,
  hasFirmPermission,
  requireClientInScope,
  type AccessContext,
} from "@/lib/access-control";
import { ApiError } from "@/lib/api-route";
import {
  CLIENT_LIST_SORTS,
  CLIENT_SECTION_NAMES,
  type ClientAdvisorSummary,
  type ClientDetail,
  type ClientDirectoryMetrics,
  type ClientListPayload,
  type ClientListSort,
  type ClientOptionsPayload,
  type ClientSectionName,
  type ClientSectionPayload,
} from "@/lib/clients/contracts";
import {
  decryptAdvisorNote,
  decryptClientProfiles,
  decryptDocumentVaultItem,
  decryptPortfolioHolding,
  decryptSensitiveText,
  vaultStatus,
} from "@/lib/data-vault";
import {
  createCursorPage,
  decodeCursor,
  paginationScope,
  readPageSize,
  readSearch,
  readSortDirection,
  type SortDirection,
} from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

const MAX_COMPAT_CLIENTS = 100;
const DEFAULT_COMPAT_CLIENTS = 50;
const MAX_COMPAT_CHILDREN = 25;
const DEFAULT_SECTION_PAGE_SIZE = 25;
const MAX_SECTION_PAGE_SIZE = 50;

const CLIENT_LIST_SELECT = {
  id: true,
  fullName: true,
  email: true,
  householdName: true,
  clientType: true,
  riskProfile: true,
  status: true,
  portalEnabled: true,
  portalOnboardingStatus: true,
  assignedAdvisorMembershipId: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      holdings: true,
      notesList: true,
      tasks: true,
      reviews: true,
      documents: true,
      briefingReports: true,
    },
  },
} satisfies Prisma.ClientProfileSelect;

const CLIENT_OPTION_SELECT = {
  id: true,
  fullName: true,
  householdName: true,
  riskProfile: true,
  status: true,
  assignedAdvisorMembershipId: true,
} satisfies Prisma.ClientProfileSelect;

const CLIENT_DETAIL_SELECT = {
  id: true,
  userId: true,
  firmId: true,
  assignedAdvisorMembershipId: true,
  assignedAdvisorAt: true,
  assignedByUserId: true,
  fullName: true,
  email: true,
  phone: true,
  householdName: true,
  preferredContactMethod: true,
  clientType: true,
  riskProfile: true,
  liquidityNeeds: true,
  timeHorizon: true,
  objective: true,
  portfolioValue: true,
  status: true,
  notes: true,
  portalEnabled: true,
  portalInviteExpiresAt: true,
  portalOnboardingStatus: true,
  portalLastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      holdings: true,
      notesList: true,
      tasks: true,
      reviews: true,
      documents: true,
      briefingReports: true,
    },
  },
} satisfies Prisma.ClientProfileSelect;

const ADVISOR_SELECT = {
  id: true,
  userId: true,
  role: true,
  calendarColor: true,
  calendlyUrl: true,
  calendlyLabel: true,
  calendlyEnabled: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.FirmMembershipSelect;

const HOLDING_SELECT = {
  id: true,
  symbol: true,
  assetName: true,
  assetClass: true,
  value: true,
  allocationPct: true,
  costBasis: true,
  riskLevel: true,
  thesis: true,
  createdAt: true,
} satisfies Prisma.PortfolioHoldingSelect;

const NOTE_SELECT = {
  id: true,
  title: true,
  body: true,
  noteType: true,
  createdAt: true,
} satisfies Prisma.AdvisorNoteSelect;

const TASK_SELECT = {
  id: true,
  title: true,
  description: true,
  dueDate: true,
  priority: true,
  status: true,
  createdAt: true,
} satisfies Prisma.MeetingTaskSelect;

const DOCUMENT_SELECT = {
  id: true,
  fileName: true,
  documentType: true,
  status: true,
  notes: true,
  createdAt: true,
} satisfies Prisma.DocumentVaultItemSelect;

const RISK_REVIEW_SELECT = {
  id: true,
  score: true,
  suitabilityStatus: true,
  summary: true,
  flagsJson: true,
  createdAt: true,
} satisfies Prisma.RiskReviewSelect;

const BRIEFING_SELECT = {
  id: true,
  title: true,
  audience: true,
  briefType: true,
  executiveSummary: true,
  status: true,
  createdAt: true,
} satisfies Prisma.BriefingReportSelect;

type ClientListRow = Prisma.ClientProfileGetPayload<{
  select: typeof CLIENT_LIST_SELECT;
}>;

type ClientDetailRow = Prisma.ClientProfileGetPayload<{
  select: typeof CLIENT_DETAIL_SELECT;
}>;

type ClientOptionRow = Prisma.ClientProfileGetPayload<{
  select: typeof CLIENT_OPTION_SELECT;
}>;

type AdvisorRow = Prisma.FirmMembershipGetPayload<{
  select: typeof ADVISOR_SELECT;
}>;

export type ClientListQuery = {
  q: string;
  status: string | null;
  risk: string | null;
  advisorMembershipId: string | null;
  sort: ClientListSort;
  direction: SortDirection;
  limit: number;
  cursor: string | null;
  includeMetrics: boolean;
};

function cleanFilter(value: string | null, maximumLength = 80) {
  const clean = value?.replace(/\s+/g, " ").trim() ?? "";
  return clean ? clean.slice(0, maximumLength) : null;
}

function dateValue(value: Date | null) {
  return value ? value.toISOString() : null;
}

function clientCounts(row: ClientListRow | ClientDetailRow) {
  return {
    holdings: row._count.holdings,
    notes: row._count.notesList,
    tasks: row._count.tasks,
    reviews: row._count.reviews,
    documents: row._count.documents,
    briefings: row._count.briefingReports,
  };
}

function publicAdvisor(row: AdvisorRow): ClientAdvisorSummary {
  return {
    membershipId: row.id,
    userId: row.userId,
    name: row.user.name || row.user.email || "Advisor",
    email: row.user.email,
    role: row.role,
    calendarColor: row.calendarColor,
    calendlyUrl:
      row.calendlyEnabled && row.calendlyUrl ? row.calendlyUrl : null,
    calendlyLabel: row.calendlyLabel || "Schedule a meeting",
  };
}

async function advisorMap(input: {
  firmId: string;
  membershipIds: Array<string | null | undefined>;
}): Promise<Map<string, ClientAdvisorSummary>> {
  const ids = Array.from(
    new Set(input.membershipIds.filter((id): id is string => Boolean(id))),
  );

  if (!ids.length) return new Map<string, ClientAdvisorSummary>();

  const rows = await prisma.firmMembership.findMany({
    where: {
      id: {
        in: ids,
      },
      firmId: input.firmId,
    },
    select: ADVISOR_SELECT,
  });

  return new Map<string, ClientAdvisorSummary>(
    rows.map((row: AdvisorRow) => [row.id, publicAdvisor(row)]),
  );
}

export async function requireClientRepositoryContext(userId: string) {
  const context = await getAccessContextForUser({ userId });

  if (!context) {
    throw new AccessControlError({
      status: 401,
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication required.",
    });
  }

  if (!context.firm) {
    throw new AccessControlError({
      status: 403,
      code: "ACTIVE_FIRM_REQUIRED",
      message: "An active firm workspace is required.",
    });
  }

  if (!hasFirmPermission(context, "clients.read")) {
    throw new AccessControlError({
      status: 403,
      code: "CLIENT_READ_PERMISSION_REQUIRED",
      message: "Client access is not enabled for this membership.",
    });
  }

  return context;
}

export function parseClientListQuery(params: URLSearchParams): ClientListQuery {
  const sortRaw = params.get("sort")?.trim() ?? "updatedAt";

  if (!CLIENT_LIST_SORTS.includes(sortRaw as ClientListSort)) {
    throw new ApiError({
      status: 400,
      code: "INVALID_CLIENT_SORT",
      message: `sort must be one of: ${CLIENT_LIST_SORTS.join(", ")}.`,
      expose: true,
    });
  }

  return {
    q: readSearch(params),
    status: cleanFilter(params.get("status")),
    risk: cleanFilter(params.get("risk")),
    advisorMembershipId: cleanFilter(params.get("advisorMembershipId"), 128),
    sort: sortRaw as ClientListSort,
    direction: readSortDirection(params, "desc"),
    limit: readPageSize(params, {
      fallback: 25,
      maximum: 100,
    }),
    cursor: params.get("cursor"),
    includeMetrics: params.get("metrics") !== "false",
  };
}

function clientWhere(input: {
  context: AccessContext;
  query: Pick<
    ClientListQuery,
    "q" | "status" | "risk" | "advisorMembershipId"
  >;
}) {
  const scope = clientScopeWhere(input.context);
  const where: Prisma.ClientProfileWhereInput = {
    ...scope,
  };

  if (input.query.status) where.status = input.query.status;
  if (input.query.risk) where.riskProfile = input.query.risk;

  if (input.query.advisorMembershipId) {
    const canSupervise = hasFirmPermission(input.context, "clients.supervise");
    const ownMembershipId = input.context.membership?.id ?? null;

    if (
      !canSupervise &&
      input.query.advisorMembershipId !== ownMembershipId
    ) {
      throw new AccessControlError({
        status: 403,
        code: "ADVISOR_FILTER_PERMISSION_DENIED",
        message: "You cannot view another advisor's client list.",
      });
    }

    where.assignedAdvisorMembershipId = input.query.advisorMembershipId;
  }

  if (input.query.q) {
    where.OR = [
      {
        fullName: {
          contains: input.query.q,
          mode: "insensitive",
        },
      },
      {
        householdName: {
          contains: input.query.q,
          mode: "insensitive",
        },
      },
      {
        clientType: {
          contains: input.query.q,
          mode: "insensitive",
        },
      },
      {
        riskProfile: {
          contains: input.query.q,
          mode: "insensitive",
        },
      },
      {
        status: {
          contains: input.query.q,
          mode: "insensitive",
        },
      },
    ];
  }

  return where;
}

function clientOrderBy(
  sort: ClientListSort,
  direction: SortDirection,
): Prisma.ClientProfileOrderByWithRelationInput[] {
  if (sort === "fullName") {
    return [{ fullName: direction }, { id: direction }];
  }

  if (sort === "status") {
    return [{ status: direction }, { fullName: "asc" }, { id: direction }];
  }

  if (sort === "createdAt") {
    return [{ createdAt: direction }, { id: direction }];
  }

  return [{ updatedAt: direction }, { id: direction }];
}

async function loadClientDirectoryMetrics(input: {
  context: AccessContext;
  filteredWhere: Prisma.ClientProfileWhereInput;
}) {
  const baseWhere = clientScopeWhere(input.context);

  const [
    totalClients,
    filteredClients,
    activeClients,
    needsReview,
    unassignedClients,
    openTasks,
    documentsNeedingReview,
    holdingsTracked,
  ] = await Promise.all([
    prisma.clientProfile.count({ where: baseWhere }),
    prisma.clientProfile.count({ where: input.filteredWhere }),
    prisma.clientProfile.count({
      where: {
        ...baseWhere,
        status: "Active",
      },
    }),
    prisma.clientProfile.count({
      where: {
        ...baseWhere,
        OR: [
          { status: { not: "Active" } },
          { riskProfile: { in: ["Aggressive", "Conservative"] } },
        ],
      },
    }),
    prisma.clientProfile.count({
      where: {
        ...baseWhere,
        assignedAdvisorMembershipId: null,
      },
    }),
    prisma.meetingTask.count({
      where: {
        client: {
          is: baseWhere,
        },
        status: {
          notIn: ["Done", "Complete", "Closed", "Archived"],
        },
      },
    }),
    prisma.documentVaultItem.count({
      where: {
        client: {
          is: baseWhere,
        },
        status: {
          notIn: ["Approved", "Complete", "Archived"],
        },
      },
    }),
    prisma.portfolioHolding.count({
      where: {
        client: {
          is: baseWhere,
        },
      },
    }),
  ]);

  return {
    totalClients,
    filteredClients,
    activeClients,
    needsReview,
    unassignedClients,
    openTasks,
    documentsNeedingReview,
    holdingsTracked,
  } satisfies ClientDirectoryMetrics;
}

export async function listClients(input: {
  context: AccessContext;
  query: ClientListQuery;
}): Promise<ClientListPayload> {
  const where = clientWhere(input);
  const scope = paginationScope({
    resource: "clients",
    userId: input.context.user.id,
    firmId: input.context.firm?.id,
    membershipId:
      hasFirmPermission(input.context, "clients.supervise")
        ? "supervisory"
        : input.context.membership?.id,
    q: input.query.q,
    status: input.query.status,
    risk: input.query.risk,
    advisorMembershipId: input.query.advisorMembershipId,
    sort: input.query.sort,
    direction: input.query.direction,
  });
  const cursorId = decodeCursor(input.query.cursor, scope);

  const rows = await prisma.clientProfile.findMany({
    where,
    select: CLIENT_LIST_SELECT,
    orderBy: clientOrderBy(input.query.sort, input.query.direction),
    take: input.query.limit + 1,
    ...(cursorId
      ? {
          cursor: { id: cursorId },
          skip: 1,
        }
      : {}),
  });

  const page = createCursorPage<ClientListRow>({
    rows,
    pageSize: input.query.limit,
    scope,
  });
  const advisors = await advisorMap({
    firmId: input.context.firm!.id,
    membershipIds: page.items.map(
      (client) => client.assignedAdvisorMembershipId,
    ),
  });

  const metrics = input.query.includeMetrics
    ? await loadClientDirectoryMetrics({
        context: input.context,
        filteredWhere: where,
      })
    : null;

  return {
    ok: true,
    mode: "list",
    clients: page.items.map((client) => ({
      id: client.id,
      fullName: client.fullName,
      email: decryptSensitiveText(client.email) ?? null,
      householdName: client.householdName,
      clientType: client.clientType,
      riskProfile: client.riskProfile,
      status: client.status,
      portalEnabled: client.portalEnabled,
      portalOnboardingStatus: client.portalOnboardingStatus,
      assignedAdvisorMembershipId: client.assignedAdvisorMembershipId,
      assignedAdvisor: client.assignedAdvisorMembershipId
        ? advisors.get(client.assignedAdvisorMembershipId) ?? null
        : null,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
      counts: clientCounts(client),
    })),
    pagination: {
      ...page.pagination,
      sort: input.query.sort,
      direction: input.query.direction,
    },
    filters: {
      q: input.query.q,
      status: input.query.status,
      risk: input.query.risk,
      advisorMembershipId: input.query.advisorMembershipId,
    },
    metrics,
    searchCoverage: [
      "client name",
      "household name",
      "client type",
      "risk profile",
      "status",
    ],
  };
}

export async function listClientOptions(input: {
  context: AccessContext;
  params: URLSearchParams;
}): Promise<ClientOptionsPayload> {
  const limit = readPageSize(input.params, {
    fallback: 50,
    maximum: 100,
  });
  const q = readSearch(input.params);
  const where = clientWhere({
    context: input.context,
    query: {
      q,
      status: cleanFilter(input.params.get("status")),
      risk: null,
      advisorMembershipId: null,
    },
  });
  const scope = paginationScope({
    resource: "client-options",
    userId: input.context.user.id,
    firmId: input.context.firm?.id,
    membershipId:
      hasFirmPermission(input.context, "clients.supervise")
        ? "supervisory"
        : input.context.membership?.id,
    q,
    status: input.params.get("status"),
  });
  const cursorId = decodeCursor(input.params.get("cursor"), scope);
  const rows = await prisma.clientProfile.findMany({
    where,
    select: CLIENT_OPTION_SELECT,
    orderBy: [{ fullName: "asc" }, { id: "asc" }],
    take: limit + 1,
    ...(cursorId
      ? {
          cursor: { id: cursorId },
          skip: 1,
        }
      : {}),
  });
  const page = createCursorPage<ClientOptionRow>({
    rows,
    pageSize: limit,
    scope,
  });

  return {
    ok: true,
    mode: "options",
    clients: page.items,
    pagination: page.pagination,
  };
}

async function assignedAdvisorForClient(input: {
  context: AccessContext;
  membershipId: string | null;
}) {
  if (!input.membershipId || !input.context.firm) return null;

  const row = await prisma.firmMembership.findFirst({
    where: {
      id: input.membershipId,
      firmId: input.context.firm.id,
    },
    select: ADVISOR_SELECT,
  });

  return row ? publicAdvisor(row) : null;
}

function mapClientDetail(
  row: ClientDetailRow,
  assignedAdvisor: ClientAdvisorSummary | null,
): ClientDetail {
  return {
    id: row.id,
    userId: row.userId,
    firmId: row.firmId,
    assignedAdvisorMembershipId: row.assignedAdvisorMembershipId,
    assignedAdvisorAt: dateValue(row.assignedAdvisorAt),
    assignedByUserId: row.assignedByUserId,
    fullName: row.fullName,
    email: decryptSensitiveText(row.email) ?? null,
    phone: decryptSensitiveText(row.phone) ?? null,
    householdName: row.householdName,
    preferredContactMethod: row.preferredContactMethod,
    clientType: row.clientType,
    riskProfile: row.riskProfile,
    liquidityNeeds: row.liquidityNeeds,
    timeHorizon: row.timeHorizon,
    objective: row.objective,
    portfolioValue: decryptSensitiveText(row.portfolioValue) ?? null,
    status: row.status,
    notes: decryptSensitiveText(row.notes) ?? null,
    portalEnabled: row.portalEnabled,
    portalInviteExpiresAt: dateValue(row.portalInviteExpiresAt),
    portalOnboardingStatus: row.portalOnboardingStatus,
    portalLastLoginAt: dateValue(row.portalLastLoginAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    assignedAdvisor,
    counts: clientCounts(row),
  };
}

export async function getClientDetail(input: {
  context: AccessContext;
  clientId: string;
}) {
  const row = await prisma.clientProfile.findFirst({
    where: {
      id: input.clientId,
      ...clientScopeWhere(input.context),
    },
    select: CLIENT_DETAIL_SELECT,
  });

  if (!row) {
    throw new AccessControlError({
      status: 404,
      code: "CLIENT_NOT_FOUND",
      message: "Client not found.",
    });
  }

  const assignedAdvisor = await assignedAdvisorForClient({
    context: input.context,
    membershipId: row.assignedAdvisorMembershipId,
  });

  return mapClientDetail(row, assignedAdvisor);
}

export async function getClientCompatibilityDetail(input: {
  context: AccessContext;
  clientId: string;
}) {
  await requireClientInScope({
    context: input.context,
    clientId: input.clientId,
  });

  const row = await prisma.clientProfile.findFirst({
    where: {
      id: input.clientId,
      ...clientScopeWhere(input.context),
    },
    select: {
      ...CLIENT_DETAIL_SELECT,
      holdings: {
        select: HOLDING_SELECT,
        orderBy: { createdAt: "desc" },
        take: MAX_COMPAT_CHILDREN,
      },
      notesList: {
        select: NOTE_SELECT,
        orderBy: { createdAt: "desc" },
        take: MAX_COMPAT_CHILDREN,
      },
      tasks: {
        select: TASK_SELECT,
        orderBy: { createdAt: "desc" },
        take: MAX_COMPAT_CHILDREN,
      },
      reviews: {
        select: RISK_REVIEW_SELECT,
        orderBy: { createdAt: "desc" },
        take: MAX_COMPAT_CHILDREN,
      },
      documents: {
        select: DOCUMENT_SELECT,
        orderBy: { createdAt: "desc" },
        take: MAX_COMPAT_CHILDREN,
      },
    },
  });

  if (!row) {
    throw new AccessControlError({
      status: 404,
      code: "CLIENT_NOT_FOUND",
      message: "Client not found.",
    });
  }

  const decrypted = decryptClientProfiles([row])[0];

  return {
    ...decrypted,
    phone: decryptSensitiveText(decrypted.phone) ?? null,
  };
}

function parseSectionName(value: string): ClientSectionName {
  if (!CLIENT_SECTION_NAMES.includes(value as ClientSectionName)) {
    throw new ApiError({
      status: 400,
      code: "INVALID_CLIENT_SECTION",
      message: `section must be one of: ${CLIENT_SECTION_NAMES.join(", ")}.`,
      expose: true,
    });
  }

  return value as ClientSectionName;
}

export async function listClientSection(input: {
  context: AccessContext;
  clientId: string;
  section: string;
  params: URLSearchParams;
}): Promise<ClientSectionPayload> {
  const section = parseSectionName(input.section);

  await requireClientInScope({
    context: input.context,
    clientId: input.clientId,
  });

  const limit = readPageSize(input.params, {
    fallback: DEFAULT_SECTION_PAGE_SIZE,
    maximum: MAX_SECTION_PAGE_SIZE,
  });
  const q = readSearch(input.params);
  const status = cleanFilter(input.params.get("status"));
  const type = cleanFilter(input.params.get("type"));
  const scope = paginationScope({
    resource: "client-section",
    userId: input.context.user.id,
    firmId: input.context.firm?.id,
    membershipId:
      hasFirmPermission(input.context, "clients.supervise")
        ? "supervisory"
        : input.context.membership?.id,
    clientId: input.clientId,
    section,
    q,
    status,
    type,
  });
  const cursorId = decodeCursor(input.params.get("cursor"), scope);
  const cursor = cursorId
    ? {
        cursor: { id: cursorId },
        skip: 1,
      }
    : {};

  let rows: Array<Record<string, unknown> & { id: string }> = [];

  if (section === "holdings") {
    rows = await prisma.portfolioHolding.findMany({
      where: {
        clientId: input.clientId,
        ...(type ? { assetClass: type } : {}),
        ...(q
          ? {
              OR: [
                { symbol: { contains: q, mode: "insensitive" } },
                { assetName: { contains: q, mode: "insensitive" } },
                { assetClass: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: HOLDING_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...cursor,
    });
  } else if (section === "notes") {
    rows = await prisma.advisorNote.findMany({
      where: {
        clientId: input.clientId,
        ...(type ? { noteType: type } : {}),
      },
      select: NOTE_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...cursor,
    });
  } else if (section === "tasks") {
    rows = await prisma.meetingTask.findMany({
      where: {
        clientId: input.clientId,
        ...(status ? { status } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: TASK_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...cursor,
    });
  } else if (section === "documents") {
    rows = await prisma.documentVaultItem.findMany({
      where: {
        clientId: input.clientId,
        ...(status ? { status } : {}),
        ...(type ? { documentType: type } : {}),
      },
      select: DOCUMENT_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...cursor,
    });
  } else if (section === "risk-reviews") {
    rows = await prisma.riskReview.findMany({
      where: {
        clientId: input.clientId,
        ...(status ? { suitabilityStatus: status } : {}),
      },
      select: RISK_REVIEW_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...cursor,
    });
  } else {
    rows = await prisma.briefingReport.findMany({
      where: {
        clientId: input.clientId,
        ...(status ? { status } : {}),
        ...(type ? { briefType: type } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                {
                  executiveSummary: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
      },
      select: BRIEFING_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...cursor,
    });
  }

  const page = createCursorPage({
    rows,
    pageSize: limit,
    scope,
  });

  const items = page.items.map((item) => {
    if (section === "holdings") {
      const decrypted = decryptPortfolioHolding(item);
      return {
        ...decrypted,
        createdAt: (decrypted.createdAt as Date).toISOString(),
      };
    }

    if (section === "notes") {
      const decrypted = decryptAdvisorNote(item);
      return {
        ...decrypted,
        createdAt: (decrypted.createdAt as Date).toISOString(),
      };
    }

    if (section === "documents") {
      const decrypted = decryptDocumentVaultItem(item);
      return {
        ...decrypted,
        createdAt: (decrypted.createdAt as Date).toISOString(),
      };
    }

    return {
      ...item,
      ...(item && "dueDate" in item
        ? {
            dueDate:
              item.dueDate instanceof Date ? item.dueDate.toISOString() : null,
          }
        : {}),
      createdAt:
        item && "createdAt" in item && item.createdAt instanceof Date
          ? item.createdAt.toISOString()
          : String(item && "createdAt" in item ? item.createdAt : ""),
    };
  });

  return {
    ok: true,
    clientId: input.clientId,
    section,
    items,
    pagination: page.pagination,
    filters: {
      q,
      status,
      type,
    },
  } as ClientSectionPayload;
}

async function compatibilityMetrics(context: AccessContext) {
  const baseWhere = clientScopeWhere(context);

  const [
    clientCount,
    activeCount,
    emailReadyCount,
    holdingsCount,
    reviewCount,
    notesCount,
    taskCount,
    documentCount,
  ] = await Promise.all([
    prisma.clientProfile.count({ where: baseWhere }),
    prisma.clientProfile.count({
      where: { ...baseWhere, status: "Active" },
    }),
    prisma.clientProfile.count({
      where: { ...baseWhere, email: { not: null } },
    }),
    prisma.portfolioHolding.count({ where: { client: { is: baseWhere } } }),
    prisma.clientProfile.count({
      where: {
        ...baseWhere,
        OR: [
          { status: { not: "Active" } },
          { riskProfile: { in: ["Aggressive", "Conservative"] } },
        ],
      },
    }),
    prisma.advisorNote.count({ where: { client: { is: baseWhere } } }),
    prisma.meetingTask.count({ where: { client: { is: baseWhere } } }),
    prisma.documentVaultItem.count({ where: { client: { is: baseWhere } } }),
  ]);

  return {
    clientCount,
    activeCount,
    emailReadyCount,
    missingEmailCount: clientCount - emailReadyCount,
    holdingsCount,
    reviewCount,
    notesCount,
    taskCount,
    documentCount,
  };
}

export async function getCompatibilityClientPayload(input: {
  context: AccessContext;
  params: URLSearchParams;
}) {
  const limit = readPageSize(input.params, {
    fallback: DEFAULT_COMPAT_CLIENTS,
    maximum: MAX_COMPAT_CLIENTS,
  });
  const baseWhere = clientScopeWhere(input.context);

  const [rawClients, total, metrics] = await Promise.all([
    prisma.clientProfile.findMany({
      where: baseWhere,
      select: {
        id: true,
        userId: true,
        firmId: true,
        assignedAdvisorMembershipId: true,
        assignedAdvisorAt: true,
        assignedByUserId: true,
        fullName: true,
        email: true,
        phone: true,
        householdName: true,
        preferredContactMethod: true,
        clientType: true,
        riskProfile: true,
        liquidityNeeds: true,
        timeHorizon: true,
        objective: true,
        portfolioValue: true,
        status: true,
        notes: true,
        portalEnabled: true,
        portalInviteExpiresAt: true,
        portalOnboardingStatus: true,
        portalLastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        holdings: {
          select: HOLDING_SELECT,
          orderBy: { createdAt: "desc" },
          take: MAX_COMPAT_CHILDREN,
        },
        notesList: {
          select: NOTE_SELECT,
          orderBy: { createdAt: "desc" },
          take: MAX_COMPAT_CHILDREN,
        },
        tasks: {
          select: TASK_SELECT,
          orderBy: { createdAt: "desc" },
          take: MAX_COMPAT_CHILDREN,
        },
        reviews: {
          select: RISK_REVIEW_SELECT,
          orderBy: { createdAt: "desc" },
          take: MAX_COMPAT_CHILDREN,
        },
        documents: {
          select: DOCUMENT_SELECT,
          orderBy: { createdAt: "desc" },
          take: MAX_COMPAT_CHILDREN,
        },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit,
    }),
    prisma.clientProfile.count({ where: baseWhere }),
    compatibilityMetrics(input.context),
  ]);

  const clients = decryptClientProfiles(rawClients).map((client) => ({
    ...client,
    phone: decryptSensitiveText(client.phone) ?? null,
  }));

  return {
    clients,
    view: "compatibility-bounded",
    redacted: false,
    vault: vaultStatus(),
    metrics,
    privacy: {
      holdingsMode:
        "Security names and symbols only. Position amounts are intentionally not required.",
      amountStorage:
        "Portfolio values and allocations are optional and are not shown in the client directory.",
    },
    pagination: {
      limit,
      total,
      truncated: total > rawClients.length,
      migrationRoute: "/api/clients?mode=list",
    },
    compatibility: {
      bounded: true,
      clientLimit: MAX_COMPAT_CLIENTS,
      childCollectionLimit: MAX_COMPAT_CHILDREN,
      message:
        "This bounded payload preserves legacy screens. New screens should use mode=list and on-demand section routes.",
    },
  };
}

export const clientRepositoryLimits = Object.freeze({
  compatibilityClients: MAX_COMPAT_CLIENTS,
  compatibilityChildren: MAX_COMPAT_CHILDREN,
  defaultSectionPageSize: DEFAULT_SECTION_PAGE_SIZE,
  maximumSectionPageSize: MAX_SECTION_PAGE_SIZE,
});