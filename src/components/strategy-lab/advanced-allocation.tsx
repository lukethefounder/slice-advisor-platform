"use client";
import type { AllocationGroup } from "@/lib/strategy-lab/contracts";
import css from "./strategy-pro.module.css";
export default function AdvancedAllocation({ symbols, groups, onChange }: { symbols: string[]; groups: AllocationGroup[]; onChange: (g: AllocationGroup[]) => void }) {
  const change = (i: number, patch: Partial<AllocationGroup>) => onChange(groups.map((g, n) => n === i ? { ...g, ...patch } : g));
  return <div className={css.ruleGroup}><div className={css.groupHead}><h3>Industry / theme allocation groups</h3><button type="button" disabled={groups.length >= 12} onClick={() => onChange([...groups, { name: `Group ${groups.length + 1}`, symbols: [], maxExposurePct: 40 }])}>+ Group</button></div>
    <p className={css.caption}>These are your fixed labels—not verified historical industry membership. Each symbol belongs to at most one group. Target caps are checked at rebalances; unused weight stays as cash.</p>
    {groups.map((group, i) => <div key={i} className={css.groupCard}><div className={css.groupHead}><label>Group name<input value={group.name} maxLength={60} onChange={e => change(i, { name: e.target.value })} /></label><label>Target exposure cap (%)<input type="number" min={1} max={100} value={group.maxExposurePct} onChange={e => change(i, { maxExposurePct: Number(e.target.value) })} /></label><button className={css.quiet} type="button" onClick={() => onChange(groups.filter((_, n) => n !== i))}>Remove</button></div>
    <div className={css.tools}>{symbols.map(symbol => <label key={symbol} className={css.member}><input type="checkbox" checked={group.symbols.includes(symbol)} disabled={groups.some((g, n) => n !== i && g.symbols.includes(symbol))} onChange={e => change(i, { symbols: e.target.checked ? [...group.symbols, symbol] : group.symbols.filter(s => s !== symbol) })} />{symbol}</label>)}</div>{group.symbols.some(s => !symbols.includes(s)) && <p role="alert">Remove or reselect group members that are no longer in the universe.</p>}</div>)}
  </div>;
}
