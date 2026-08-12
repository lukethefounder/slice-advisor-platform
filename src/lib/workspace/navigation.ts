import { WORKSPACE_TOOLS, type WorkspaceTool } from "@/lib/workspace-green-core";

export type WorkspaceNavigationSection = {
  id: string;
  label: string;
  tools: WorkspaceTool[];
};

export type WorkspaceBreadcrumb = {
  label: string;
  href: string;
  current?: boolean;
};

export type WorkspaceRouteMeta = {
  label: string;
  shortLabel: string;
  description: string;
  category: string;
  href: string;
};

const CATEGORY_ORDER = [
  "Client",
  "Communication",
  "AI",
  "Market",
  "Team",
  "System",
] as const;

const ROUTE_OVERRIDES: Array<{
  prefix: string;
  meta: WorkspaceRouteMeta;
}> = [
  {
    prefix: "/workspace/intelligence/knowledge-graph",
    meta: {
      label: "Knowledge Graph",
      shortLabel: "Graph",
      description:
        "Explore the evidence, agents, sources, contradictions, and pathways behind Slice intelligence.",
      category: "AI",
      href: "/workspace/intelligence/knowledge-graph",
    },
  },
  {
    prefix: "/workspace/intelligence/forecast-lab",
    meta: {
      label: "Forecast Lab",
      shortLabel: "Forecast",
      description:
        "Review scenario probabilities, uncertainty, model agreement, and source-backed forecasting evidence.",
      category: "AI",
      href: "/workspace/intelligence/forecast-lab",
    },
  },
  {
    prefix: "/workspace/intelligence/agent-simulation",
    meta: {
      label: "Agent Simulation",
      shortLabel: "Agents",
      description:
        "Inspect research pathways, evidence selection, cohort agreement, and model behavior.",
      category: "AI",
      href: "/workspace/intelligence/agent-simulation",
    },
  },
  {
    prefix: "/workspace/jobs",
    meta: {
      label: "Background Jobs",
      shortLabel: "Jobs",
      description:
        "Inspect queued work, progress, retries, cancellations, and recoverable failures.",
      category: "System",
      href: "/workspace/jobs",
    },
  },
];

export const WORKSPACE_NAVIGATION_SECTIONS: WorkspaceNavigationSection[] =
  CATEGORY_ORDER.map((category) => ({
    id: category.toLowerCase(),
    label: category,
    tools: WORKSPACE_TOOLS.filter(
      (tool) =>
        tool.category === category &&
        !["settings", "compliance"].includes(tool.id),
    ),
  })).filter((section) => section.tools.length > 0);

export const WORKSPACE_MOBILE_TOOLS = [
  {
    id: "workspace-home",
    label: "Home",
    shortLabel: "Home",
    href: "/workspace",
    icon: "board" as const,
  },
  ...[
    "client-profiles",
    "client-portal-inbox",
    "email-center",
    "intelligence",
  ]
    .map((id) => WORKSPACE_TOOLS.find((tool) => tool.id === id))
    .filter((tool): tool is WorkspaceTool => Boolean(tool)),
];

export function workspaceToolIsActive(pathname: string, href: string) {
  if (href === "/workspace") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function workspaceRouteMeta(pathname: string): WorkspaceRouteMeta {
  if (pathname === "/workspace") {
    return {
      label: "Workspace",
      shortLabel: "Home",
      description:
        "Your advisor operating system for markets, clients, communications, intelligence, and firm execution.",
      category: "Workspace",
      href: "/workspace",
    };
  }

  const override = ROUTE_OVERRIDES.find((candidate) =>
    pathname.startsWith(candidate.prefix),
  );

  if (override) return override.meta;

  const tool = WORKSPACE_TOOLS.find((candidate) =>
    workspaceToolIsActive(pathname, candidate.href),
  );

  if (tool) {
    return {
      label: tool.label,
      shortLabel: tool.shortLabel,
      description: tool.description,
      category: tool.category,
      href: tool.href,
    };
  }

  const lastSegment = pathname
    .split("/")
    .filter(Boolean)
    .at(-1)
    ?.replace(/-/g, " ");

  const label = lastSegment
    ? lastSegment.replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Workspace";

  return {
    label,
    shortLabel: label,
    description: "Slice advisor workspace.",
    category: "Workspace",
    href: pathname,
  };
}

export function workspaceBreadcrumbs(pathname: string): WorkspaceBreadcrumb[] {
  const current = workspaceRouteMeta(pathname);
  const breadcrumbs: WorkspaceBreadcrumb[] = [
    {
      label: "Workspace",
      href: "/workspace",
      current: pathname === "/workspace",
    },
  ];

  if (pathname === "/workspace") return breadcrumbs;

  if (pathname.startsWith("/workspace/intelligence/")) {
    breadcrumbs.push({
      label: "Intelligence",
      href: "/workspace/intelligence",
    });
  }

  breadcrumbs.push({
    label: current.label,
    href: current.href,
    current: true,
  });

  return breadcrumbs;
}