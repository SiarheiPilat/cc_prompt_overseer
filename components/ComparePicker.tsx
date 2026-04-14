"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ComparePicker({ candidates, initialA, initialB }: { candidates: any[]; initialA: string; initialB: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [a, setA] = useState(initialA);
  const [b, setB] = useState(initialB);
  function go() {
    const p = new URLSearchParams();
    if (a) p.set("a", a);
    if (b) p.set("b", b);
    start(() => router.push(`/compare?${p.toString()}`));
  }
  function swap() {
    setA(b); setB(a);
    const p = new URLSearchParams();
    if (b) p.set("a", b);
    if (a) p.set("b", a);
    start(() => router.push(`/compare?${p.toString()}`));
  }
  return (
    <div className="flex flex-wrap gap-2 items-center rounded-lg border border-border bg-card/60 p-3">
      <SessionSelect label="A" value={a} onChange={setA} candidates={candidates} />
      <button onClick={swap} className="px-2 py-1.5 rounded border border-border text-xs hover:bg-muted/60" title="swap">↔</button>
      <SessionSelect label="B" value={b} onChange={setB} candidates={candidates} />
      <button disabled={pending || !a || !b} onClick={go}
              className="bg-accent text-accentfg rounded px-3 py-1.5 text-sm hover:opacity-90 disabled:opacity-50">
        {pending ? "…" : "compare"}
      </button>
    </div>
  );
}

function SessionSelect({ label, value, onChange, candidates }: { label: string; value: string; onChange: (v: string) => void; candidates: any[] }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-mutedfg w-5">{label}</span>
      <select className="bg-muted rounded px-2 py-1.5 text-sm min-w-[280px] max-w-[380px]"
              value={value} onChange={e => onChange(e.target.value)}>
        <option value="">pick a session…</option>
        {candidates.map(s => {
          const d = s.started_at ? new Date(s.started_at).toISOString().slice(0, 10) : "????-??-??";
          const proj = (s.cwd || "").split(/[\\/]/).slice(-2).join("/");
          const label = `${d} · ${s.slug || s.id.slice(0, 8)} · ${proj} (${s.turn_count}t)`;
          return <option key={s.id} value={s.id}>{label}</option>;
        })}
      </select>
    </div>
  );
}
