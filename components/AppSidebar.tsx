"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import {
  LayoutDashboard, MessageSquareText, FolderKanban, Trophy,
  BarChart3, Clock, Search, Cloud, GitGraph, FileText, RefreshCw,
  Coins, CalendarDays, Wrench, Sunrise, Sparkles, Columns2, TriangleAlert,
  TerminalSquare, Bot, Activity, Tag, Repeat, SlashSquare, Settings, Zap,
  Layers,
} from "lucide-react";
import { useState } from "react";
import { Playlists } from "./Playlists";

const nav = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/today", label: "Today", Icon: Sunrise },
  { href: "/week", label: "This Week", Icon: CalendarDays },
  { href: "/prompts", label: "All Prompts", Icon: MessageSquareText },
  { href: "/sessions", label: "Sessions", Icon: Layers },
  { href: "/plans", label: "Plans", Icon: FileText },
  { href: "/projects", label: "Projects", Icon: FolderKanban },
  { href: "/burndown", label: "Burndown", Icon: Activity },
  { href: "/timeline", label: "Timeline", Icon: Clock },
  { href: "/calendar", label: "Calendar", Icon: CalendarDays },
  { href: "/tokens", label: "Tokens & Cost", Icon: Coins },
  { href: "/tools", label: "Tools & Tags", Icon: Wrench },
  { href: "/files", label: "Files", Icon: FileText },
  { href: "/commands", label: "Commands", Icon: TerminalSquare },
  { href: "/agents", label: "Agents", Icon: Bot },
  { href: "/slashes", label: "Slashes", Icon: SlashSquare },
  { href: "/skills", label: "Skills", Icon: Zap },
  { href: "/highlights", label: "Highlights", Icon: Sparkles },
  { href: "/compare", label: "Compare", Icon: Columns2 },
  { href: "/anomalies", label: "Anomalies", Icon: TriangleAlert },
  { href: "/repeats", label: "Repeats", Icon: Repeat },
  { href: "/rankings", label: "Rankings", Icon: Trophy },
  { href: "/analytics", label: "Analytics", Icon: BarChart3 },
  { href: "/wordcloud", label: "Word Cloud", Icon: Cloud },
  { href: "/tags", label: "Tags", Icon: Tag },
  { href: "/search", label: "Search", Icon: Search },
  { href: "/graph", label: "Graph", Icon: GitGraph },
  { href: "/settings", label: "Settings", Icon: Settings },
];

export function AppSidebar() {
  const p = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [live, setLive] = useState<{ newPrompts: number; at: number } | null>(null);

  useEffect(() => {
    let es: EventSource | null = null;
    let baseline: number | null = null;
    try {
      es = new EventSource("/api/stream");
      es.addEventListener("hello", (e: any) => {
        try { baseline = JSON.parse(e.data).lastIndexedAt || null; } catch {}
      });
      es.addEventListener("indexed", (e: any) => {
        try {
          const d = JSON.parse(e.data);
          // Show new-prompt badge whenever the watcher reindexed something with new prompts
          if (d && d.newPrompts > 0) {
            setLive({ newPrompts: d.newPrompts, at: d.at });
          }
        } catch {}
      });
      es.onerror = () => { /* keep-alive will reconnect; ignore */ };
    } catch {}
    return () => { if (es) es.close(); };
  }, []);

  function consume() {
    setLive(null);
    router.refresh();
  }
  async function refresh() {
    setBusy(true); setStatus("indexing…");
    try {
      const r = await fetch("/api/refresh", { method: "POST" });
      const j = await r.json();
      setStatus(`+${j.newPrompts ?? 0} in ${j.durationMs ?? "?"}ms`);
    } catch {
      setStatus("failed");
    } finally {
      setBusy(false);
      setTimeout(() => setStatus(""), 4000);
      // give pages a moment then reload
      setTimeout(() => { if (typeof window !== "undefined") window.location.reload(); }, 400);
    }
  }
  return (
    <aside className="w-56 shrink-0 border-r border-border bg-card/60 backdrop-blur flex flex-col">
      <div className="px-4 py-5">
        <Link href="/" className="block">
          <div className="text-sm font-bold tracking-tight">CC Prompt Overseer</div>
          <div className="text-xs text-mutedfg">local history, ranked</div>
        </Link>
      </div>
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, Icon }) => {
          const active = href === "/" ? p === "/" : p.startsWith(href);
          return (
            <Link key={href} href={href}
              className={cn(
                "flex items-center gap-2 rounded px-3 py-1.5 text-sm transition",
                active ? "bg-accent/20 text-fg" : "text-mutedfg hover:text-fg hover:bg-muted/50"
              )}>
              <Icon className="h-4 w-4" />{label}
            </Link>
          );
        })}
      </nav>
      <Playlists />
      <div className="p-3 border-t border-border space-y-2">
        {live && live.newPrompts > 0 && (
          <button onClick={consume}
                  className="w-full rounded bg-accent/20 text-accent border border-accent/50 px-2 py-1.5 text-xs hover:bg-accent/30 transition">
            +{live.newPrompts} new — refresh
          </button>
        )}
        <button disabled={busy} onClick={refresh}
          className="w-full flex items-center gap-2 justify-center rounded border border-border px-2 py-1.5 text-xs hover:bg-muted/60 transition disabled:opacity-50">
          <RefreshCw className={cn("h-3 w-3", busy && "animate-spin")} />
          Refresh index
        </button>
        {status && <div className="text-[10px] text-mutedfg text-center">{status}</div>}
      </div>
    </aside>
  );
}
