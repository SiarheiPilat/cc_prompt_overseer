"use client";
import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";

type Item = { id: string; label: string; hint?: string; href: string };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      if (!q.trim()) { setItems([]); return; }
      try {
        const r = await fetch(`/api/palette?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const j = await r.json();
        setItems(j.items || []);
      } catch {}
    })();
    return () => ctrl.abort();
  }, [q]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-24" onClick={() => setOpen(false)}>
      <Command className="w-[min(600px,90vw)] bg-card border border-border rounded-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-3 py-2 border-b border-border">
          <Command.Input value={q} onValueChange={setQ}
            placeholder="search prompts, plans, sessions, projects…"
            className="w-full bg-transparent outline-none text-sm" autoFocus />
        </div>
        <Command.List className="max-h-[60vh] overflow-y-auto p-1">
          {q && items.length === 0 && <Command.Empty className="text-mutedfg text-xs p-4">no results</Command.Empty>}
          {items.map(it => (
            <Command.Item key={it.id} value={it.label + " " + it.id}
              onSelect={() => { setOpen(false); router.push(it.href); }}
              className="flex justify-between rounded px-3 py-2 text-sm aria-selected:bg-accent/20 cursor-pointer">
              <span className="truncate">{it.label}</span>
              {it.hint && <span className="text-[10px] text-mutedfg">{it.hint}</span>}
            </Command.Item>
          ))}
        </Command.List>
        <div className="px-3 py-1.5 border-t border-border text-[10px] text-mutedfg flex justify-between">
          <span>⌘K to toggle · Esc to close</span>
          <span>↑↓ to navigate · Enter to open</span>
        </div>
      </Command>
    </div>
  );
}
