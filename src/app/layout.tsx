import type { Metadata, Viewport } from "next";
import PersonalBotWidget from "@/components/personal-bot-widget";
import UserThemeProvider from "@/components/user-theme-provider";
import WorkspaceDraggableOverlays from "@/components/workspace-draggable-overlays";
import WorkspaceEmailQuickAccess from "@/components/workspace-email-quick-access";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Slice | Advisor Intelligence Operating System",
    template: "%s | Slice",
  },
  description:
    "Slice is a premium advisor intelligence operating system for source credibility, portfolio-aware alerts, adaptive AI bots, client communication, meeting prep, compliance memory, and firm-wide intelligence.",
  applicationName: "Slice",
};

export const viewport: Viewport = {
  themeColor: "#050505",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <UserThemeProvider />
        {children}
        <WorkspaceEmailQuickAccess />
        <PersonalBotWidget />
        <WorkspaceDraggableOverlays />
      </body>
    </html>
  );
}