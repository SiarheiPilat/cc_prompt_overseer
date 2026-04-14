"use client";
import { useEffect, useMemo, useState } from "react";
import { User, Bot, Wrench } from "lucide-react";
import { fmtDate, truncate } from "@/lib/utils";
import { StarButton } from "./StarButton";

type P = any; type T = any;

export function SessionReplay({ prompts, turns }: { prompts: P[]; turns: T[] }) {
  const events = useMemo(() => {
    const all: Array<{ kind: "p" | "a"; ts: number; data: any }> = [];
    for (const p of prompts) all.push({ kind: "p", ts: p.ts || 0, data: p });
    for (const t of turns) all.push({ kind: "a", ts: t.ts || 0, data: t });
    all.sort((a, b) => a.ts - b.ts);
    return all;
  }, [prompts, turns]);

  const [filter, setFilter] = useState<"all" | "prompts" | "assistant">("all");
  const [expandAssistant, setExpandAssistant] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash && hash.startsWith("#p")) {
      const el = document.getElementById(hash.slice(1));
      el?.scrollIntoView({ block: "center" });
      el?.classList.add("ring-2", "ring-accent");
    }
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-xs">
        {(["all", "prompts", "assistant"] as const).map(k => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1 rounded border ${filter===k ? "bg-accent text-accentfg border-accent" : "border-border text-mutedfg hover:bg-muted/60"}`}>{k}</button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-mutedfg">
          <input type="checkbox" checked={expandAssistant} onChange={e => setExpandAssistant(e.target.checked)} />
          expand assistant
        </label>
      </div>
      <div className="space-y-2">
        {events.map((ev, idx) => {
          if (filter === "prompts" && ev.kind !== "p") return null;
          if (filter === "assistant" && ev.kind !== "a") return null;
          if (ev.kind === "p") {
            const p = ev.data;
            return (
              <div key={`p${p.id}`} id={`p${p.id}`}
                   className="rounded-lg border border-accent/30 bg-accent/5 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-xs text-mutedfg flex items-center gap-2">
                    <User className="h-3 w-3" /> you · {fmtDate(p.ts)} · {p.char_count} ch
                    {p.is_slash && <span className="text-accent">/{p.slash_name}</span>}
                  </div>
                  <StarButton uuid={p.uuid} initial={!!p.starred} />
                </div>
                <pre className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed">{p.text}</pre>
              </div>
            );
          } else {
            const t = ev.data;
            const preview = truncate((t.text || "").replace(/\s+/g, " "), 240);
            return (
              <div key={`a${t.id}`} className="rounded-lg border border-border bg-card/60 p-3">
                <div className="text-xs text-mutedfg flex items-center gap-2 mb-1.5">
                  <Bot className="h-3 w-3" /> claude · {fmtDate(t.ts)}
                  {t.tool_names && <span className="inline-flex items-center gap-1"><Wrench className="h-3 w-3" />{t.tool_names}</span>}
                </div>
                {expandAssistant ? (
                  <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-mutedfg">{t.text || "(tool use only)"}</pre>
                ) : (
                  <div className="text-[13px] text-mutedfg">{preview || "(tool use only)"}</div>
                )}
              </div>
            );
          }
        })}
      </div>
    </div>
  );
}
