import css from "@/components/strategy-space/strategy-space.module.css";
export default function Loading(){return <div className={css.page} role="status" aria-label="Loading strategy workspace"><div className={css.skeleton}/><div className={css.skeleton}/><span className={css.muted}>Opening your strategy workspace…</span></div>}
