"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, LoaderCircle, RefreshCw, Search, ShieldCheck, Users } from "lucide-react";
import { intelligenceFetch, isAbortError } from "@/lib/intelligence/client";
import { TEAM_INVITE_ROLES, type InvitationResult, type TeamInvite, type TeamOverview } from "@/lib/team/contracts";
import InviteComposer, { InvitationReceipt, RoleVerification } from "./invite-composer";
import css from "./team.module.css";

export default function TeamManager() {
  const params = useSearchParams(), firmId = params.get("firmId") || "";
  const [data, setData] = useState<TeamOverview | null>(null), [error, setError] = useState(""), [search, setSearch] = useState(""), [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"members" | "invites">("members");
  const [pending, setPending] = useState<{ invite: TeamInvite; action: "renew" | "revoke" } | null>(null);
  const [actionBusy, setActionBusy] = useState(false), [password, setPassword] = useState(""), [factor, setFactor] = useState(""), [delivery, setDelivery] = useState<"link" | "email">("link");
  const [issued, setIssued] = useState<InvitationResult | null>(null), [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null), actionController = useRef<AbortController | null>(null), scope = useRef(firmId);
  const load = useCallback(async (query = "") => {
    controller.current?.abort(); const request = new AbortController(); controller.current = request; setBusy(true);
    try {
      const queryString = new URLSearchParams({ ...(firmId ? { firmId } : {}), ...(query ? { q: query } : {}) });
      const result = await intelligenceFetch<TeamOverview>(`/api/team-invites?${queryString}`, { signal: request.signal }, { retries: 0 });
      if (request.signal.aborted || controller.current !== request) return;
      setData(result); setError("");
    } catch (caught) { if (!request.signal.aborted && controller.current === request && !isAbortError(caught)) setError(caught instanceof Error ? caught.message : "Your team could not be loaded."); }
    finally { if (!request.signal.aborted && controller.current === request) setBusy(false); }
  }, [firmId]);
  useEffect(() => {
    if (scope.current !== firmId) { scope.current = firmId; setData(null); setIssued(null); setPending(null); setPassword(""); setFactor(""); setMessage(""); actionController.current?.abort(); setActionBusy(false); }
    const timer = window.setTimeout(() => void load(search), search ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.current?.abort(); };
  }, [firmId, load, search]);
  useEffect(() => () => { controller.current?.abort(); actionController.current?.abort(); }, []);
  const elevated = pending?.action === "renew" && TEAM_INVITE_ROLES.find(row => row.role === pending.invite.role)?.elevated;
  async function applyAction() {
    if (!pending || !data || actionBusy) return;
    const request = new AbortController(); actionController.current = request; const actionScope = scope.current;
    setActionBusy(true); setError(""); setMessage("");
    try {
      const result = await intelligenceFetch<InvitationResult | { ok: true; revoked: true; message: string }>("/api/team-invites", { method: "POST", signal: request.signal,
        body: JSON.stringify({ action: pending.action, firmId: data.firm.id, inviteId: pending.invite.id, delivery, ...(elevated ? { currentPassword: password, factorCode: factor } : {}) }) }, { retries: 0 });
      if (request.signal.aborted || scope.current !== actionScope) return;
      if ("invite" in result) setIssued(result); else { setIssued(null); setMessage(result.message); }
      setPending(null); setPassword(""); setFactor(""); await load(search);
    } catch (caught) { if (!request.signal.aborted && scope.current === actionScope && !isAbortError(caught)) setError(caught instanceof Error ? caught.message : "The invitation could not be changed."); }
    finally { if (!request.signal.aborted && scope.current === actionScope) setActionBusy(false); }
  }
  return <main className={css.page}>
    <header className={css.hero}><p className={css.eyebrow}><Users size={14} />Slice / connected team</p><h1>Team & access.</h1><p>Bring the right people into {data?.firm.name || "your workspace"}. Choose their access, share an invitation, and see who has joined.</p><div className={css.heroLinks}><Link href="/workspace"><ArrowLeft size={12} style={{ display: "inline", marginRight: 5 }} />Workspace</Link><Link href="/security">Security center</Link><Link href="/workspace/settings?tab=team">Account settings</Link></div></header>
    {error && <p className={css.error} role="alert">{error}</p>}{message && <p className={css.notice} role="status">{message}</p>}
    <div className={css.grid}><section className={css.panel} aria-label="Team directory">
      <h2>{data?.firm.name || "Your firm"}</h2><p className={css.muted}>Members and invitation history are read from your firm. Invitations never transfer ownership.</p>
      <div className={css.toolbar}><label className={css.search}><Search size={16} aria-hidden="true" /><input aria-label="Search team by name or email" placeholder="Find a colleague or invitation" value={search} maxLength={120} onChange={event => setSearch(event.target.value)} /></label><button type="button" className={css.secondary} disabled={busy} onClick={() => void load(search)}><RefreshCw size={14} className={busy ? css.spinner : undefined} />Refresh</button></div>
      <div className={css.tabs} aria-label="Team view"><button type="button" aria-pressed={tab === "members"} onClick={() => setTab("members")}>Members</button>{data?.canInvite && <button type="button" aria-pressed={tab === "invites"} onClick={() => setTab("invites")}>Invitations</button>}</div>
      {!data && busy ? <p className={css.empty} role="status"><LoaderCircle size={22} className={css.spinner} /> Loading your team…</p> : <div className={css.list}>
        {tab === "members" ? data?.members.map(member => <article className={css.row} key={member.id}><span className={css.avatar} aria-hidden="true">{member.name.split(/\s+/).map(word => word[0]).slice(0, 2).join("").toUpperCase()}</span><div className={css.identity}><strong>{member.name}{member.userId === data.viewerId ? " · You" : ""}</strong><small>{member.email}</small></div><span className={css.tag} data-state="Active">{member.role}</span></article>) : data?.canInvite && data.invites.map(invite => <article className={css.row} key={invite.id}><div className={css.identity}><strong>{invite.email}</strong><small>{invite.role} · {invite.status === "Accepted" ? "Joined" : "Expires"} {new Date(invite.acceptedAt || invite.expiresAt).toLocaleDateString()}</small></div><span className={css.tag} data-state={invite.status}>{invite.status}</span>{["Pending", "Expired"].includes(invite.status) && <div className={css.actions}><button type="button" className={css.secondary} disabled={actionBusy} onClick={() => { setPending({ invite, action: "renew" }); setPassword(""); setFactor(""); }}>Replace link</button><button type="button" className={css.danger} disabled={actionBusy} onClick={() => setPending({ invite, action: "revoke" })}>Revoke</button></div>}</article>)}
        {data && !(tab === "members" ? data.members.length : data.invites.length) && <p className={css.empty}>{search ? "No matching records. Try another name or email." : tab === "members" ? "No active members to show." : "No invitations yet. Invite your first colleague using the form."}</p>}
      </div>}
      {data && (tab === "members" ? data.members.length : data.invites.length) >= 200 && <p className={css.muted}>Showing the latest 200 matching records. Search by name or email to find older records.</p>}
      {pending && <section className={css.pendingAction} aria-label="Confirm invitation change"><h3>{pending.action === "renew" ? "Create a replacement link" : "Revoke this invitation"}</h3><p className={css.muted}>{pending.invite.email} · {pending.invite.role}. {pending.action === "renew" ? "The previous link will stop working. The replacement expires in seven days." : "This link will no longer allow anyone to join."}</p>
        {pending.action === "renew" && <label className={css.field}><span>Delivery</span><select value={delivery} onChange={event => setDelivery(event.target.value as "link" | "email")}><option value="link">Create a link to copy</option><option value="email">Email the replacement</option></select></label>}
        {elevated && <RoleVerification password={password} factor={factor} onPassword={setPassword} onFactor={setFactor} />}
        <div className={css.actions} style={{ marginTop: 16 }}><button type="button" className={pending.action === "revoke" ? css.danger : css.button} disabled={actionBusy || (Boolean(elevated) && !password)} onClick={() => void applyAction()}>{actionBusy ? "Saving…" : pending.action === "renew" ? "Replace invitation" : "Revoke invitation"}</button><button className={css.secondary} type="button" disabled={actionBusy} onClick={() => { setPending(null); setPassword(""); setFactor(""); }}>Keep current invitation</button></div></section>}
      {issued && <InvitationReceipt result={issued} />}
    </section><aside className={css.panel}><InviteComposer key={data?.firm.id || firmId} firmId={data?.firm.id || null} canInvite={data?.canInvite ?? false} roles={data?.roles || []} onCreated={() => { setTab("invites"); void load(search); }} /><p className={css.muted} style={{ marginTop: 24 }}><ShieldCheck size={13} style={{ display: "inline", marginRight: 6 }} />New links are stored as hashes, expire in seven days, and accept one account for the invited email. Administrative roles require account verification.</p></aside></div>
  </main>;
}
