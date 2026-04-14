import Link from "next/link";
import { sessionStats, sessionCandidates } from "@/lib/queries";
import { fmtDate, truncate, basename } from "@/lib/utils";
import { fmtTokens, fmtCost, costUSD } from "@/lib/pricing";
import { computeBursts, burstSummary, fmtDuration } from "@/lib/bursts";
import { ComparePicker } from "@/components/ComparePicker";

export const dynamic = "force-dynamic";

export default async function ComparePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const a = sp.a || "";
  const b = sp.b || "";
  const candidates = sessionCandidates();
  const sa = a ? sessionStats(a) : null;
  const sb = b ? sessionStats(b) : null;

  return (
    <div className="p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Compare sessions</h1>
        <p className="text-sm text-mutedfg">Pick any two sessions to see them side by side.</p>
      </header>
      <ComparePicker candidates={candidates} initialA={a} initialB={b} />

      {sa && sb && (
        <>
          <section className="rounded-lg border border-border bg-card/60 p-4">
            <h2 className="text-sm font-medium mb-3">At a glance</h2>
            <DiffGrid sa={sa} sb={sb} />
          </section>

          <div className="grid lg:grid-cols-2 gap-4 items-start">
            <SessionColumn side="A" data={sa} />
            <SessionColumn side="B" data={sb} />
          </div>

          <OverlapSection sa={sa} sb={sb} />
        </>
      )}

      {(!sa || !sb) && (
        <div className="rounded-lg border border-border bg-card/60 p-6 text-sm text-mutedfg">
          Pick two sessions above to compare. You can also link directly: <code>/compare?a=sessionId&amp;b=sessionId</code>
        </div>
      )}
    </div>
  );
}

function DiffGrid({ sa, sb }: { sa: any; sb: any }) {
  const rows: Array<{ label: string; a: string; b: string; aNum?: number; bNum?: number }> = [
    { label: "Started", a: fmtDate(sa.session.started_at), b: fmtDate(sb.session.started_at) },
    { label: "Duration", a: fmtDuration((sa.session.ended_at || 0) - (sa.session.started_at || 0)), b: fmtDuration((sb.session.ended_at || 0) - (sb.session.started_at || 0)) },
    { label: "Prompts", a: String(sa.prompts.length), b: String(sb.prompts.length), aNum: sa.prompts.length, bNum: sb.prompts.length },
    { label: "Turn count", a: String(sa.session.turn_count || 0), b: String(sb.session.turn_count || 0), aNum: sa.session.turn_count || 0, bNum: sb.session.turn_count || 0 },
    { label: "Output tokens", a: fmtTokens(sa.tokens.output || 0), b: fmtTokens(sb.tokens.output || 0), aNum: sa.tokens.output || 0, bNum: sb.tokens.output || 0 },
    { label: "Cache read", a: fmtTokens(sa.tokens.cache_read || 0), b: fmtTokens(sb.tokens.cache_read || 0), aNum: sa.tokens.cache_read || 0, bNum: sb.tokens.cache_read || 0 },
    { label: "Est. cost", a: fmtCost(costUSD(sa.tokens.model, sa.tokens.input || 0, sa.tokens.output || 0, sa.tokens.cache_creation || 0, sa.tokens.cache_read || 0)), b: fmtCost(costUSD(sb.tokens.model, sb.tokens.input || 0, sb.tokens.output || 0, sb.tokens.cache_creation || 0, sb.tokens.cache_read || 0)) },
    { label: "Model", a: sa.tokens.model || "?", b: sb.tokens.model || "?" },
    { label: "Tools used", a: String(sa.tools.length), b: String(sb.tools.length), aNum: sa.tools.length, bNum: sb.tools.length },
    { label: "Plan", a: sa.plan?.title || "—", b: sb.plan?.title || "—" },
  ];
  return (
    <div className="grid grid-cols-[140px_1fr_1fr] gap-x-4 gap-y-1 text-sm">
      <div className="text-xs text-mutedfg">metric</div>
      <div className="text-xs text-mutedfg">A</div>
      <div className="text-xs text-mutedfg">B</div>
      {rows.map(r => {
        let hiA = "", hiB = "";
        if (r.aNum != null && r.bNum != null && r.aNum !== r.bNum) {
          if (r.aNum > r.bNum) hiA = "text-accent font-medium";
          else hiB = "text-accent font-medium";
        }
        return (
          <>
            <div key={`${r.label}-l`} className="text-mutedfg text-xs self-center">{r.label}</div>
            <div key={`${r.label}-a`} className={`tabular-nums ${hiA}`}>{r.a}</div>
            <div key={`${r.label}-b`} className={`tabular-nums ${hiB}`}>{r.b}</div>
          </>
        );
      })}
    </div>
  );
}

