import "server-only";

import { ApiError } from "@/lib/api-route";

export type SchedulingProviderKey =
  | "calendly"
  | "cal-com"
  | "google-calendar"
  | "microsoft-bookings";

export type SchedulingProviderName =
  | "Calendly"
  | "Cal.com"
  | "Google Calendar"
  | "Microsoft Bookings";

export type SchedulingView = {
  configured: boolean;
  enabled: boolean;
  available: boolean;
  url: string | null;
  label: string;
  providerKey: SchedulingProviderKey | null;
  provider: SchedulingProviderName | null;
  host: string | null;
  fallbackMessage: string;
};

type ProviderDefinition = {
  key: SchedulingProviderKey;
  name: SchedulingProviderName;
  matches: (host: string, pathname: string) => boolean;
};

const PROVIDERS: ProviderDefinition[] = [
  {
    key: "calendly",
    name: "Calendly",
    matches: (host) => host === "calendly.com" || host.endsWith(".calendly.com"),
  },
  {
    key: "cal-com",
    name: "Cal.com",
    matches: (host) => host === "cal.com" || host.endsWith(".cal.com"),
  },
  {
    key: "google-calendar",
    name: "Google Calendar",
    matches: (host, pathname) =>
      host === "calendar.google.com" && pathname.toLowerCase().includes("/appointments/"),
  },
  {
    key: "microsoft-bookings",
    name: "Microsoft Bookings",
    matches: (host, pathname) =>
      host === "book.ms" ||
      ((host === "outlook.office.com" || host === "outlook.office365.com") &&
        pathname.toLowerCase().includes("/bookwithme/")),
  },
];

const TRACKING_PARAMETERS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
]);

function cleanString(value: unknown, maximum: number) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function providerForUrl(url: URL) {
  const host = url.hostname.toLowerCase();
  const pathname = url.pathname || "/";

  return PROVIDERS.find((provider) => provider.matches(host, pathname)) ?? null;
}

function schedulingError(message: string) {
  return new ApiError({
    status: 400,
    code: "INVALID_SCHEDULING_URL",
    message,
    expose: true,
  });
}

export function normalizeSchedulingLabel(value: unknown) {
  return cleanString(value, 120) || "Schedule a meeting";
}

export function normalizeSchedulingUrl(value: unknown) {
  const raw = cleanString(value, 2_000);

  if (!raw) return null;

  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw schedulingError("Enter a valid advisor scheduling link.");
  }

  if (url.protocol !== "https:") {
    throw schedulingError("Advisor scheduling links must use HTTPS.");
  }

  if (url.username || url.password) {
    throw schedulingError("Scheduling links must not contain embedded credentials.");
  }

  const provider = providerForUrl(url);

  if (!provider) {
    throw schedulingError(
      "Use a valid Calendly, Cal.com, Google Calendar appointment, or Microsoft Bookings link.",
    );
  }

  url.hash = "";

  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMETERS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }

  const normalizedPath = url.pathname.replace(/\/{2,}/g, "/");
  url.pathname = normalizedPath === "/" ? "/" : normalizedPath.replace(/\/$/, "");

  return url.toString().replace(/\/$/, "");
}

export function describeSchedulingUrl(value: string | null | undefined) {
  if (!value) {
    return {
      providerKey: null,
      provider: null,
      host: null,
    } as const;
  }

  try {
    const url = new URL(value);
    const provider = providerForUrl(url);

    return {
      providerKey: provider?.key ?? null,
      provider: provider?.name ?? null,
      host: url.hostname.toLowerCase(),
    } as const;
  } catch {
    return {
      providerKey: null,
      provider: null,
      host: null,
    } as const;
  }
}

export function schedulingView(input: {
  url: string | null | undefined;
  label: string | null | undefined;
  enabled: boolean;
}): SchedulingView {
  const description = describeSchedulingUrl(input.url);
  const configured = Boolean(input.url && description.providerKey);
  const available = configured && input.enabled;

  return {
    configured,
    enabled: input.enabled,
    available,
    url: available ? input.url ?? null : null,
    label: normalizeSchedulingLabel(input.label),
    providerKey: description.providerKey,
    provider: description.provider,
    host: description.host,
    fallbackMessage: configured
      ? "Your advisor has temporarily hidden online scheduling. Use the secure portal to request a meeting."
      : "Your advisor has not published an online scheduling link. Use the secure portal to request a meeting.",
  };
}