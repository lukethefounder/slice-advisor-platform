/** Public role descriptions and invitation shapes. No credentials belong here. */
export const TEAM_INVITE_ROLES = [
  { role: "Associate Advisor", label: "Advisor", detail: "Research, portfolios, and assigned client work.", elevated: false },
  { role: "Investment Analyst", label: "Analyst", detail: "Research and portfolio visibility; no team administration.", elevated: false },
  { role: "Operations Associate", label: "Operations", detail: "Shared projects and coordination; no firm administration.", elevated: false },
  { role: "Admin", label: "Firm administrator", detail: "Manage firm settings, members, and supervised client work.", elevated: true },
  { role: "Lead Advisor", label: "Lead advisor", detail: "Manage the team and supervise client assignments.", elevated: true },
  { role: "Principal Advisor", label: "Principal advisor", detail: "Firm management and supervision. Ownership is not transferred.", elevated: true },
  { role: "Senior Wealth Advisor", label: "Senior wealth advisor", detail: "Assigned client work and shared projects.", elevated: false },
  { role: "Service Advisor", label: "Service advisor", detail: "Research and assigned client service.", elevated: false },
  { role: "Portfolio Manager", label: "Portfolio manager", detail: "Portfolio research and projects; no firm administration.", elevated: false },
  { role: "Financial Planning Analyst", label: "Planning analyst", detail: "Planning research and portfolio visibility.", elevated: false },
  { role: "Paraplanner", label: "Paraplanner", detail: "Shared research and planning support.", elevated: false },
  { role: "Client Service Associate", label: "Client service associate", detail: "Assigned client information and shared workspace access.", elevated: false },
  { role: "Relationship Manager", label: "Relationship manager", detail: "Client coordination; no firm administration.", elevated: false },
  { role: "Compliance Officer", label: "Compliance officer", detail: "Supervised client and inbox review, security review, and projects.", elevated: true },
  { role: "Chief Compliance Officer", label: "Chief compliance officer", detail: "Compliance supervision and permission to invite members.", elevated: true },
  { role: "Member", label: "Workspace member", detail: "Shared workspace and assigned records; no administration.", elevated: false },
] as const;
export type TeamRole = typeof TEAM_INVITE_ROLES[number]["role"];
export type TeamInvite = {
  id: string; email: string; role: string; status: string; createdAt: string;
  expiresAt: string; acceptedAt: string | null; sentBy: string;
  inviteLink?: string; inviteCode?: string; firmName?: string;
};
export type TeamOverview = {
  ok: true; firm: { id: string; name: string }; viewerId: string;
  canInvite: boolean; canManage: boolean;
  roles: Array<typeof TEAM_INVITE_ROLES[number]>;
  members: Array<{ id: string; userId: string; name: string; email: string; role: string; joinedAt: string }>;
  invites: TeamInvite[];
};
export type InvitationResult = {
  ok: true; inviteCreated: true; invite: TeamInvite;
  emailDelivered: boolean; message: string;
  delivery: { status: "sent" | "simulated" | "failed" | "disabled" | "link-only"; provider: string; error?: string };
};
export function normalizeTeamEmail(value: unknown): string {
  if (typeof value !== "string") return "";
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@<>\u0000-\u001f]+@[^\s@<>\u0000-\u001f]+\.[^\s@<>\u0000-\u001f]+$/.test(email) ? email : "";
}
export function normalizeTeamRole(value: unknown): TeamRole | null {
  if (typeof value !== "string") return null;
  const aliases: Record<string, TeamRole> = { advisor: "Associate Advisor", analyst: "Investment Analyst", ops: "Operations Associate", operations: "Operations Associate", "firm admin": "Admin", principal: "Principal Advisor", "client service": "Client Service Associate" };
  return TEAM_INVITE_ROLES.find(item => item.role.toLowerCase() === value.trim().toLowerCase())?.role ?? aliases[value.trim().toLowerCase()] ?? null;
}
export function teamRolePermissions(role: TeamRole) {
  const management = ["Admin", "Lead Advisor", "Principal Advisor"].includes(role);
  return {
    canAccessPortfolios: !["Operations Associate", "Member", "Client Service Associate", "Relationship Manager"].includes(role),
    canManageProjects: management || ["Senior Wealth Advisor", "Portfolio Manager", "Operations Associate", "Compliance Officer", "Chief Compliance Officer"].includes(role),
    canInviteMembers: management || role === "Chief Compliance Officer",
    canManageFirm: management,
  };
}
