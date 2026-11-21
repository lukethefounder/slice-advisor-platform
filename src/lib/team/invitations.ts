import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hasFirmPermission, permissionsForMembership, requireCurrentAccessContext, type AccessContext } from "@/lib/access-control";
import { isFounderEmail } from "@/lib/founder-access";
import { accountHasMfa, requireAccountReauthentication } from "@/lib/account-security/service";
import { sendEmail } from "@/lib/integrations/email";
import { recordAuditLog } from "@/lib/audit";
import { TEAM_INVITE_ROLES, normalizeTeamEmail, normalizeTeamRole, teamRolePermissions, type InvitationResult, type TeamInvite, type TeamOverview, type TeamRole } from "./contracts";
import { guardTeamRate, teamError, teamRequestIp } from "./http";

const LIFETIME = 7 * 24 * 60 * 60_000;
const PUBLIC_USER = { id: true, name: true, email: true, createdAt: true, platformStatus: true } as const;
type InviteRow = { id: string; firmId: string; email: string; role: string; status: string; inviteCode: string; expiresAt: Date | null; createdAt: Date; acceptedAt: Date | null; sentByUserId: string; sentBy?: { name: string }; };

export function invitationToken(value: unknown) {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!/^[A-F0-9]{24,64}$/.test(code)) throw teamError(400, "INVALID_INVITATION", "This invitation link is invalid. Ask the sender for a new link.");
  return code;
}
export function invitationHash(code: string) { return `sha256:${createHash("sha256").update(invitationToken(code)).digest("hex")}`; }
export function invitationExpiry(invite: Pick<InviteRow, "createdAt" | "expiresAt">) { return invite.expiresAt ?? new Date(invite.createdAt.getTime() + LIFETIME); }
export function publicInvitation(invite: InviteRow): TeamInvite {
  const expires = invitationExpiry(invite);
  return { id: invite.id, email: invite.email, role: invite.role,
    status: invite.status === "Pending" && expires.getTime() <= Date.now() ? "Expired" : invite.status,
    createdAt: invite.createdAt.toISOString(), expiresAt: expires.toISOString(), acceptedAt: invite.acceptedAt?.toISOString() ?? null, sentBy: invite.sentBy?.name ?? "Firm member" };
}
export function invitationOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  let origin: URL;
  try { origin = configured ? new URL(configured.includes("://") ? configured : `https://${configured}`) : new URL(request.url); }
  catch { throw teamError(503, "APP_URL_REQUIRED", "Set the application's public HTTPS URL before creating invitation links."); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if ((!configured && !local) || origin.username || origin.password || origin.search || origin.hash || !["https:", ...(local ? ["http:"] : [])].includes(origin.protocol)) {
    throw teamError(503, "APP_URL_REQUIRED", "Set the application's public HTTPS URL before creating invitation links.");
  }
  return origin.origin;
}
export function canGrantTeamRole(access: Pick<AccessContext, "isFounder" | "permissions">, role: TeamRole) {
  if (!hasFirmPermission(access, "members.invite")) return false;
  return access.isFounder || permissionsForMembership({ role, ...teamRolePermissions(role) }).every(permission => access.permissions.includes(permission));
}
function assertGrant(access: Pick<AccessContext, "isFounder" | "permissions">, role: TeamRole) {
  if (!canGrantTeamRole(access, role)) throw teamError(403, "ROLE_NOT_ALLOWED", "Your account cannot grant this role. Ask a firm administrator to create the invitation.");
}
function assertPending(invite: (InviteRow & { firm?: { platformStatus: string } }) | null) {
  if (!invite || invite.status !== "Pending") throw teamError(404, "INVITATION_UNAVAILABLE", "This invitation is unavailable or has already been used.");
  if (invitationExpiry(invite).getTime() <= Date.now()) throw teamError(410, "INVITATION_EXPIRED", "This invitation has expired. Ask the sender for a new link.");
  if (invite.firm && invite.firm.platformStatus !== "Active") throw teamError(403, "FIRM_UNAVAILABLE", "This firm is not accepting new members.");
  return invite;
}
export async function lookupInvitation(rawCode: unknown) {
  const code = invitationToken(rawCode);
  const invite = await prisma.firmInvite.findFirst({ where: { inviteCode: { in: [invitationHash(code), code] } }, include: { firm: true, sentBy: { select: { name: true } } } });
  assertPending(invite);
  return invite!;
}
export async function publicInvitationLookup(request: Request, rawCode: unknown) {
  await guardTeamRate(request, "lookup", teamRequestIp(request), 60);
  const invite = await lookupInvitation(rawCode);
  const user = await prisma.user.findUnique({ where: { email: invite.email.toLowerCase() }, select: { id: true } });
  const [local, domain] = invite.email.split("@");
  return { ok: true, invite: { firmName: invite.firm.name, role: invite.role,
    emailMasked: `${local.slice(0, 2)}***@${domain}`, inviterName: invite.sentBy.name,
    expiresAt: invitationExpiry(invite).toISOString(), existingAccount: Boolean(user),
    mfaRequired: user ? await accountHasMfa(user.id) : false } };
}
export async function loadTeamOverview(firmId?: string, search = ""): Promise<TeamOverview> {
  const access = await requireCurrentAccessContext({ firmId, requireFirm: true });
  const canInvite = hasFirmPermission(access, "members.invite");
  const query = search.trim().slice(0, 120);
  const [members, invites] = await Promise.all([
    prisma.firmMembership.findMany({ where: { firmId: access.firm!.id, status: "Active", ...(query ? { user: { OR: [{ name: { contains: query, mode: "insensitive" as const } }, { email: { contains: query, mode: "insensitive" as const } }] } } : {}) },
      select: { id: true, userId: true, role: true, createdAt: true, user: { select: PUBLIC_USER } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 200 }),
    canInvite ? prisma.firmInvite.findMany({ where: { firmId: access.firm!.id, ...(query ? { email: { contains: query, mode: "insensitive" as const } } : {}) },
      include: { sentBy: { select: { name: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 200 }) : [],
  ]);
  return { ok: true, firm: { id: access.firm!.id, name: access.firm!.name }, viewerId: access.user.id,
    canInvite, canManage: hasFirmPermission(access, "firm.manage"), roles: TEAM_INVITE_ROLES.filter(row => canGrantTeamRole(access, row.role)),
    members: members.map(row => ({ id: row.id, userId: row.userId, name: row.user.name, email: row.user.email, role: row.role, joinedAt: row.createdAt.toISOString() })), invites: invites.map(publicInvitation) };
}
function emailCopy(firm: string, name: string, role: string, link: string, expires: Date) {
  const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
  const subject = `${name} invited you to ${firm} on Slice`;
  const text = `${name} invited you to join ${firm} as ${role}.\n\nAccept your invitation: ${link}\n\nThis link is intended for your email address, can be used once, and expires ${expires.toISOString()}. If you already use Slice, use your existing password and authenticator if enabled.`;
  return { subject, text, html: `<div style="background:#050a12;color:#dcecf8;padding:32px;font-family:Arial,sans-serif"><p style="color:#70e3d2;letter-spacing:3px">SLICE / TEAM INVITATION</p><h1>Join ${escape(firm)}</h1><p>${escape(name)} invited you as ${escape(role)}.</p><p><a href="${escape(link)}" style="display:inline-block;background:#70e3d2;color:#042d2b;padding:15px 22px;border-radius:12px;font-weight:bold;text-decoration:none">Accept invitation</a></p><p>This invitation is bound to your email and expires ${escape(expires.toISOString())}.</p><p>Already a member of Slice? Use your existing password and authenticator if enabled.</p></div>` };
}
/** All create/renew/revoke entry points use this permission and transaction boundary. */
export async function manageTeamInvitation(request: Request, input: Record<string, unknown>): Promise<InvitationResult | { ok: true; revoked: true; message: string }> {
  const firmId = typeof input.firmId === "string" ? input.firmId.trim() : undefined;
  const access = await requireCurrentAccessContext({ firmId, permission: "members.invite", requireFirm: true });
  await guardTeamRate(request, "manage", `${access.user.id}:${access.firm!.id}`, 60);
  const action = input.action === "renew" || input.action === "resend" || input.action === "retry" ? "renew" : input.action === "revoke" ? "revoke" : input.action === "create" || input.action === undefined ? "create" : null;
  if (!action) throw teamError(400, "INVALID_ACTION", "Choose create, renew, or revoke.");
  const id = typeof input.inviteId === "string" ? input.inviteId : "";
  const previous = action !== "create" ? await prisma.firmInvite.findFirst({ where: { id, firmId: access.firm!.id } }) : null;
  if (action !== "create" && (!previous || !["Pending", "Expired"].includes(previous.status))) throw teamError(404, "INVITATION_UNAVAILABLE", "The invitation can no longer be changed. Refresh the team list.");
  if (action === "revoke") {
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Firm" WHERE "id" = ${access.firm!.id} FOR UPDATE`;
      const firm = await tx.firm.findUnique({ where: { id: access.firm!.id }, select: { platformStatus: true } });
      const actor = access.isFounder ? null : await tx.firmMembership.findFirst({ where: { userId: access.user.id, firmId: access.firm!.id, status: "Active" } });
      if (firm?.platformStatus !== "Active" || (!access.isFounder && (!actor || !permissionsForMembership(actor).includes("members.invite")))) throw teamError(403, "MEMBERSHIP_REQUIRED", "Your firm access changed. Refresh before changing an invitation.");
      const changed = await tx.firmInvite.updateMany({ where: { id, firmId: access.firm!.id, status: { in: ["Pending", "Expired"] } }, data: { status: "Cancelled" } });
      if (changed.count !== 1) throw teamError(409, "INVITATION_CHANGED", "The invitation changed. Refresh the team list.");
      await tx.auditLog.create({ data: { userId: access.user.id, eventType: "TEAM_INVITATION_REVOKED", area: "Team access", title: "Team invitation revoked", metadataJson: JSON.stringify({ firmId: access.firm!.id, invitationId: id }) } });
    });
    return { ok: true, revoked: true, message: "Invitation revoked. Its link no longer grants access." };
  }
  const email = normalizeTeamEmail(previous?.email ?? input.email), role = normalizeTeamRole(previous?.role ?? input.role ?? "Associate Advisor");
  if (!email || !role) throw teamError(400, "INVALID_INVITATION", "Enter a valid email and select an available role.");
  if (email === access.user.email.toLowerCase()) throw teamError(400, "SELF_INVITATION", "This account already belongs to your workspace.");
  assertGrant(access, role);
  if (TEAM_INVITE_ROLES.find(row => row.role === role)?.elevated) await requireAccountReauthentication(access.user.id, input.currentPassword, input.factorCode, request);
  const origin = invitationOrigin(request);
  const code = randomBytes(32).toString("hex").toUpperCase(), expiresAt = new Date(Date.now() + LIFETIME);
  const invite = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Firm" WHERE "id" = ${access.firm!.id} FOR UPDATE`;
    const firm = await tx.firm.findUnique({ where: { id: access.firm!.id }, select: { platformStatus: true } });
    if (firm?.platformStatus !== "Active") throw teamError(403, "FIRM_UNAVAILABLE", "This firm is not accepting invitations.");
    if (!access.isFounder) {
      const actor = await tx.firmMembership.findFirst({ where: { userId: access.user.id, firmId: access.firm!.id, status: "Active" } });
      if (!actor) throw teamError(403, "MEMBERSHIP_REQUIRED", "Your firm access changed. Refresh before inviting someone.");
      assertGrant({ isFounder: false, permissions: permissionsForMembership(actor) }, role);
    }
    const member = await tx.firmMembership.findFirst({ where: { firmId: access.firm!.id, user: { email } }, select: { id: true } });
    if (member) throw teamError(409, "MEMBER_EXISTS", "This email already has a firm membership. An administrator can review its access.");
    if (previous) {
      const claimed = await tx.firmInvite.updateMany({ where: { id: previous.id, firmId: access.firm!.id, inviteCode: previous.inviteCode, status: { in: ["Pending", "Expired"] } }, data: { status: "Replaced" } });
      if (claimed.count !== 1) throw teamError(409, "INVITATION_CHANGED", "The invitation changed. Refresh before renewing it.");
    } else {
      const pending = await tx.firmInvite.findFirst({ where: { firmId: access.firm!.id, email, status: "Pending" } });
      if (pending && invitationExpiry(pending).getTime() > Date.now()) throw teamError(409, "INVITATION_EXISTS", "An invitation is already pending for this email. Renew its link from the invitation list if needed.");
    }
    await tx.firmInvite.updateMany({ where: { firmId: access.firm!.id, email, status: "Pending" }, data: { status: "Replaced" } });
    const result = await tx.firmInvite.create({ data: { firmId: access.firm!.id, email, role, inviteCode: invitationHash(code), status: "Pending", expiresAt, sentByUserId: access.user.id } });
    await tx.auditLog.create({ data: { userId: access.user.id, eventType: previous ? "TEAM_INVITATION_RENEWED" : "TEAM_INVITATION_CREATED", area: "Team access", title: previous ? "Team invitation renewed" : "Team invitation created", detail: `${email} invited as ${role}.`, metadataJson: JSON.stringify({ firmId: access.firm!.id, invitationId: result.id, role }) } });
    return result;
  });
  const inviteLink = `${origin}/team-invite?code=${code}`;
  const copy = emailCopy(access.firm!.name, access.user.name, role, inviteLink, expiresAt);
  let delivery: InvitationResult["delivery"] = { status: "link-only", provider: "Share link" };
  if (input.delivery === "email") {
    try {
      const result = await sendEmail({ to: email, from: process.env.TEAM_INVITES_FROM_EMAIL || undefined, ...copy, idempotencyKey: `firm-invite:${invite.id}` });
      delivery = { status: result.status, provider: result.provider, ...(result.error ? { error: "Email delivery was not confirmed. You can copy the invitation link." } : {}) };
    } catch { delivery = { status: "failed", provider: "Email", error: "Email delivery was not confirmed. You can copy the invitation link." }; }
    // Creation was audited atomically above. A supplementary delivery-log failure
    // must not discard the only response containing the newly issued private link.
    await recordAuditLog({ userId: access.user.id, eventType: "TEAM_INVITATION_DELIVERY", area: "Team access", title: delivery.status === "sent" ? "Invitation accepted by email provider" : "Invitation available to share", metadata: { firmId: access.firm!.id, invitationId: invite.id, deliveryStatus: delivery.status }, request }).catch(() => undefined);
  }
  return { ok: true, inviteCreated: true, invite: { ...publicInvitation(invite), firmName: access.firm!.name, sentBy: access.user.name, inviteCode: code, inviteLink },
    emailDelivered: delivery.status === "sent", delivery,
    message: delivery.status === "sent" ? `Invitation submitted to the email provider for ${email}.` : delivery.status === "link-only" ? "Invitation ready. Copy its private link and share it with the intended colleague." : "Invitation created. Email delivery was not confirmed; copy the private link to share it." };
}

