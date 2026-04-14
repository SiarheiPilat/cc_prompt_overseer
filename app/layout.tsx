import "./globals.css";
import type { Metadata } from "next";
import { AppSidebar } from "@/components/AppSidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { ShortcutsHelp } from "@/components/ShortcutsHelp";

export const metadata: Metadata = {
  title: "CC Prompt Overseer",
  description: "Local Claude Code prompts & plans explorer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex">
        <AppSidebar />
        <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
        <CommandPalette />
        <ShortcutsHelp />
      </body>
    </html>
  );
}
