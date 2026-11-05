"use client";
import { useEffect, useState } from "react";
import type { researchBetaSummary } from "@/lib/research/beta-policy";
import styles from "./strategy-pro.module.css";
export default function ResearchBetaBanner() {
  const [policy, setPolicy] = useState<ReturnType<typeof researchBetaSummary> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12000);
    void (async () => {
      try { const response = await globalThis.fetch("/api/research/beta-status", { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        if (!response.ok) throw new Error(); const payload = await response.json() as { policy?: ReturnType<typeof researchBetaSummary> };
        if (!payload.policy || typeof payload.policy.enabled !== "boolean") throw new Error();
        setPolicy(payload.policy);
      } catch { if (mounted) setError("Research policy could not be checked. Existing evidence is preserved."); }
      finally { clearTimeout(timeout); }
    })();
    return () => { mounted = false; clearTimeout(timeout); controller.abort(); };
  }, []);
  if (!policy) return <div className={styles.policy} role="status">{error || "Checking research mode…"}</div>;
  return <aside className={styles.policy} aria-label="Research operating policy"><strong><span className={styles.dot} />{policy.label}</strong><span>Market data · historical imports · Intelligence</span><details><summary>What stays protected?</summary><p>Provider access, security controls, calculation limits, and evidence checks remain enforced. This status does not verify the API key or grant paid data access.</p></details></aside>;
}
