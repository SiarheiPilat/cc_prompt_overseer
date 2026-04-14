"use client";
import { useEffect, useState } from "react";
import { Star, Pencil, Check, X } from "lucide-react";

export function PlanMetaPanel({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [starred, setStarred] = useState(false);
  const [note, setNote] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoaded(false);
    fetch(`/api/plan-meta?slug=${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then(d => {
        setStarred(!!d.starred);
        setNote(d.note || "");
        try { const arr = d.tags ? JSON.parse(d.tags) : []; setTagsStr(Array.isArray(arr) ? arr.join(", ") : ""); } catch { setTagsStr(""); }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [slug]);

  async function persist(payload: Partial<{ starred: number; note: string; tags: string[] }>) {
    await fetch("/api/plan-meta", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, ...payload }),
    });
  }

  async function toggleStar() {
    const next = !starred;
    setStarred(next);
    await persist({ starred: next ? 1 : 0 });
  }

  async function save() {
    const tags = tagsStr.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
    await persist({ note, tags });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <button onClick={toggleStar} disabled={!loaded}
              title={starred ? "unstar this plan" : "star this plan"}
              className={`p-1.5 rounded hover:bg-muted/60 transition ${starred ? "text-yellow-300" : "text-mutedfg hover:text-fg"}`}>
        <Star className="h-4 w-4" fill={starred ? "currentColor" : "none"} />
      </button>
      <button onClick={() => setOpen(o => !o)}
              className="flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-muted/60 hover:text-accent transition"
              title="Add note + tags">
        <Pencil className="h-3.5 w-3.5" /> {note || tagsStr ? "annotated" : "annotate"}
      </button>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 flex justify-center items-start pt-16" onClick={() => setOpen(false)}>
          <div className="w-[min(560px,92vw)] bg-card border border-border rounded-lg shadow-2xl"
               onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-medium">Annotate plan</h3>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-muted/60"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs text-mutedfg">tags <span className="opacity-60">(comma-separated)</span></label>
                <input value={tagsStr} onChange={e => setTagsStr(e.target.value)}
                  className="w-full bg-muted rounded p-2 text-sm border border-border mt-1"
                  placeholder="e.g. canonical, reference, deprecated" />
              </div>
              <div>
                <label className="text-xs text-mutedfg">note</label>
                <textarea value={note} onChange={e => setNote(e.target.value)}
                  className="w-full bg-muted rounded p-2 text-sm border border-border mt-1" rows={4}
                  placeholder="why this plan matters, what you learned…" />
              </div>
              <button onClick={save}
                      className="bg-accent text-accentfg rounded px-3 py-1.5 text-sm hover:opacity-90 inline-flex items-center gap-1.5">
                {saved ? <Check className="h-3.5 w-3.5" /> : null}
                {saved ? "saved" : "save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
