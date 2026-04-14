"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const LS_KEY = "cc-overseer/prompts-filter";

export function FilterBar({
  projects, initial,
}: {
  projects: any[];
  initial: { q: string; project: string; slash: boolean; starred: boolean; hasPlan: boolean; showHidden?: boolean; onlyHidden?: boolean; minLen?: number; orderBy: string; dir: string; limit: number; permissionMode?: string; model?: string };
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(initial.q);
  const [project, setProject] = useState(initial.project);
  const [slash, setSlash] = useState(initial.slash);
  const [starred, setStarred] = useState(initial.starred);
  const [hasPlan, setHasPlan] = useState(initial.hasPlan);
  const [permissionMode, setPermissionMode] = useState(initial.permissionMode || "");
  const [model, setModel] = useState(initial.model || "");
  const [showHidden, setShowHidden] = useState(!!initial.showHidden);
  const [onlyHidden, setOnlyHidden] = useState(!!initial.onlyHidden);
  const [minLen, setMinLen] = useState<string>(initial.minLen ? String(initial.minLen) : "");
  const [orderBy, setOrderBy] = useState(initial.orderBy);
  const [dir, setDir] = useState(initial.dir);
  const [limit, setLimit] = useState(String(initial.limit));
  const restored = useRef(false);

  // On first mount: if no query params set, restore last-used filters
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (typeof window === "undefined") return;
    const hasAny = Array.from(sp.keys()).length > 0;
    if (hasAny) return;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      const urlParams = new URLSearchParams();
      for (const [k, v] of Object.entries(saved)) {
        if (v == null || v === "" || v === false) continue;
        if (k === "orderBy" && v === "ts") continue;
        if (k === "dir" && v === "desc") continue;
        if (k === "limit" && String(v) === "500") continue;
        urlParams.set(k, typeof v === "boolean" ? "1" : String(v));
      }
      if (urlParams.toString()) {
        router.replace(`/prompts?${urlParams.toString()}`);
      }
    } catch {}
  }, [router, sp]);

  function buildUrl(): string {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (project) p.set("project", project);
    if (slash) p.set("slash", "1");
    if (starred) p.set("starred", "1");
    if (hasPlan) p.set("hasPlan", "1");
    if (permissionMode) p.set("perm", permissionMode);
    if (model) p.set("model", model);
    if (showHidden) p.set("showHidden", "1");
    if (onlyHidden) p.set("onlyHidden", "1");
    if (minLen) p.set("minLen", minLen);
    if (orderBy !== "ts") p.set("orderBy", orderBy);
    if (dir !== "desc") p.set("dir", dir);
    if (limit && limit !== "500") p.set("limit", limit);
    // preserve other params not managed here (cat, from, to)
    for (const k of ["cat", "from", "to"]) {
      const v = sp.get(k);
      if (v) p.set(k, v);
    }
    return `/prompts?${p.toString()}`;
  }

  function persist() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        q, project, slash, starred, hasPlan, permissionMode, model, minLen, orderBy, dir, limit,
      }));
    } catch {}
  }

  function apply() {
    persist();
    start(() => router.push(buildUrl()));
  }

  function clearAll() {
    try { localStorage.removeItem(LS_KEY); } catch {}
    setQ(""); setProject(""); setSlash(false); setStarred(false); setHasPlan(false);
    setPermissionMode(""); setModel("");
    setMinLen(""); setOrderBy("ts"); setDir("desc"); setLimit("500");
    start(() => router.push("/prompts"));
  }

  function applyRange(days: number) {
    persist();
    const p = new URLSearchParams(buildUrl().split("?")[1] || "");
    if (days <= 0) {
      p.delete("from"); p.delete("to");
    } else {
      const now = Date.now();
      p.set("from", String(now - days * 86400000));
      p.set("to", String(now));
    }
    start(() => router.push(`/prompts?${p.toString()}`));
  }

  const fromParam = sp.get("from");
  const toParam = sp.get("to");
  const dateRangeActive = !!fromParam || !!toParam;

  const hasActive = q || project || slash || starred || hasPlan || permissionMode || model || minLen || orderBy !== "ts" || dir !== "desc" || (limit && limit !== "500");

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/60 p-3">
      <input className="bg-muted rounded px-2 py-1.5 text-sm w-64 outline-none border border-transparent focus:border-accent/60"
             placeholder="search (FTS)…" value={q} onChange={e => setQ(e.target.value)}
             onKeyDown={e => e.key === "Enter" && apply()} />
      <select className="bg-muted rounded px-2 py-1.5 text-sm" value={project} onChange={e => setProject(e.target.value)}>
        <option value="">all projects</option>
        {projects.map((p: any) => <option key={p.id} value={p.id}>{p.cwd || p.id}</option>)}
      </select>
      <label className="text-xs flex items-center gap-1.5 px-2 py-1 rounded bg-muted cursor-pointer">
        <input type="checkbox" checked={slash} onChange={e => setSlash(e.target.checked)} />slash only
      </label>
      <label className="text-xs flex items-center gap-1.5 px-2 py-1 rounded bg-muted cursor-pointer">
        <input type="checkbox" checked={starred} onChange={e => setStarred(e.target.checked)} />starred
      </label>
      <label className="text-xs flex items-center gap-1.5 px-2 py-1 rounded bg-muted cursor-pointer">
        <input type="checkbox" checked={hasPlan} onChange={e => setHasPlan(e.target.checked)} />has plan
      </label>
      <select className="bg-muted rounded px-2 py-1.5 text-sm" value={permissionMode} onChange={e => setPermissionMode(e.target.value)} title="filter by session permission mode">
        <option value="">any perm</option>
        <option value="default">default</option>
        <option value="acceptEdits">acceptEdits</option>
        <option value="bypassPermissions">bypassPermissions</option>
        <option value="plan">plan</option>
      </select>
      <select className="bg-muted rounded px-2 py-1.5 text-sm" value={model} onChange={e => setModel(e.target.value)} title="filter by model family">
        <option value="">any model</option>
        <option value="opus">opus</option>
        <option value="sonnet">sonnet</option>
        <option value="haiku">haiku</option>
      </select>
      <label className="text-xs flex items-center gap-1.5 px-2 py-1 rounded bg-muted cursor-pointer" title="include prompts you've hidden">
        <input type="checkbox" checked={showHidden} onChange={e => { setShowHidden(e.target.checked); if (e.target.checked) setOnlyHidden(false); }} />show hidden
      </label>
      <label className="text-xs flex items-center gap-1.5 px-2 py-1 rounded bg-muted cursor-pointer" title="show only hidden prompts (so you can unhide)">
        <input type="checkbox" checked={onlyHidden} onChange={e => { setOnlyHidden(e.target.checked); if (e.target.checked) setShowHidden(false); }} />only hidden
      </label>
      <input className="bg-muted rounded px-2 py-1.5 text-sm w-24" placeholder="min len"
             value={minLen} onChange={e => setMinLen(e.target.value)} />
      <select className="bg-muted rounded px-2 py-1.5 text-sm" value={orderBy} onChange={e => setOrderBy(e.target.value)}>
        <option value="ts">by time</option>
        <option value="char_count">by length</option>
        <option value="interest">by interest</option>
        <option value="session_id">by session</option>
      </select>
      <select className="bg-muted rounded px-2 py-1.5 text-sm" value={dir} onChange={e => setDir(e.target.value)}>
        <option value="desc">desc</option>
        <option value="asc">asc</option>
      </select>
      <select className="bg-muted rounded px-2 py-1.5 text-sm" value={limit} onChange={e => setLimit(e.target.value)}>
        <option value="200">200</option>
        <option value="500">500</option>
        <option value="1000">1000</option>
        <option value="2000">2000</option>
      </select>
      <button disabled={pending} onClick={apply}
              className="bg-accent text-accentfg rounded px-3 py-1.5 text-sm hover:opacity-90 disabled:opacity-50">
        {pending ? "…" : "apply"}
      </button>
      {hasActive && (
        <button onClick={clearAll}
                className="text-xs text-mutedfg hover:text-fg px-2 py-1 rounded border border-border hover:bg-muted/60"
                title="reset filters and clear saved state">
          clear
        </button>
      )}
      <span className="text-[10px] text-mutedfg ml-2">date:</span>
      <button onClick={() => applyRange(1)} className="text-[11px] rounded border border-border px-2 py-0.5 hover:bg-muted/60 hover:text-accent" title="last 24h">24h</button>
      <button onClick={() => applyRange(7)} className="text-[11px] rounded border border-border px-2 py-0.5 hover:bg-muted/60 hover:text-accent" title="last 7 days">7d</button>
      <button onClick={() => applyRange(30)} className="text-[11px] rounded border border-border px-2 py-0.5 hover:bg-muted/60 hover:text-accent" title="last 30 days">30d</button>
      {dateRangeActive && (
        <button onClick={() => applyRange(0)} className="text-[11px] rounded border border-border px-2 py-0.5 hover:bg-muted/60 text-mutedfg" title="clear date range">all time</button>
      )}
      <div className="ml-auto flex items-center gap-1">
        <SaveButton getQuery={() => buildUrl().split("?")[1] || ""} />
        <span className="text-[10px] text-mutedfg ml-2">export:</span>
        {(["md","csv","json"] as const).map(fmt => (
          <a key={fmt} href={exportUrl(fmt, { q, project, slash, starred, hasPlan, minLen, orderBy, dir, limit, sp })}
             className="text-[11px] rounded border border-border px-2 py-0.5 hover:bg-muted/60 hover:text-accent"
             title={`download current filter as .${fmt}`}>
            {fmt}
          </a>
        ))}
      </div>
    </div>
  );
}

