"use client";

import { useEffect, useState } from "react";
import type { GatewayBudget } from "@/lib/market-evidence/gateway-budget";
import css from "./gateway.module.css";

export default function GatewayStatus() {
  const [budget, setBudget] = useState<GatewayBudget | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    void fetch("/api/market-evidence/allowance", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ok || !payload.budget) {
          throw new Error(payload.message || "Allowance status could not be read.");
        }
        if (!controller.signal.aborted) setBudget(payload.budget);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error ? cause.message : "Allowance status unavailable.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [revision]);

  const beta = budget?.policy.enforcement === "beta-uncapped";

  return (
    <section className={css.panel} aria-label="Market request allowance" aria-busy={loading}>
      <div className={css.top}>
        <div>
          <small>DATA DELIVERY</small>
          <h3>{beta ? "Beta access · local caps disabled" : "Shared request allowance"}</h3>
        </div>
        <button type="button" disabled={loading} onClick={() => setRevision((value) => value + 1)}>
          {loading ? "Checking…" : "Recheck allowance"}
        </button>
      </div>

      {error ? (
        <p role="alert">
          {error}{budget ? " The last allowance result remains shown; it was not refreshed." : ""}
        </p>
      ) : null}

      {budget ? (
        <>
          <div className={css.numbers}>
            <span>
              <b>{budget.remaining.minute === null ? "No local cap" : budget.remaining.minute}</b>
              {budget.policy.perMinute === null
                ? `${budget.used.minute} reservations in the rolling minute`
                : `of ${budget.policy.perMinute} minute slots available`}
            </span>
            <span>
              <b>{budget.remaining.day === null ? "No local cap" : budget.remaining.day}</b>
              {budget.policy.perDay === null
                ? `${budget.used.day} reservations today`
                : `of ${budget.policy.perDay} daily slots available`}
            </span>
          </div>
          <p>
            {beta
              ? "Beta testing has no Slice gateway minute or daily quota. No paid Slice subscription is required by this gateway. Provider limits and endpoint permissions still apply."
              : budget.blocked
                ? `The application ${budget.blocked} allowance is reached. Next local reset: ${budget.retryAt}.`
                : "The local gateway allowance is available. Provider capacity and endpoint access are checked separately."}
          </p>
        </>
      ) : null}

      <p className={css.note}>
        These are Slice gateway reservations, not an Alpha Vantage account balance.
        Other collectors may use the same key. Beta mode does not purchase provider
        access, remove provider throttling, or verify an API key. This panel never
        exposes or changes credentials.
      </p>
    </section>
  );
}
