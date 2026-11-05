"use client";
import { useEffect, useRef, useState } from "react";
import css from "./terminal.module.css";
export default function PinePanel({ symbol, interval, marketContext }: { symbol: string; interval: string; marketContext: Record<string, unknown> }) {
 const [prompt, setPrompt] = useState("Create a non-repainting trend indicator using EMA 20, SMA 50, volume confirmation and clearly labeled risk levels."), [scriptType, setScriptType] = useState<"indicator" | "strategy">("indicator");
 const [code, setCode] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [confirm, setConfirm] = useState(false), [warnings, setWarnings] = useState<string[]>([]);
 const controller = useRef<AbortController | null>(null), mounted = useRef(true);
 useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
 async function generate() {
  if (!confirm || busy || !prompt.trim()) return; const c = new AbortController(); controller.current = c; setBusy(true); setMessage(""); const t = setTimeout(() => c.abort(), 90000);
  try {
   const response = await fetch("/api/market-visuals/pine", { method: "POST", signal: c.signal, credentials: "same-origin", headers: { "Content-Type": "application/json", "x-slice-sensitive-action": "generate-pine-script" }, body: JSON.stringify({ symbol, interval, prompt, scriptType, existingCode: code, marketContext }) });
   const result = await response.json() as { code?: string; error?: string; detail?: string; warnings?: unknown; model?: string };
   if (!response.ok || !result.code) throw new Error(result.detail || result.error || "The existing Pine service did not return code.");
   if (!mounted.current) return; setCode(result.code); setWarnings(Array.isArray(result.warnings) ? result.warnings.filter((v): v is string => typeof v === "string") : []); setMessage(`Generated with ${result.model || "the configured model"}. Review and test outside Slice before use.`); setConfirm(false);
  } catch (e) { if (mounted.current) setMessage(c.signal.aborted ? "Request stopped or timed out. No code was executed." : e instanceof Error ? e.message : "Generation failed."); }
  finally { clearTimeout(t); if (mounted.current) setBusy(false); }
 }
 async function copy() { try { await navigator.clipboard.writeText(code); setMessage("Code copied."); } catch { setMessage("Copy unavailable. Select the code manually."); } }
 function download() { const u = URL.createObjectURL(new Blob([code], { type: "text/plain" })), a = document.createElement("a"); a.href = u; a.download = `Slice-${symbol}-${scriptType}.pine`; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); }
 return <><div className={css.sectionHead}><div><p className={css.kicker}>Existing OpenAI workflow · explicit approval</p><h2>Pine Lab</h2><p>Draft an indicator or strategy script. Slice does not execute generated code or place orders.</p></div></div><label className={css.field}>Describe the script<textarea rows={4} maxLength={6000} value={prompt} onChange={e => setPrompt(e.target.value)}/></label><div className={css.controls}><label>Output<select value={scriptType} onChange={e => setScriptType(e.target.value as "indicator" | "strategy")}><option value="indicator">Indicator</option><option value="strategy">Strategy</option></select></label><label className={css.check}><input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)}/>I approve a provider-billed AI request</label><button className={css.primary} disabled={busy || !confirm} onClick={() => void generate()}>{busy ? "Generating…" : "Generate script"}</button>{busy && <button onClick={() => controller.current?.abort()}>Stop</button>}</div>{message && <p className={css.notice} role="status">{message}</p>}{warnings.map(w => <p className={css.notice} key={w}>{w}</p>)}<label className={css.field}>Editable output<textarea className={css.code} rows={17} value={code} onChange={e => setCode(e.target.value)} placeholder="Generated code appears here. Nothing runs automatically."/></label><div className={css.controls}><button disabled={!code} onClick={() => void copy()}>Copy code</button><button disabled={!code} onClick={download}>Download .pine</button></div></>;
}