/** The recipient and status are checked again while the firm row is locked.
 * Both anonymous signup and legacy signed-in acceptance use this same boundary. */
export async function acceptTeamInvitation(input: { code: string; userId?: string; expectedPasswordHash?: string; newAccount?: { name: string; passwordHash: string }; request: Request }) {
  const invite = await lookupInvitation(input.code), role = normalizeTeamRole(invite.role);
  if (!role) throw teamError(422, "UNSUPPORTED_INVITATION_ROLE", "Ask an administrator to issue a new invitation with a supported role.");
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Firm" WHERE "id" = ${invite.firmId} FOR UPDATE`;
    const current = await tx.firmInvite.findUnique({ where: { id: invite.id }, include: { firm: true } });
    assertPending(current);
    if (!current || current.inviteCode !== invite.inviteCode || current.role !== invite.role || current.email !== invite.email) throw teamError(409, "INVITATION_CHANGED", "This invitation was replaced. Use the latest link.");
    const sender = await tx.user.findUnique({ where: { id: current.sentByUserId }, select: PUBLIC_USER });
    const senderMembership = await tx.firmMembership.findFirst({ where: { userId: current.sentByUserId, firmId: current.firmId, status: "Active" } });
    if (!sender || sender.platformStatus !== "Active" || (!isFounderEmail(sender.email) && (!senderMembership || !canGrantTeamRole({ isFounder: false, permissions: permissionsForMembership(senderMembership) }, role)))) {
      throw teamError(403, "INVITER_ACCESS_CHANGED", "The sender can no longer grant this access. Ask a current administrator for a new invitation.");
    }
    if (input.userId && input.expectedPasswordHash) await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${input.userId} FOR UPDATE`;
    let user = input.userId ? await tx.user.findUnique({ where: { id: input.userId } }) : null;
    if (input.userId && (!user || user.platformStatus !== "Active" || user.email.toLowerCase() !== current.email.toLowerCase())) throw teamError(403, "INVITATION_RECIPIENT_MISMATCH", "Sign in with the email address that received this invitation.");
    if (user && input.expectedPasswordHash && user.passwordHash !== input.expectedPasswordHash) throw teamError(401, "ACCOUNT_CREDENTIALS_CHANGED", "Account credentials changed. Enter your current credentials to accept the invitation.");
    if (!user) {
      if (!input.newAccount) throw teamError(401, "INVITED_ACCOUNT_REQUIRED", "Sign in or finish account setup to accept this invitation.");
      if (isFounderEmail(current.email)) throw teamError(403, "RESERVED_ACCOUNT", "Founder accounts cannot be created through a team invitation.");
      if (await tx.user.findUnique({ where: { email: current.email } })) throw teamError(409, "ACCOUNT_EXISTS", "This email now has a Slice account. Use its existing password to join.");
      user = await tx.user.create({ data: { name: input.newAccount.name, email: current.email, passwordHash: input.newAccount.passwordHash, platformStatus: "Active" } });
    }
    if (await tx.firmMembership.findUnique({ where: { firmId_userId: { firmId: current.firmId, userId: user.id } } })) throw teamError(409, "MEMBER_EXISTS", "Your account already has a membership in this firm. Contact an administrator to review its access.");
    const claimed = await tx.firmInvite.updateMany({ where: { id: current.id, inviteCode: current.inviteCode, status: "Pending" }, data: { status: "Accepted", acceptedAt: new Date() } });
    if (claimed.count !== 1) throw teamError(409, "INVITATION_USED", "This invitation has already been used or revoked.");
    const membership = await tx.firmMembership.create({ data: { firmId: current.firmId, userId: user.id, role, status: "Active", calendarColor: "#70e3d2", ...teamRolePermissions(role) } });
    await tx.userSecuritySetting.upsert({ where: { userId: user.id }, update: { advisorModeEnabled: true }, create: { userId: user.id, advisorModeEnabled: true, requireReauthForSensitiveActions: true, alertOnNewLogin: true, sessionTimeoutMinutes: 720 } });
    if (!(await tx.namedWatchlist.findFirst({ where: { userId: user.id }, select: { id: true } }))) await tx.namedWatchlist.create({ data: { userId: user.id, name: "Main Watchlist", description: "Your selected securities. No placeholder market observations.", focus: "General", riskLevel: "Mixed" } });
    await tx.auditLog.create({ data: { userId: user.id, eventType: "TEAM_INVITATION_ACCEPTED", area: "Team access", title: "Joined a firm by invitation", detail: `Joined ${current.firm.name} as ${role}.`, metadataJson: JSON.stringify({ firmId: current.firmId, invitationId: current.id, role }) } });
    return { user, membership, firm: { id: current.firm.id, name: current.firm.name } };
  });
}
