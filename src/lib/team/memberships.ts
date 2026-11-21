import "server-only";
import { permissionsForMembership, requireCurrentAccessContext } from "@/lib/access-control";
import { requireAccountReauthentication } from "@/lib/account-security/service";
import { prisma } from "@/lib/prisma";
import { normalizeTeamRole } from "./contracts";
import { guardTeamRate, teamError } from "./http";

type MemberFlags = { role: string; canAccessPortfolios: boolean; canManageProjects: boolean; canInviteMembers: boolean; canManageFirm: boolean };
const FLAGS = ["canAccessPortfolios", "canManageProjects", "canInviteMembers", "canManageFirm"] as const;

export function planMemberUpdate(current: MemberFlags, input: Record<string, unknown>) {
  const role = input.role === undefined ? current.role : normalizeTeamRole(input.role);
  if (!role) throw teamError(400, "ROLE_NOT_ALLOWED", "Select a supported team role. Ownership cannot be assigned from this panel.");
  const result = { role, canAccessPortfolios: current.canAccessPortfolios, canManageProjects: current.canManageProjects, canInviteMembers: current.canInviteMembers, canManageFirm: current.canManageFirm };
  for (const flag of FLAGS) {
    if (input[flag] !== undefined && typeof input[flag] !== "boolean") throw teamError(400, "INVALID_PERMISSION", "Access controls must be true or false.");
    if (typeof input[flag] === "boolean") result[flag] = input[flag];
  }
  return result;
}

/** Legacy member controls share the same firm lock and authority checks as invitations. */
export async function changeTeamMember(request: Request, input: Record<string, unknown>, action: "update" | "remove") {
  const firmId = typeof input.firmId === "string" ? input.firmId : undefined;
  const access = await requireCurrentAccessContext({ firmId, permission: "firm.manage", requireFirm: true });
  await guardTeamRate(request, "member-access", access.user.id, 30);
  await requireAccountReauthentication(access.user.id, input.currentPassword, input.factorCode, request);
  const id = typeof input.membershipId === "string" ? input.membershipId : "";
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Firm" WHERE "id" = ${access.firm!.id} FOR UPDATE`;
    const firm = await tx.firm.findUnique({ where: { id: access.firm!.id }, select: { platformStatus: true, createdByUserId: true } });
    if (firm?.platformStatus !== "Active") throw teamError(403, "FIRM_UNAVAILABLE", "This firm is not available for access changes.");
    const actor = access.isFounder ? null : await tx.firmMembership.findFirst({ where: { userId: access.user.id, firmId: access.firm!.id, status: "Active" } });
    const permissions = actor ? permissionsForMembership(actor) : [];
    if (!access.isFounder && (!actor || !permissions.includes("firm.manage"))) throw teamError(403, "MEMBERSHIP_REQUIRED", "Your firm management access changed. Refresh before trying again.");
    const target = await tx.firmMembership.findFirst({ where: { id, firmId: access.firm!.id, status: "Active" } });
    if (!target) throw teamError(404, "MEMBER_UNAVAILABLE", "This active member was not found in your firm.");
    if (target.role.trim().toLowerCase() === "owner" || target.userId === firm.createdByUserId) throw teamError(403, "OWNER_PROTECTED", "Firm owner access cannot be changed or removed here.");
    if (target.userId === access.user.id) throw teamError(403, "SELF_ACCESS_PROTECTED", "Ask another administrator to change your own firm access.");
    const changes = action === "update" ? planMemberUpdate(target, input) : { role: target.role, canAccessPortfolios: false, canManageProjects: false, canInviteMembers: false, canManageFirm: false };
    if (!access.isFounder && (!permissionsForMembership(target).every(permission => permissions.includes(permission)) || (action === "update" && !permissionsForMembership(changes).every(permission => permissions.includes(permission))))) throw teamError(403, "ROLE_NOT_ALLOWED", "You cannot manage or grant permissions beyond your own firm access.");
    const calendarColor = typeof input.calendarColor === "string" && /^#[A-Fa-f0-9]{6}$/.test(input.calendarColor) ? input.calendarColor : undefined;
    const updated = await tx.firmMembership.update({ where: { id: target.id }, data: { ...changes, ...(action === "remove" ? { status: "Removed" } : { calendarColor }) }, include: { user: { select: { id: true, name: true, email: true, createdAt: true, platformStatus: true } } } });
    if (action === "remove") {
      await tx.personalAdvisorBot.updateMany({ where: { userId: target.userId, firmId: access.firm!.id }, data: { status: "Paused" } });
      await tx.firmInvite.updateMany({ where: { firmId: access.firm!.id, sentByUserId: target.userId, status: "Pending" }, data: { status: "Cancelled" } });
    }
    await tx.auditLog.create({ data: { userId: access.user.id, eventType: action === "remove" ? "TEAM_MEMBER_ACCESS_REMOVED" : "TEAM_MEMBER_ACCESS_CHANGED", area: "Team access", title: action === "remove" ? "Firm membership removed" : "Firm member permissions changed", metadataJson: JSON.stringify({ firmId: access.firm!.id, membershipId: target.id, role: changes.role, permissions: changes }) } });
    return updated;
  });
}
