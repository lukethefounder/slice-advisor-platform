"use client";
import Link from "next/link";
import InviteComposer from "@/components/team/invite-composer";
import type { SentTeamInvite } from "@/lib/workspace-green-core";
import css from "@/components/team/team.module.css";
export default function WorkspaceInvitePanel({ firmId, firmName, canInvite, onInviteCreated }: {
  firmId: string | null; firmName: string; canInvite: boolean; initialInvites: SentTeamInvite[];
  onInviteCreated: (invite: SentTeamInvite) => void;
}) {
  return <section className={css.panel}>
    <InviteComposer key={firmId || "no-firm"} compact firmId={firmId} canInvite={canInvite} onCreated={result => onInviteCreated({
      id: result.invite.id, email: result.invite.email, role: result.invite.role, firmName,
      // Parent workspace caches retain metadata only. Private links stay in this component's memory.
      inviteCode: "", inviteLink: "", expiresAt: result.invite.expiresAt, createdAt: result.invite.createdAt,
      deliveryStatus: result.delivery.status === "sent" ? "sent" : result.delivery.status === "simulated" ? "simulated" : "disabled",
    })} />
    <p style={{ marginTop: 18 }}><Link href={`/workspace/team${firmId ? `?firmId=${encodeURIComponent(firmId)}` : ""}`} className={css.textLink}>Manage invitations and members →</Link></p>
  </section>;
}
