"use client";
import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
function PendingHint() {
 const { pending } = useLinkStatus();
 return <span role="status" aria-live="polite" style={{ marginLeft: "auto", fontSize: 9, opacity: pending ? 1 : 0, transition: "opacity 100ms", minWidth: 8 }} aria-label={pending ? "Opening workspace" : undefined}>{pending ? "…" : ""}</span>;
}
/** Preserve Link behavior and all existing styling; add actual router-pending feedback. */
export default function ResponsiveLink({ children, ...props }: ComponentProps<typeof Link>) {
 return <Link {...props}>{children}<PendingHint /></Link>;
}