function SessionColumn({ side, data }: { side: string; data: any }) {
  const bursts = computeBursts(data.prompts.map((p: any) => p.ts));
  const burst = burstSummary(bursts, data.session.started_at, data.session.ended_at);
  return (
    <div className="rounded-lg border border-border bg-card/60 p-4 space-y-3 min-w-0">
      <header>
        <div className="text-[10px] uppercase tracking-wide text-mutedfg">Session {side}</div>
        <h3 className="text-base font-semibold truncate">
          <Link className="text-accent hover:underline" href={`/sessions/${data.session.id}`}>{data.session.slug || data.session.id.slice(0, 12)}</Link>
        </h3>
        <div className="text-xs text-mutedfg truncate">{data.session.cwd || ""}</div>
        <div className="text-xs text-mutedfg mt-0.5">
          {burst.count} bursts · active {fmtDuration(burst.activeMs)} / wall {fmtDuration(burst.wallMs)} · focus {(burst.activeRatio * 100).toFixed(0)}%
        </div>
      </header>
      <div className="flex flex-wrap gap-1 text-[11px]">
        {data.cats.slice(0, 8).map(([c, n]: any) => (
          <span key={c} className="rounded border border-border px-1.5 py-0.5"><span className="text-mutedfg">{c}</span> {n}</span>
        ))}
      </div>
      <div className="flex flex-wrap gap-1 text-[11px]">
        {data.tools.slice(0, 10).map(([t, n]: any) => (
          <span key={t} className="rounded bg-muted px-1.5 py-0.5"><span className="text-accent">{t}</span> <span className="text-mutedfg">{n}</span></span>
        ))}
      </div>
      <ul className="space-y-1 max-h-[480px] overflow-y-auto">
        {data.prompts.slice(0, 50).map((p: any) => (
          <li key={p.id}>
            <Link href={`/sessions/${data.session.id}#p${p.id}`}
              className="block rounded px-2 py-1 hover:bg-muted/60 text-xs font-mono border border-transparent hover:border-border">
              <span className="text-[10px] text-mutedfg tabular-nums mr-2">{fmtDate(p.ts).slice(11, 16)}</span>
              {p.is_slash && <span className="text-accent mr-1">/{p.slash_name}</span>}
              <span className="line-clamp-2">{truncate((p.text || "").replace(/\s+/g, " "), 200)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OverlapSection({ sa, sb }: { sa: any; sb: any }) {
  const aTools = new Set(sa.tools.map(([t]: any) => t));
  const bTools = new Set(sb.tools.map(([t]: any) => t));
  const shared = Array.from(aTools).filter((t: any) => bTools.has(t));
  const onlyA = Array.from(aTools).filter((t: any) => !bTools.has(t));
  const onlyB = Array.from(bTools).filter((t: any) => !aTools.has(t));
  const aCats = new Set(sa.cats.map(([c]: any) => c));
  const bCats = new Set(sb.cats.map(([c]: any) => c));
  const sharedCats = Array.from(aCats).filter((c: any) => bCats.has(c));
  return (
    <section className="rounded-lg border border-border bg-card/60 p-4">
      <h2 className="text-sm font-medium mb-3">Overlap</h2>
      <div className="grid md:grid-cols-3 gap-4 text-sm">
        <Block title={`Shared tools (${shared.length})`} items={shared as string[]} />
        <Block title={`Only in A (${onlyA.length})`} items={onlyA as string[]} />
        <Block title={`Only in B (${onlyB.length})`} items={onlyB as string[]} />
      </div>
      <div className="mt-4 text-xs text-mutedfg">
        shared categories: {sharedCats.join(", ") || "none"}
      </div>
    </section>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs text-mutedfg mb-1">{title}</div>
      <div className="flex flex-wrap gap-1">
        {items.length === 0 && <span className="text-mutedfg text-xs">—</span>}
        {items.map(i => <span key={i} className="text-[11px] rounded bg-muted px-1.5 py-0.5">{i}</span>)}
      </div>
    </div>
  );
}
