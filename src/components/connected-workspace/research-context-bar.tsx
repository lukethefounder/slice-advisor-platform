"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Network } from "lucide-react";
import { contextFrom, researchHref, CONTEXT_HORIZONS, type ResearchContext } from "@/lib/connected-research/contracts";
import css from "./experience.module.css";
export default function ResearchContextBar({ identity }: { identity: string | null }) {
 const path = usePathname(), router = useRouter(), query = useSearchParams().toString();
 const [context, setContext] = useState<ResearchContext>({ symbol: "MSFT", researchRunId: null, horizon: "2-5d" });
 const [symbol, setSymbol] = useState("MSFT");
 useEffect(() => {
  if (!identity) return;
  const params = new URLSearchParams(query); let next = contextFrom(params);
  if (!params.has("symbol")) { try { const raw = sessionStorage.getItem(`slice-research-context-v1:${identity}`); if (raw) next = contextFrom(new URLSearchParams(raw)); } catch { /* Context memory is optional. */ } }
  setContext(next); setSymbol(next.symbol);
  try { const data = new URLSearchParams({ symbol: next.symbol, forecastHorizon: next.horizon }); if (next.researchRunId) data.set("researchRunId", next.researchRunId); sessionStorage.setItem(`slice-research-context-v1:${identity}`, data.toString()); } catch { /* No sensitive records are cached. */ }
 }, [identity, path, query]);
 function open(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const next = contextFrom(new URLSearchParams({ symbol: symbol.toUpperCase(), forecastHorizon: context.horizon }));
  setContext(next); router.push(researchHref("/workspace/intelligence", next)); }
 if (!identity) return null;
 return <div className={`${css.root} ${css.context}`} aria-label="Shared research context"><span className={css.contextLabel}><Network size={13} style={{ display: "inline", marginRight: 6 }} />Research context</span>
  <form onSubmit={open}><input aria-label="Research symbol" pattern="[A-Za-z][A-Za-z0-9.\-]{0,14}" maxLength={15} value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())}/><select aria-label="Research horizon" value={context.horizon} onChange={e => setContext(c => ({ ...c, horizon: e.target.value }))}>{CONTEXT_HORIZONS.map(h => <option key={h}>{h}</option>)}</select><button className={css.iconButton} aria-label="Open selected research"><ArrowRight size={14}/></button></form>
  <Link href={researchHref("/market-visuals", context)} prefetch={false}>Visuals</Link><Link href={researchHref("/workspace/intelligence/knowledge-graph", context)} prefetch={false}>Graph</Link><Link href="/workspace/intelligence/scenarios" prefetch={false}>Scenarios</Link><Link href={`/workspace/connected?symbol=${encodeURIComponent(context.symbol)}`} prefetch={false}>Related records</Link>
  <span className={css.contextNote}>{context.researchRunId ? `Pinned run · ${context.researchRunId}` : "Latest saved run · provider time remains explicit"}</span></div>;
}