function SaveButton({ getQuery }: { getQuery: () => string }) {
  async function save() {
    const q = getQuery();
    if (!q) { alert("Apply some filters first."); return; }
    const name = window.prompt("Save this search as:");
    if (!name) return;
    const r = await fetch("/api/playlists", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, query: q }),
    });
    if (r.ok) {
      try { window.dispatchEvent(new Event("playlist-bump")); } catch {}
    } else {
      alert("Save failed.");
    }
  }
  return (
    <button onClick={save}
            className="text-[11px] rounded border border-border px-2 py-0.5 hover:bg-muted/60 hover:text-accent"
            title="save current filter set">
      ☆ save
    </button>
  );
}

function exportUrl(format: string, s: any): string {
  const p = new URLSearchParams();
  p.set("format", format);
  if (s.q) p.set("q", s.q);
  if (s.project) p.set("project", s.project);
  if (s.slash) p.set("slash", "1");
  if (s.starred) p.set("starred", "1");
  if (s.hasPlan) p.set("hasPlan", "1");
  if (s.minLen) p.set("minLen", s.minLen);
  if (s.orderBy !== "ts") p.set("orderBy", s.orderBy);
  if (s.dir !== "desc") p.set("dir", s.dir);
  if (s.limit && s.limit !== "500") p.set("limit", s.limit);
  for (const k of ["cat", "from", "to"]) {
    const v = s.sp?.get?.(k);
    if (v) p.set(k, v);
  }
  return `/api/export?${p.toString()}`;
}
