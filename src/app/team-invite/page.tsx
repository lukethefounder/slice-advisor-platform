import type { Metadata } from "next";
import InviteAcceptance from "@/components/team/invite-acceptance";
export const metadata: Metadata = { title: "Join your team | Slice", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function TeamInvitePage() { return <InviteAcceptance />; }
