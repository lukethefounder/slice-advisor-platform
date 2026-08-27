export const MINIMUM_INTELLIGENCE_MEMORY_DAYS = 30;
export const DEFAULT_INTELLIGENCE_MEMORY_DAYS = 30;
export const MAXIMUM_INTELLIGENCE_MEMORY_DAYS = 365;

export type IntelligenceMemoryWindow = {
  days: number;
  startAt: string;
  endAt: string;
  label: string;
  minimumRetainedDays: 30;
  durable: true;
  scope: "User";
};

function clampInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? Math.max(minimum, Math.min(maximum, Math.round(parsed)))
    : fallback;
}

export function intelligenceMemoryWindow(
  input?: {
    days?: unknown;
    now?: Date;
  },
): IntelligenceMemoryWindow {
  const now = input?.now ?? new Date();
  const days = clampInteger(
    input?.days ?? process.env.INTELLIGENCE_OPERATING_MEMORY_DAYS,
    DEFAULT_INTELLIGENCE_MEMORY_DAYS,
    MINIMUM_INTELLIGENCE_MEMORY_DAYS,
    MAXIMUM_INTELLIGENCE_MEMORY_DAYS,
  );
  const startAt = new Date(
    now.getTime() - days * 24 * 60 * 60_000,
  );

  return {
    days,
    startAt: startAt.toISOString(),
    endAt: now.toISOString(),
    label: `${days}-day operating memory`,
    minimumRetainedDays: MINIMUM_INTELLIGENCE_MEMORY_DAYS,
    durable: true,
    scope: "User",
  };
}