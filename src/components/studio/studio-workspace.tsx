"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Sparkles, Plus, PanelLeft, Archive, ShieldCheck, FileText, ArrowUp, Square, Mic, X, RefreshCw, Link2, Copy, Volume2, Settings2, Network, PenLine, FlaskConical, ArrowUpRight } from "lucide-react";
import type { ChatRequest, ProviderHealth, ResearchSelection, StudioBootstrap, StudioMessage, StudioMode, StudioThread, ThreadSummary } from "@/lib/studio/contracts";
import { STUDIO_LIMITS } from "@/lib/studio/contracts";
import { studioJson, consumeStudioStream } from "@/lib/studio/client";
import { useWorkspaceSession } from "@/components/workspace/premium/session";
import MessageContent from "./message-content";
import { useDictation } from "./use-dictation";
import css from "./studio.module.css";
import MarketEvidenceCard from "@/components/market-pulse/market-evidence-card";
import MarketConnectionPanel from "@/components/market-pulse/market-connection-panel";
import { symbols as validateSymbols } from "@/lib/market-evidence/core";
import { Activity } from "lucide-react";
const HORIZONS = ["5-30m", "intraday", "1d", "2-5d", "1-4w", "1-3m", "3-12m", "1-3y"];
const STARTERS = [
    { title: "Read the market", detail: "Explain selected Alpha Vantage observations.", prompt: "Summarize the selected market observations. Quote their timestamps, identify any stale or delayed inputs, and explain what the data does and does not tell us. Do not invent forecasts.", Icon: Network },
    { title: "Shape a client message", detail: "Start a thoughtful, review-ready draft.", prompt: "Draft a calm client message explaining how we review portfolio risk. Use no current market figures or client-specific facts. Mark any details I need to supply.", Icon: PenLine },
    { title: "Challenge a strategy", detail: "Surface assumptions before testing them.", prompt: "Help me evaluate a strategy idea before I test it. Ask about the investment universe, historical period, entry and exit rules, costs, risks, and benchmark.", Icon: FlaskConical },
    { title: "Plan my next step", detail: "Turn a question into a clear checklist.", prompt: "Help me prepare a focused advisor workflow for today. Ask me for my priorities; do not assume access to client records or task lists.", Icon: Sparkles },
] as const;
const HEALTH_LABELS: Record<ProviderHealth["state"], string> = { missing: "Setup required", unverified: "Not recently tested", verified: "Connection verified", invalid: "Credential rejected", permission: "Access restricted", quota: "Quota unavailable", "rate-limited": "Rate limited", timeout: "Test timed out", unavailable: "Connection issue", "model-unavailable": "Model unavailable" };
function time(value: string | null | undefined) { if (!value)
    return "Not yet checked"; const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Time unavailable"; }
export function StudioOrb({ active = false, small = false }: {
    active?: boolean;
    small?: boolean;
}) { return <span className={`${css.orb} ${active ? css.orbActive : ""} ${small ? css.orbSmall : ""}`} aria-hidden="true"/>; }
export function StudioWelcome({ onPrompt, disabled = false }: {
    onPrompt: (value: string) => void;
    disabled?: boolean;
}) { return <div className={css.welcome}><div className={css.orbWrap}><div className={css.orbHalo}/><StudioOrb /></div><div className={css.welcomeEyebrow}>Slice intelligence, in conversation</div><h1>A little clarity.<br />A world of possibility.</h1><p>Your space to understand research, sharpen an idea, and shape what comes next. Thoughtful assistance. Your judgment.</p><div className={css.prompts}>{STARTERS.map(s => <button className={css.prompt} key={s.title} disabled={disabled} onClick={() => onPrompt(s.prompt)}><s.Icon /><strong>{s.title}</strong><span>{s.detail}</span></button>)}</div></div>; }
export default function StudioWorkspace() {
    const session = useWorkspaceSession();
    const [autoEvidence, setAutoEvidence] = useState(true);
    const [marketEnabled, setMarketEnabled] = useState(false), [marketSymbols, setMarketSymbols] = useState(""), [marketNews, setMarketNews] = useState(true), [streamStatus, setStreamStatus] = useState("");
    const [bootstrap, setBootstrap] = useState<StudioBootstrap | null>(null), [threads, setThreads] = useState<ThreadSummary[]>([]), [nextBefore, setNextBefore] = useState<string | null>(null), [thread, setThread] = useState<StudioThread | null>(null), [messages, setMessages] = useState<StudioMessage[]>([]);
    const [draft, setDraft] = useState(""), [mode, setMode] = useState<StudioMode>("balanced"), [loading, setLoading] = useState(false), [working, setWorking] = useState(false), [testing, setTesting] = useState(false), [error, setError] = useState(""), [toast, setToast] = useState(""), [historyOpen, setHistoryOpen] = useState(false), [connectionOpen, setConnectionOpen] = useState(false), [confirmTest, setConfirmTest] = useState(false), [researchOpen, setResearchOpen] = useState(false), [research, setResearch] = useState<ResearchSelection | null>(null), [selectedResearch, setSelectedResearch] = useState(""), [horizon, setHorizon] = useState("2-5d"), [voiceIntro, setVoiceIntro] = useState(false), [voiceApproved, setVoiceApproved] = useState(false), [archiveId, setArchiveId] = useState<string | null>(null), [speaking, setSpeaking] = useState<string | null>(null), [canSpeak, setCanSpeak] = useState(false), [online, setOnline] = useState(true), [showJump, setShowJump] = useState(false);
    const mounted = useRef(true), stream = useRef<AbortController | null>(null), loadingController = useRef<AbortController | null>(null), loadSequence = useRef(0), flush = useRef<ReturnType<typeof setTimeout> | null>(null), nearBottom = useRef(true), end = useRef<HTMLDivElement>(null), composer = useRef<HTMLTextAreaElement>(null);
    const dictation = useDictation(t => { setDraft(d => (d ? d + "\n" : "") + t); setToast("Dictation added. Review it before sending."); composer.current?.focus(); }, setError);
    const busy = working || testing || loading || dictation.state !== "idle";
    const load = useCallback(async (id?: string, append = false, before?: string) => {
        const serial = ++loadSequence.current;
        loadingController.current?.abort();
        const c = new AbortController();
        loadingController.current = c;
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (id)
                params.set("threadId", id);
            if (before)
                params.set("before", before);
            const data = await studioJson<StudioBootstrap>(`/api/ai-studio?${params}`, { signal: c.signal });
            if (!mounted.current || serial !== loadSequence.current)
                return;
            setBootstrap(data);
            setMarketSymbols(current => current || data.marketDefaults?.join(", ") || "SPY");
            setNextBefore(data.nextBefore);
            setThreads(prev => append ? [...prev, ...data.threads.filter(t => !prev.some(x => x.id === t.id))] : data.threads);
            if (id && data.selected) {
                setThread(data.selected);
                setMessages(data.selected.messages);
                setHistoryOpen(false);
                setResearch(null);
                setDraft("");
                nearBottom.current = true;
            }
        }
        catch (e) {
            if (mounted.current && serial === loadSequence.current && !(e instanceof Error && e.name === "AbortError"))
                setError(e instanceof Error ? e.message : "Unable to load saved conversations.");
        }
        finally {
            if (mounted.current && serial === loadSequence.current)
                setLoading(false);
        }
    }, []);
    useEffect(() => {
        mounted.current = true;
        setOnline(navigator.onLine);
        setCanSpeak("speechSynthesis" in window);
        const update = () => setOnline(navigator.onLine);
        const visibility = () => { if (document.hidden) {
            window.speechSynthesis?.cancel();
            setSpeaking(null);
        } };
        window.addEventListener("online", update);
        window.addEventListener("offline", update);
        document.addEventListener("visibilitychange", visibility);
        const prompt = new URLSearchParams(window.location.search).get("prompt");
        if (prompt)
            setDraft(prompt.slice(0, STUDIO_LIMITS.promptCharacters));
        return () => { mounted.current = false; loadSequence.current++; loadingController.current?.abort(); stream.current?.abort(); if (flush.current)
            clearTimeout(flush.current); window.speechSynthesis?.cancel(); window.removeEventListener("online", update); window.removeEventListener("offline", update); document.removeEventListener("visibilitychange", visibility); };
    }, []);
    useEffect(() => { stream.current?.abort(); loadingController.current?.abort(); setBootstrap(null); setMessages([]); setThread(null); setThreads([]); setResearch(null); setDraft(""); setError(""); setVoiceApproved(false); setMarketEnabled(false); setMarketSymbols(""); if (session.user) {
        const params = new URLSearchParams(window.location.search);
        setDraft((params.get("prompt") || "").slice(0, STUDIO_LIMITS.promptCharacters));
        const requestedSymbol = params.get("marketSymbol");
        if (requestedSymbol) { try { const list = validateSymbols(requestedSymbol.split(","), 3); setMarketSymbols(list.join(", ")); setMarketEnabled(true); } catch { /* Ignore invalid URL selections. */ } }
        void load(params.get("threadId") || undefined);
    } }, [session.user?.id, session.firm?.id, load]);
    useEffect(() => { const scroll = () => { nearBottom.current = document.documentElement.scrollHeight - window.scrollY - window.innerHeight < 330; setShowJump(!nearBottom.current); }; window.addEventListener("scroll", scroll, { passive: true }); return () => window.removeEventListener("scroll", scroll); }, []);
    useEffect(() => { if (nearBottom.current && messages.length)
        end.current?.scrollIntoView({ block: "end", behavior: "auto" }); }, [messages]);
    useEffect(() => { if (!toast)
        return; const t = setTimeout(() => setToast(""), 4000); return () => clearTimeout(t); }, [toast]);
    function newChat() { if (busy)
        return; window.speechSynthesis?.cancel(); setSpeaking(null); setThread(null); setMessages([]); setDraft(""); setResearch(null); setError(""); setHistoryOpen(false); composer.current?.focus(); }
    async function send() {
        const prompt = draft.trim();
        if (!prompt || busy || !online)
            return;
        if (prompt.length > STUDIO_LIMITS.promptCharacters) {
            setError("Keep each message within 8,000 characters.");
            return;
        }
        if (!bootstrap?.health.configured) {
            setConnectionOpen(true);
            setError("Configure the server AI connection before sending.");
            return;
        }
        let market: ChatRequest["market"] = null;
        if (marketEnabled) { try { market = { symbols: validateSymbols(marketSymbols.split(/[\s,]+/).filter(Boolean), 3), news: marketNews }; } catch { setError("Enter 1–3 exact ticker symbols in Market evidence, for example AAPL, MSFT."); return; } }
        setStreamStatus(market ? "Retrieving Alpha Vantage observations…" : "Considering your request…");
        setWorking(true);
        setError("");
        window.speechSynthesis?.cancel();
        setSpeaking(null);
        nearBottom.current = true;
        const c = new AbortController();
        stream.current = c;
        let assistantId = "", answer = "", started = false, failed = false;
        const paint = () => { flush.current = null; if (mounted.current && assistantId)
            setMessages(list => list.map(m => m.id === assistantId ? { ...m, text: answer } : m)); };
        try {
            const request: ChatRequest = { prompt, threadId: thread?.id, requestKey: crypto.randomUUID(), mode, research, market, evidenceMode: autoEvidence ? "auto" : marketEnabled ? "selected" : "off" };
            const response = await fetch("/api/ai-studio/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request), signal: AbortSignal.any([c.signal, AbortSignal.timeout(115000)]) });
            await consumeStudioStream(response, e => {
                if (!mounted.current)
                    return;
                if (e.type === "start") {
                    started = true;
                    assistantId = e.assistant.id;
                    setDraft("");
                    setThread({ id: e.threadId, title: e.title, messages: [], updatedAt: e.user.createdAt, archived: false });
                    setMessages(list => [...list, e.user, e.assistant]);
                }
                if (e.type === "status") setStreamStatus(e.message);
                if (e.type === "market") setMessages(list => list.map(m => m.id === assistantId ? { ...m, marketEvidence: e.evidence } : m));
                if (e.type === "delta") {
                    answer += e.text;
                    if (!flush.current)
                        flush.current = setTimeout(paint, 50);
                }
                if (e.type === "complete") {
                    if (flush.current)
                        clearTimeout(flush.current);
                    flush.current = null;
                    setMessages(list => list.map(m => m.id === e.message.id ? e.message : m));
                }
                if (e.type === "failure") {
                    failed = true;
                    setError(e.message + (e.requestId ? ` Reference: ${e.requestId}` : ""));
                    if (flush.current)
                        clearTimeout(flush.current);
                    flush.current = null;
                    setMessages(list => list.map(m => m.id === assistantId ? { ...m, text: answer, state: "failed" } : m));
                }
            });
            if (mounted.current)
                await load();
        }
        catch (e) {
            if (!mounted.current)
                return;
            failed = true;
            setError(c.signal.aborted ? "Response stopped. Reload the conversation to confirm what was saved." : e instanceof Error ? e.message : "The response could not be completed.");
            if (started)
                setMessages(list => list.map(m => m.id === assistantId ? { ...m, text: answer, state: c.signal.aborted ? "cancelled" : "failed" } : m));
        }
        finally {
            if (flush.current)
                clearTimeout(flush.current);
            flush.current = null;
            if (mounted.current) {
                setWorking(false);
                if (failed && !started)
                    setDraft(prompt);
            }
        }
    }
    async function test() { if (busy || !confirmTest)
        return; setTesting(true); setError(""); try {
        const r = await studioJson<{
            ok: true;
            health: ProviderHealth;
        }>("/api/ai-studio/connection", { method: "POST", body: JSON.stringify({ confirm: true }) }, 50000);
        if (mounted.current) {
            setBootstrap(b => b ? { ...b, health: r.health } : b);
            setConfirmTest(false);
        }
    }
    catch (e) {
        if (mounted.current)
            setError(e instanceof Error ? e.message : "Connection test failed.");
    }
    finally {
        if (mounted.current)
            setTesting(false);
    } }
    async function archive() { if (!archiveId || busy)
        return; setLoading(true); try {
        await studioJson("/api/ai-studio", { method: "POST", body: JSON.stringify({ action: "archive", threadId: archiveId }) });
        if (!mounted.current)
            return;
        if (thread?.id === archiveId) {
            setThread(null);
            setMessages([]);
            setDraft("");
        }
        setArchiveId(null);
        await load();
    }
    catch (e) {
        if (mounted.current)
            setError(e instanceof Error ? e.message : "Could not archive conversation.");
    }
    finally {
        if (mounted.current)
            setLoading(false);
    } }
    async function copy(value: string) { try {
        await navigator.clipboard.writeText(value);
        setToast("Copied.");
    }
    catch {
        setToast("Clipboard access is unavailable. Select the text and copy it manually.");
    } }
    function listen(message: StudioMessage) { if (!canSpeak)
        return; if (speaking === message.id) {
        speechSynthesis.cancel();
        setSpeaking(null);
        return;
    } speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(message.text.replace(/[#*`]/g, "").slice(0, 4000)); utterance.onend = () => { if (mounted.current)
        setSpeaking(null); }; utterance.onerror = () => { if (mounted.current) {
        setSpeaking(null);
        setToast("Read aloud was interrupted or is unavailable.");
    } }; setSpeaking(message.id); speechSynthesis.speak(utterance); }
    function enter(e: KeyboardEvent<HTMLTextAreaElement>) { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        void send();
    } }
    function microphone() { if (voiceApproved) {
        void dictation.start();
    }
    else
        setVoiceIntro(true); }
    const health = bootstrap?.health;
    return <section className={css.studio} aria-label="AI Studio">
  <aside className={`${css.history} ${historyOpen ? css.historyVisible : ""}`} aria-label="Conversations"><div className={css.historyBrand}><Sparkles />Slice Studio</div><button className={css.newChat} onClick={newChat} disabled={busy}>New conversation<Plus size={15}/></button><p className={css.historyLabel}>Recent conversations</p>
   <ul className={css.threadList}>{threads.map(t => <li key={t.id} className={`${css.thread} ${thread?.id === t.id ? css.selectedThread : ""}`}><button className={css.threadTitle} disabled={busy} title={t.title} onClick={() => { setError(""); window.speechSynthesis?.cancel(); setSpeaking(null); void load(t.id); }}>{t.title}</button><button className={css.archive} disabled={busy} onClick={() => setArchiveId(t.id)} aria-label={`Archive ${t.title}`}><Archive size={12}/></button></li>)}</ul>
   {!threads.length && <p className={css.historyEmpty}>{loading ? "Loading saved conversations…" : "New conversations are saved to your account. Your existing command history remains in Advanced workflows."}</p>}{nextBefore && <button className={css.smallButton} onClick={() => void load(undefined, true, nextBefore)} disabled={busy}>Load earlier conversations</button>}
   <div className={css.historyFooter}><Link href="/workspace/personal-bot/reports" prefetch={false}><FileText />Report library<ArrowUpRight size={11}/></Link><Link href="/workspace/personal-bot/legacy" prefetch={false}><ShieldCheck />Advanced workflows<ArrowUpRight size={11}/></Link><Link href="/workspace/settings" prefetch={false}><Settings2 />Workspace settings</Link><span>Conversations are private to your user and firm. No browser-stored transcript.</span></div>
  </aside>
  <div className={css.chatArea}><header className={css.header}><div className={css.headerLeft}><button className={`${css.iconButton} ${css.mobileHistory}`} aria-label="Show conversations" aria-expanded={historyOpen} onClick={() => setHistoryOpen(v => !v)}><PanelLeft /></button><div><strong>AI Studio</strong><small>Think clearly. Move thoughtfully.</small></div></div><div className={css.headerRight}><span className={`${css.badge} ${health?.state === "verified" ? css.verified : ""}`}><i />{health ? HEALTH_LABELS[health.state] : "Checking configuration"}</span><button className={css.smallButton} aria-label="Connection settings" aria-expanded={connectionOpen} onClick={() => setConnectionOpen(v => !v)}><Settings2 /><span>Connection</span></button><button className={css.iconButton} aria-label="New conversation" disabled={busy} onClick={newChat}><Plus /></button></div></header>
   <div className={css.chatScroll}>
    {session.error && <p className={`${css.notice} ${css.error}`}>{session.error}</p>}{!session.loading && !session.user && <p className={css.notice}><Link href="/advisor-login">Sign in to use your private AI workspace.</Link></p>}
    {connectionOpen && <section className={css.details} aria-label="AI connection"><h2>Know your connection.</h2><p>{health?.message || "Configuration could not be loaded. Refresh the Studio."}</p><div className={css.detailGrid}><div><small>Text model</small><strong>{health?.model || "Not loaded"}</strong></div><div><small>Last actual test or completed reply</small><strong>{time(health?.checkedAt)}</strong></div></div><p>A configured key is not proof of model access. This test sends a small billable request using the server credential. It does not verify transcription or other features.</p><label><input type="checkbox" checked={confirmTest} onChange={e => setConfirmTest(e.target.checked)} disabled={busy}/>I approve a small provider connection test.</label><div className={css.buttons}><button className={css.smallButton} disabled={busy || !confirmTest || !online} onClick={() => void test()}>{testing ? <RefreshCw className={css.spin}/> : <ShieldCheck />}Test connection</button><button className={css.smallButton} disabled={busy} onClick={() => void load()}><RefreshCw />Reload configuration</button></div><p>Credentials stay on the server. Ask your administrator to verify the API project, billing, model access, and deployment environment. Never paste a key into chat.</p>{health?.requestId && <p className={css.timestamp}>Provider request: {health.requestId}</p>}</section>}
    {connectionOpen && <MarketConnectionPanel symbol={marketSymbols.split(/[\s,]+/)[0] || "SPY"} disabled={busy} />}
    {archiveId && <section className={css.details}><h2>Archive this conversation?</h2><p>It leaves the recent-conversation list. This is not a permanent deletion or a compliance-retention action.</p><div className={css.buttons}><button className={css.smallButton} onClick={() => setArchiveId(null)}>Keep conversation</button><button className={css.smallButton} onClick={() => void archive()} disabled={busy}>Archive</button></div></section>}
    {voiceIntro && <section className={css.details}><h2>Your voice, your choice.</h2><p>A recording of up to 60 seconds will be sent to OpenAI for transcription when you stop. The transcript fills the composer only; you review it before sending. Audio is not intentionally stored by this application. Provider retention policies still apply.</p><div className={css.buttons}><button className={css.smallButton} onClick={() => setVoiceIntro(false)}>Not now</button><button className={css.smallButton} disabled={busy} onClick={() => { setVoiceApproved(true); setVoiceIntro(false); void dictation.start(); }}>Allow and start recording</button></div></section>}
    {researchOpen && <section className={css.details}><h2>Attach verified saved research</h2><p>Select the exact record to share with the assistant. This is a saved model estimate—not a new market scan. No client documents or inbox contents are included.</p><label htmlFor="studio-research">Saved research run</label><select id="studio-research" value={selectedResearch} onChange={e => setSelectedResearch(e.target.value)} disabled={busy}><option value="">Choose a saved run</option>{bootstrap?.researchChoices.map(r => <option key={r.runId} value={r.runId}>{r.symbol} · {time(r.asOf)} · {r.runId.slice(0, 8)}</option>)}</select><label htmlFor="studio-horizon">Forecast horizon</label><select id="studio-horizon" value={horizon} onChange={e => setHorizon(e.target.value)} disabled={busy}>{HORIZONS.map(h => <option key={h}>{h}</option>)}</select><div className={css.buttons} style={{ marginTop: 12 }}><button className={css.smallButton} disabled={busy || !selectedResearch} onClick={() => { const r = bootstrap?.researchChoices.find(x => x.runId === selectedResearch); if (r) {
        setResearch({ symbol: r.symbol, runId: r.runId, horizon });
        setResearchOpen(false);
    } }}><Link2 />Attach selected record</button><button className={css.smallButton} onClick={() => setResearchOpen(false)}>Close</button><Link className={css.smallButton} href="/workspace/intelligence" prefetch={false}>Open Intelligence<ArrowUpRight /></Link></div></section>}
    {!messages.length ? <StudioWelcome onPrompt={v => { setDraft(v); if (v.includes("selected market observations")) setMarketEnabled(true); composer.current?.focus(); }} disabled={busy}/> : <div className={css.messageList}>{messages.map(m => <article key={m.id} className={css.message} aria-label={m.role === "user" ? "Your message" : "Slice response"}>{m.role === "assistant" ? <StudioOrb small active={m.state === "streaming" || speaking === m.id}/> : <span className={css.userAvatar}>{session.user?.name?.slice(0, 1).toUpperCase() || "Y"}</span>}<div className={css.messageBody}><div className={css.messageMeta}>{m.role === "user" ? "You" : "Slice"}<small>{m.role === "assistant" ? (m.state === "complete" ? (m.responseKind === "evidence-only" ? "Verified data only · AI generation unavailable" : "AI-generated · review before use") : m.state === "streaming" ? "Responding…" : m.state === "cancelled" ? "Stopped · partial answer" : "Incomplete answer") : ""}</small></div>{m.role === "user" ? <div className={css.userText}>{m.text}</div> : m.text ? <MessageContent value={m.text}/> : <p className={css.statusLine}>{m.state === "streaming" ? streamStatus || "Considering your request…" : "No answer text was received."}</p>}
     {m.role === "assistant" && m.marketEvidence && <MarketEvidenceCard evidence={m.marketEvidence} />}
     {m.role === "assistant" && m.reference && <aside className={css.reference}><strong>{m.reference.symbol} · {m.reference.horizon} · Verified saved record</strong><p>Positive-return probability {m.reference.probabilityPositive.toFixed(1)}% · Expected return {m.reference.expectedReturnPct.toFixed(2)}% · Model confidence {m.reference.confidence.toFixed(0)} / 100.</p><p>Provider as of {time(m.reference.asOf)}. Model: {m.reference.model}. This is not a live quote.</p><Link href={m.reference.href} prefetch={false}>Inspect the exact research run<ArrowUpRight size={10}/></Link><p className={css.timestamp}>Run {m.reference.runId} · Checksum {m.reference.checksum.slice(0, 16)}…</p></aside>}
     {m.role === "assistant" && m.text && m.state !== "streaming" && <div className={css.messageActions}><button onClick={() => void copy(m.text)}><Copy />Copy</button>{canSpeak && <button onClick={() => listen(m)}>{speaking === m.id ? <Square /> : <Volume2 />}{speaking === m.id ? "Stop reading" : "Read aloud"}</button>}<span className={css.timestamp}>{time(m.createdAt)}</span></div>}
    </div></article>)}</div>}
    {working && !messages.some(m => m.state === "streaming") && <p className={css.statusLine}><RefreshCw size={13} className={css.spin}/>Preparing your request…</p>}<div ref={end}/>
   </div>
   <div className={css.composerDock}>
    {showJump && messages.length > 0 && <div style={{ textAlign: "center", marginBottom: 8 }}><button className={css.smallButton} onClick={() => { nearBottom.current = true; end.current?.scrollIntoView({ block: "end" }); setShowJump(false); }}>Jump to latest</button></div>}
    {error && <div className={`${css.notice} ${css.error}`} role="alert">{error}<button className={css.iconButton} onClick={() => setError("")} style={{ marginLeft: 8 }} aria-label="Dismiss error"><X /></button></div>}{toast && <div className={css.notice} role="status">{toast}</div>}{!online && <div className={css.notice}>You are offline. Your draft remains here; reconnect before sending.</div>}
    <div className={css.composer}>
     <div className={css.reference} style={{ margin: "0 0 10px", padding: "10px 12px" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 8 }}><input type="checkbox" checked={autoEvidence} disabled={busy} onChange={e => setAutoEvidence(e.target.checked)}/>Automatic market context · exact tickers, relevant sources</label>
      {autoEvidence && <p style={{ fontSize: 10, color: "var(--slice-muted)", margin: "0 0 8px" }}>Use $TICKER or select symbols below. Quotes, history, company, earnings and news are selected from the question, with up to eight section reads. Cached reads retain source times. Missing coverage is explained, never fabricated. Uncached reads use the account allowance.</p>}
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}><input type="checkbox" checked={marketEnabled} disabled={busy} onChange={e => setMarketEnabled(e.target.checked)} /><Activity size={14}/>Market evidence · Alpha Vantage</label>
      {marketEnabled && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 9 }}><input aria-label="Market ticker symbols" value={marketSymbols} onChange={e => setMarketSymbols(e.target.value.toUpperCase().slice(0, 50))} placeholder="AAPL, MSFT (up to 3)" disabled={busy} style={{ padding: "8px 10px", flex: "1 1 180px", minWidth: 0, background: "var(--slice-input)", border: "1px solid var(--slice-border)", borderRadius: 9, color: "var(--slice-heading)" }}/><label style={{ display: "flex", gap: 6, fontSize: 11 }}><input type="checkbox" checked={marketNews} disabled={busy} onChange={e => setMarketNews(e.target.checked)}/>Recent headlines</label><small style={{ flexBasis: "100%" }}>Retrieves selected observations before every answer; cached requests retain their original provider times. Uses the server account allowance. Never paste API keys.</small></div>}
     </div>{research && <div className={css.reference} style={{ marginTop: 0 }}><strong>{research.symbol} · {research.horizon} · Pinned run {research.runId.slice(0, 8)}</strong><button className={css.iconButton} style={{ float: "right", height: 24, minHeight: 24, width: 24 }} disabled={busy} aria-label="Remove attached research" onClick={() => setResearch(null)}><X /></button></div>}
     {dictation.state !== "idle" ? <div className={css.recording}><div className={css.wave} aria-hidden="true">{[1, 2, 3, 4, 5, 6, 7].map(v => <i key={v}/>)}</div><span role="status">{dictation.state === "recording" ? `Listening · ${dictation.seconds}s / 60s` : "Transcribing your recording…"}</span><div className={css.buttons}><button className={css.smallButton} onClick={dictation.cancel}>Cancel</button>{dictation.state === "recording" && <button className={css.smallButton} onClick={dictation.stop}>Stop & transcribe</button>}</div></div> : <textarea ref={composer} aria-label="Message Slice" placeholder="Ask a question, explore an idea, or draft something thoughtful…" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={enter} maxLength={STUDIO_LIMITS.promptCharacters} disabled={working || !session.user}/>}
     <div className={css.composerBottom}><div className={css.composerTools}><button className={css.iconButton} aria-label="Attach saved research" title="Attach a saved research run" disabled={busy} onClick={() => setResearchOpen(v => !v)}><Link2 /></button><select className={css.modeSelect} value={mode} onChange={e => setMode(e.target.value as StudioMode)} disabled={busy} aria-label="Answer detail"><option value="concise">Concise</option><option value="balanced">Balanced</option><option value="detailed">Detailed</option></select><button className={css.iconButton} disabled={busy || !dictation.supported || !bootstrap?.transcriptionConfigured || !online} title={!dictation.supported ? "Microphone requires a supported secure browser" : "Record, transcribe, then review"} aria-label="Dictate a message" onClick={microphone}><Mic /></button><span className={css.charCount}>{draft.length.toLocaleString()} / 8,000</span></div>{working ? <button className={css.send} onClick={() => stream.current?.abort()} aria-label="Stop response"><Square /></button> : <button className={css.send} onClick={() => void send()} disabled={busy || !draft.trim() || !session.user || !online} aria-label="Send message"><ArrowUp /></button>}</div>
    </div><p className={css.disclaimer}>Slice can make mistakes. Verify before client use. Chat cannot send, trade, or change records. Enter to send · Shift+Enter for a new line.{canSpeak ? " Read aloud uses your browser's voice service." : ""}</p><div className={css.srOnly} role="status" aria-live="polite">{working ? "Slice is responding." : testing ? "Testing the connection." : "Ready for your next message."}</div>
   </div>
  </div>
 </section>;
}
