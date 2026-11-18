"use client";
import { useEffect, useId, useRef, useState } from "react";
import { EFFECT_OPTIONS, effectStorageKey, readEffectLevel, saveEffectLevel, type EffectLevel } from "@/lib/experience/display-preferences";
import css from "./experience.module.css";
function browserStorage(): Storage | null { try { return window.localStorage; } catch { return null; } }
export default function ExperienceControls({ scopeKey }: { scopeKey: string | null }) {
  const [level, setLevel] = useState<EffectLevel>("balanced");
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  useEffect(() => {
    const html = document.documentElement;
    const previous = html.dataset.sliceEffects;
    const update = () => { const value = readEffectLevel(browserStorage(), scopeKey); html.dataset.sliceEffects = value; setLevel(value); };
    update(); setOpen(false); setNotice("");
    const sync = (event: StorageEvent) => { if (event.key === effectStorageKey(scopeKey) || event.key === null) update(); };
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("storage", sync); if (previous === undefined) delete html.dataset.sliceEffects; else html.dataset.sliceEffects = previous; };
  }, [scopeKey]);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", closeOutside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", escape); };
  }, [open]);
  function choose(next: EffectLevel) {
    setLevel(next); document.documentElement.dataset.sliceEffects = next;
    const saved = saveEffectLevel(browserStorage(), scopeKey, next);
    setNotice(saved ? "Saved for this account in this browser." : "Applied for this visit. Browser storage or an account scope is unavailable.");
    window.dispatchEvent(new Event("slice-display-effects-change"));
  }
  return <div ref={root} className={css.controls} onBlur={event => {
    const next = event.relatedTarget;
    if (next instanceof Node && !event.currentTarget.contains(next)) setOpen(false);
  }}>
    <button type="button" ref={trigger} className={css.trigger} aria-label="Display" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>
      <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14M7 3v4m6 1v4m-5 1v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg><span>Display</span>
    </button>
    {open && <section id={panelId} aria-label="Display effects" className={css.popover}>
      <div className={css.eyebrow}>YOUR WORKSPACE / YOUR PACE</div><h2>Clarity, with character.</h2><p className={css.intro}>Choose how much visual depth to use. This never reduces market data, permissions or functionality.</p>
      <fieldset className={css.options}><legend>Visual effects</legend>{EFFECT_OPTIONS.map(option => <label key={option.value} className={css.option} data-selected={level === option.value}>
        <input type="radio" name={`display-${panelId}`} value={option.value} checked={level === option.value} onChange={() => choose(option.value)}/>
        <span><strong>{option.label}</strong><small>{option.description}</small></span>
      </label>)}</fieldset>
      <p className={css.note}>Theme, density and chart controls stay in their existing settings. Reduced-motion preferences always take priority.</p>
      <p role="status" className={css.status}>{notice}</p><button type="button" className={css.done} onClick={() => {setOpen(false); trigger.current?.focus();}}>Done</button>
    </section>}
  </div>;
}
