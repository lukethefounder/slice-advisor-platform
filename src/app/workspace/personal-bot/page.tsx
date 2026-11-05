import type { Metadata } from "next";
import StudioWorkspace from "@/components/studio/studio-workspace";
export const metadata: Metadata = { title: "AI Studio", description: "A focused Slice conversation space for research explanations, drafts, and decision support." };
export default function PersonalBotPage() { return <StudioWorkspace />; }
