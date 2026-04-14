"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { X, ChevronUp, ChevronDown } from "lucide-react";
import type { PromptRow } from "@/lib/queries";
import { fmtDate, truncate, basename } from "@/lib/utils";
import { StarButton } from "./StarButton";

type SimilarRow = { id: number; uuid: string | null; session_id: string; ts: number; score: number; text: string; cwd: string | null };

function parseTagsToStr(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.join(", ");
  } catch {}
  return "";
}

export function PromptDetail({
  prompt, onClose, onPrev, onNext, position,
}: {
  prompt: PromptRow;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  position?: { index: number; total: number };
}) {
  const [note, setNote] = useState(prompt.note || "");
  const [rating, setRating] = useState(prompt.rating || 0);
  const [tagsStr, setTagsStr] = useState(parseTagsToStr(prompt.tags));
  const [saved, setSaved] = useState(false);
  const [similar, setSimilar] = useState<SimilarRow[] | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  // The prompt.text we receive from /prompts is truncated to 300 chars.
  // If the full text is longer we lazy-fetch it when the panel opens.
  const previewLen = prompt.text?.length || 0;
  const needsFull = prompt.char_count > previewLen;
  const [fullText, setFullText] = useState<string | null>(needsFull ? null : prompt.text);

  useEffect(() => {
    setNote(prompt.note || "");
    setRating(prompt.rating || 0);
    setTagsStr(parseTagsToStr(prompt.tags));
    setSaved(false);
    setSimilar(null);
    // Reset text — if prompt was truncated, fetch full; else use as-is
    const needs = prompt.char_count > (prompt.text?.length || 0);
    setFullText(needs ? null : prompt.text);
    if (needs) {
      fetch(`/api/prompt?id=${prompt.id}`)
        .then(r => r.json())
        .then(j => { if (j && typeof j.text === "string") setFullText(j.text); })
        .catch(() => setFullText(prompt.text)); // fall back to truncated preview on error
    }
    if (!prompt.uuid) return;
    const ctrl = new AbortController();
    setSimLoading(true);
    fetch(`/api/similar?uuid=${encodeURIComponent(prompt.uuid)}&limit=5`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(j => setSimilar(j.results || []))
      .catch(() => {})
      .finally(() => setSimLoading(false));
    return () => ctrl.abort();
  }, [prompt.id, prompt.uuid]);

  async function save() {
    if (!prompt.uuid) return;
    const tags = tagsStr.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
    await fetch("/api/rate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ uuid: prompt.uuid, note, rating, tags }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex justify-end" onClick={onClose}>
      <aside className="w-[min(680px,95vw)] h-full bg-card border-l border-border overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-card">
          <div className="text-xs text-mutedfg tabular-nums flex items-center gap-3">
            <span>{fmtDate(prompt.ts)} · {prompt.char_count} ch · {prompt.word_count} w</span>
            {position && <span className="text-[11px]">{position.index + 1} / {position.total}</span>}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onPrev} disabled={!onPrev} title="prev (k or ↑)"
                    className="p-1 rounded hover:bg-muted/60 disabled:opacity-30 disabled:hover:bg-transparent">
              <ChevronUp className="h-4 w-4" />
            </button>
            <button onClick={onNext} disabled={!onNext} title="next (j or ↓)"
                    className="p-1 rounded hover:bg-muted/60 disabled:opacity-30 disabled:hover:bg-transparent">
              <ChevronDown className="h-4 w-4" />
            </button>
            <StarButton uuid={prompt.uuid} initial={!!prompt.starred} />
            <button onClick={onClose} className="p-1 rounded hover:bg-muted/60" title="close (Esc)"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="text-xs text-mutedfg space-x-3">
            <span>cwd: <span className="text-fg">{prompt.cwd || "?"}</span></span>
            {prompt.is_slash && <span>slash: <span className="text-accent">/{prompt.slash_name}</span></span>}
            {prompt.slug && <span>slug: <span className="text-fg">{prompt.slug}</span></span>}
            {prompt.has_plan ? <Link className="text-accent hover:underline" href={`/plans/${encodeURIComponent(prompt.slug!)}`}>plan →</Link> : null}
          </div>
          <Link className="text-sm text-accent hover:underline" href={`/sessions/${prompt.session_id}#p${prompt.id}`}>
            open session →
          </Link>
          <pre className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed bg-muted/60 rounded p-3 border border-border">
            {fullText ?? (prompt.text + "…")}
          </pre>
          {fullText === null && <div className="text-[10px] text-mutedfg -mt-2">loading full text…</div>}
          <div className="flex items-center gap-2">
            <span className="text-xs text-mutedfg w-14">rate</span>
            {[1,2,3,4,5].map(n => (
              <button key={n} onClick={() => setRating(rating === n ? 0 : n)}
                      className={`w-7 h-7 rounded border ${rating >= n ? "bg-accent text-accentfg border-accent" : "border-border text-mutedfg"}`}>
                {n}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs text-mutedfg">tags <span className="opacity-60">(comma-separated)</span></label>
            <input value={tagsStr} onChange={e => setTagsStr(e.target.value)}
              className="w-full bg-muted rounded p-2 text-sm border border-border"
              placeholder="e.g. interesting, devloop, bug-report" />
          </div>
          <div>
            <label className="text-xs text-mutedfg">note</label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              className="w-full bg-muted rounded p-2 text-sm border border-border" rows={3}
              placeholder="your thoughts about this prompt…" />
          </div>
          <button onClick={save} className="bg-accent text-accentfg rounded px-3 py-1.5 text-sm hover:opacity-90">
            {saved ? "saved ✓" : "save"}
          </button>

          <div className="pt-3 border-t border-border">
            <div className="text-xs text-mutedfg mb-2">
              similar prompts {simLoading && <span>· computing…</span>}
            </div>
            {similar && similar.length === 0 && (
              <div className="text-[11px] text-mutedfg">no close matches found</div>
            )}
            {similar && similar.length > 0 && (
              <ul className="space-y-1">
                {similar.map(s => (
                  <li key={s.id}>
                    <Link href={`/sessions/${s.session_id}#p${s.id}`}
                      className="block rounded p-2 hover:bg-muted/60 border border-transparent hover:border-border">
                      <div className="flex items-baseline gap-2 text-[10px] text-mutedfg">
                        <span className="text-accent tabular-nums">{(s.score * 100).toFixed(0)}%</span>
                        <span>{fmtDate(s.ts)}</span>
                        <span className="truncate">· {basename(s.cwd || "")}</span>
                      </div>
                      <div className="text-[12px] font-mono mt-0.5 line-clamp-2">{truncate((s.text || "").replace(/\s+/g, " "), 240)}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
