"use client";

import { useEffect } from "react";
import { watchWorkspaceAppearance } from "@/lib/workspace/appearance";

/** One event-driven appearance controller for public, access and private routes. */
export default function PlatformAppearance() {
  useEffect(() => watchWorkspaceAppearance(), []);
  return null;
}
