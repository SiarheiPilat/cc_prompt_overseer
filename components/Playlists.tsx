"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, Trash2 } from "lucide-react";

type Playlist = { id: number; name: string; query: string; created_at: number };

export function Playlists() {
  const [list, setList] = useState<Playlist[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    try {
      const r = await fetch("/api/playlists");
      const j = await r.json();
      setList(j.playlists || []);
    } catch {}
  }

  useEffect(() => {
    load();
    const onStorage = (e: StorageEvent) => { if (e.key === "cc-overseer/playlist-bump") load(); };
    window.addEventListener("storage", onStorage);
    const onBump = () => load();
    window.addEventListener("playlist-bump", onBump as any);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("playlist-bump", onBump as any);
    };
  }, []);

  async function remove(id: number, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm("Delete this saved search?")) return;
    await fetch(`/api/playlists?id=${id}`, { method: "DELETE" });
    load();
  }

  if (list.length === 0) return null;

  return (
    <div className="px-2 pt-2 pb-1 border-t border-border">
      <button onClick={() => setOpen(o => !o)}
              className="w-full flex items-center gap-2 px-3 py-1 text-[11px] uppercase tracking-wide text-mutedfg hover:text-fg">
        <Bookmark className="h-3 w-3" />
        Saved ({list.length}) {open ? "▾" : "▸"}
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5">
          {list.map(p => (
            <li key={p.id} className="group">
              <Link href={`/prompts?${p.query}`}
                    className="flex items-center gap-2 rounded px-3 py-1 text-xs text-mutedfg hover:text-fg hover:bg-muted/50 transition">
                <span className="flex-1 truncate">{p.name}</span>
                <button onClick={e => remove(p.id, e)}
                        className="opacity-0 group-hover:opacity-100 text-mutedfg hover:text-red-400 transition"
                        title="delete">
                  <Trash2 className="h-3 w-3" />
                </button>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
