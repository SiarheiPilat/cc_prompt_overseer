"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { PromptRow } from "@/lib/queries";
import { cn, fmtDate, truncate, basename } from "@/lib/utils";
import { StarButton } from "./StarButton";
import { PromptDetail } from "./PromptDetail";
import { Star, Eye, EyeOff, X } from "lucide-react";

export function PromptTable({ rows, allowUnhide = false }: { rows: PromptRow[]; allowUnhide?: boolean }) {
  const router = useRouter();
  const parentRef = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({
    count: rows.length, getScrollElement: () => parentRef.current,
    estimateSize: () => 56, overscan: 10,
  });
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const lastCheckedRef = useRef<number | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = selectedIdx != null ? rows[selectedIdx] : null;

  const idToRow = useMemo(() => {
    const m = new Map<number, PromptRow>();
    for (const r of rows) m.set(r.id, r);
    return m;
  }, [rows]);

  function go(delta: number) {
    if (!rows.length) return;
    const base = selectedIdx == null ? (delta > 0 ? -1 : rows.length) : selectedIdx;
    const next = Math.max(0, Math.min(rows.length - 1, base + delta));
    setSelectedIdx(next);
    try { v.scrollToIndex(next, { align: "center" }); } catch {}
  }

  function toggleAt(idx: number, withShift: boolean) {
    setChecked(prev => {
      const next = new Set(prev);
      const id = rows[idx].id;
      if (withShift && lastCheckedRef.current != null) {
        const a = Math.min(lastCheckedRef.current, idx);
        const b = Math.max(lastCheckedRef.current, idx);
        const setOn = !prev.has(id);
        for (let i = a; i <= b; i++) {
          const rid = rows[i].id;
          if (setOn) next.add(rid); else next.delete(rid);
        }
      } else {
        if (next.has(id)) next.delete(id); else next.add(id);
      }
      lastCheckedRef.current = idx;
      return next;
    });
  }

  function clearChecked() { setChecked(new Set()); lastCheckedRef.current = null; }
  function selectAllVisible() { setChecked(new Set(rows.map(r => r.id))); }

  async function bulk(action: "star" | "unstar" | "hide" | "unhide", value?: number) {
    const uuids = Array.from(checked).map(id => idToRow.get(id)?.uuid).filter((u): u is string => !!u);
    if (!uuids.length) return;
    setBusy(true);
    try {
      await fetch("/api/rate/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uuids, action, value }),
      });
      clearChecked();
      router.refresh();
    } catch {} finally { setBusy(false); }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || (t && t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); go(+1); }
      else if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); go(-1); }
      else if (e.key === "Home") { e.preventDefault(); setSelectedIdx(0); try { v.scrollToIndex(0); } catch {} }
      else if (e.key === "End") { e.preventDefault(); setSelectedIdx(rows.length - 1); try { v.scrollToIndex(rows.length - 1); } catch {} }
      else if (e.key === "x" && selectedIdx != null) { e.preventDefault(); toggleAt(selectedIdx, false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, selectedIdx]);

  return (
    <>
      {checked.size > 0 && (
        <div className="sticky top-0 z-20 -mt-2 mb-2 flex items-center gap-2 rounded-lg border border-accent/60 bg-accent/15 backdrop-blur px-3 py-2 text-sm">
          <span className="font-medium">{checked.size} selected</span>
          <button onClick={selectAllVisible} className="text-xs text-mutedfg hover:text-fg">all visible ({rows.length})</button>
          <div className="ml-auto flex items-center gap-1.5">
            <button disabled={busy} onClick={() => bulk("star")}
                    className="text-xs flex items-center gap-1 rounded bg-yellow-300/20 text-yellow-200 px-2 py-1 hover:bg-yellow-300/30 disabled:opacity-50">
              <Star className="h-3 w-3" /> star
            </button>
            <button disabled={busy} onClick={() => bulk("unstar")}
                    className="text-xs rounded border border-border px-2 py-1 hover:bg-muted/60 disabled:opacity-50">unstar</button>
            <button disabled={busy} onClick={() => bulk("hide")}
                    className="text-xs flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-muted/60 disabled:opacity-50">
              <EyeOff className="h-3 w-3" /> hide
            </button>
            {allowUnhide && (
              <button disabled={busy} onClick={() => bulk("unhide")}
                      className="text-xs flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-muted/60 disabled:opacity-50">
                <Eye className="h-3 w-3" /> unhide
              </button>
            )}
            <button onClick={clearChecked}
                    className="text-xs flex items-center gap-1 rounded text-mutedfg hover:text-fg px-2 py-1">
              <X className="h-3 w-3" /> clear
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card/60">
        <div className="grid grid-cols-[28px_140px_170px_1fr_80px_70px_60px_40px] text-xs text-mutedfg border-b border-border px-3 py-2 sticky top-0 z-10 bg-card/80 backdrop-blur">
          <div></div>
          <div>time</div><div>project</div><div>preview <span className="text-[10px] opacity-60">· j/k nav · x toggle · shift-click range</span></div><div>length</div><div>slash</div><div>plan</div><div></div>
        </div>
        <div ref={parentRef} className="overflow-y-auto" style={{ height: "calc(100vh - 260px)" }}>
          <div style={{ height: v.getTotalSize(), position: "relative" }}>
            {v.getVirtualItems().map(vi => {
              const r = rows[vi.index];
              const isSel = selectedIdx === vi.index;
              const isChk = checked.has(r.id);
              return (
                <div key={r.id}
                  onClick={() => setSelectedIdx(vi.index)}
                  className={cn(
                    "grid grid-cols-[28px_140px_170px_1fr_80px_70px_60px_40px] items-center px-3 text-sm border-b border-border/60 hover:bg-muted/40 cursor-pointer",
                    isSel && "bg-accent/10 ring-1 ring-accent/60",
                    isChk && !isSel && "bg-accent/5"
                  )}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: vi.size, transform: `translateY(${vi.start}px)` }}>
                  <div onClick={e => e.stopPropagation()} className="flex justify-center">
                    <input type="checkbox" checked={isChk}
                           onChange={(e: any) => toggleAt(vi.index, !!e.nativeEvent.shiftKey)}
                           onClick={(e: any) => { if (e.shiftKey) { e.preventDefault(); toggleAt(vi.index, true); } }}
                           className="cursor-pointer" />
                  </div>
                  <div className="text-xs text-mutedfg tabular-nums">{fmtDate(r.ts)}</div>
                  <div className="text-xs truncate text-mutedfg">{basename(r.cwd || "")}</div>
                  <div className="truncate font-mono text-[12px]">{truncate((r.text || "").replace(/\s+/g, " "), 220)}</div>
                  <div className="text-xs tabular-nums text-mutedfg">{r.char_count}</div>
                  <div className="text-xs">{r.is_slash ? <span className="text-accent">/{r.slash_name}</span> : ""}</div>
                  <div className="text-xs">{r.has_plan ? "✓" : ""}</div>
                  <div onClick={e => e.stopPropagation()}><StarButton uuid={r.uuid} initial={!!r.starred} /></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {selected && (
        <PromptDetail
          prompt={selected}
          onClose={() => setSelectedIdx(null)}
          onPrev={selectedIdx! > 0 ? () => go(-1) : undefined}
          onNext={selectedIdx! < rows.length - 1 ? () => go(+1) : undefined}
          position={{ index: selectedIdx!, total: rows.length }}
        />
      )}
    </>
  );
}
