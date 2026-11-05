import { researchBetaEnabled } from "@/lib/research/beta-policy";
/**
 * Slice's local market-gateway policy, not a provider entitlement or customer plan.
 * Set SLICE_PULSE_BETA_UNCAPPED=true on the server to suspend this gateway's
 * local minute/day caps for beta testing. Authentication, reservation logging,
 * provider responses, concurrency guards and backoff remain in their own layers.
 */
export type GatewayPolicy = {
  plan: "free" | "paid";
  perMinute: number | null;
  perDay: number | null;
  // Omitted in normal mode to preserve the existing policy signature.
  enforcement?: "beta-uncapped";
};

export type GatewayUsage = {
  minute: number;
  day: number;
  oldestMinuteAt: string | null;
};

export type GatewayBudget = {
  policy: GatewayPolicy;
  used: { minute: number; day: number };
  remaining: { minute: number | null; day: number | null };
  minuteResetAt: string;
  dayResetAt: string;
  blocked: "minute" | "day" | null;
  retryAt: string | null;
};

export type GatewayIssue = {
  code: "GATEWAY_MINUTE" | "GATEWAY_DAY";
  message: string;
  retryAfterSeconds: number;
  retryAt: string;
};

export function gatewayPolicy(
  env: Record<string, string | undefined>,
): GatewayPolicy {
  const plan = (env.SLICE_PULSE_PLAN || "free").trim().toLowerCase();

  if (plan !== "free" && plan !== "paid") {
    throw new Error(
      "SLICE_PULSE_PLAN must be free or paid; this setting does not verify your subscription.",
    );
  }

  const beta = researchBetaEnabled(env);

  if (beta) {
    // Do not relabel a free provider account as paid or erase usage history.
    // Null explicitly means no local cap; no Infinity/NaN or fake huge quota.
    return {
      plan,
      perMinute: null,
      perDay: null,
      enforcement: "beta-uncapped",
    };
  }

  function integer(name: string, fallback: number, maximum: number): number {
    const raw = env[name]?.trim();
    if (!raw) return fallback;
    if (!/^\d+$/.test(raw)) {
      throw new Error(`${name} must be a positive integer.`);
    }
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
      throw new Error(`${name} must be between 1 and ${maximum}.`);
    }
    return value;
  }

  const perMinute = integer("SLICE_PULSE_CALLS_PER_MINUTE", 5, 10_000);
  const daily = env.SLICE_PULSE_CALLS_PER_DAY?.trim().toLowerCase();
  let perDay: number | null;

  if (daily === "unlimited") {
    if (plan !== "paid") {
      throw new Error(
        "An unlimited daily allowance in normal mode requires SLICE_PULSE_PLAN=paid and a separately verified provider plan. For a deliberate beta override, use SLICE_PULSE_BETA_UNCAPPED=true instead.",
      );
    }
    perDay = null;
  } else {
    perDay = integer("SLICE_PULSE_CALLS_PER_DAY", 25, 10_000_000);
  }

  if (plan === "free" && perDay !== null && perDay > 25) {
    throw new Error(
      "A daily allowance above 25 in normal mode requires a verified provider plan and SLICE_PULSE_PLAN=paid. A beta override does not increase the provider's actual allowance.",
    );
  }

  return { plan, perMinute, perDay };
}

export function gatewayBudget(
  policy: GatewayPolicy,
  usage: GatewayUsage,
  now = Date.now(),
): GatewayBudget {
  const nextDay = new Date(now);
  nextDay.setUTCHours(24, 0, 0, 0);

  const oldest = usage.oldestMinuteAt ? Date.parse(usage.oldestMinuteAt) : NaN;
  const minuteEnd =
    Number.isFinite(oldest) && oldest <= now
      ? Math.max(now + 1_000, oldest + 60_100)
      : now + 60_000;

  const blocked =
    policy.perDay !== null && usage.day >= policy.perDay
      ? "day"
      : policy.perMinute !== null && usage.minute >= policy.perMinute
        ? "minute"
        : null;

  const minuteResetAt = new Date(minuteEnd).toISOString();
  const dayResetAt = nextDay.toISOString();

  return {
    policy,
    used: { minute: usage.minute, day: usage.day },
    remaining: {
      minute:
        policy.perMinute === null
          ? null
          : Math.max(0, policy.perMinute - usage.minute),
      day:
        policy.perDay === null ? null : Math.max(0, policy.perDay - usage.day),
    },
    // These describe counting windows, not permission to retry the provider.
    minuteResetAt,
    dayResetAt,
    blocked,
    retryAt:
      blocked === "day"
        ? dayResetAt
        : blocked === "minute"
          ? minuteResetAt
          : null,
  };
}

export function gatewayIssue(
  budget: GatewayBudget,
  now = Date.now(),
): GatewayIssue | null {
  if (!budget.blocked || !budget.retryAt) return null;

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((Date.parse(budget.retryAt) - now) / 1_000),
  );

  return {
    code: budget.blocked === "day" ? "GATEWAY_DAY" : "GATEWAY_MINUTE",
    retryAfterSeconds,
    retryAt: budget.retryAt,
    message:
      budget.blocked === "day"
        ? `Slice's configured daily allowance is used (${budget.used.day}/${budget.policy.perDay}). It resets at ${budget.dayResetAt}. Saved evidence is retained. This is a local gateway cap, not a customer subscription requirement or proof that Alpha Vantage rejected the key.`
        : `Slice's shared ${budget.policy.perMinute}-request minute allowance is busy. Capacity begins reopening at ${budget.minuteResetAt}. Saved evidence is retained; repeated clicks will not bypass the allowance.`,
  };
}
