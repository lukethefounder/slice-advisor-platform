"use client";
import { Fragment, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { routeKey } from "@/lib/connected-research/contracts";
/** Remount only the page when its pinned research identity changes, not the workspace shell. */
export default function ResearchRouteBoundary({ children }: { children: ReactNode }) {
 const path = usePathname(), search = useSearchParams();
 return <Fragment key={routeKey(path, new URLSearchParams(search.toString()))}>{children}</Fragment>;
}
