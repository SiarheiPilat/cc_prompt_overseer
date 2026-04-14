import Link from "next/link";
import { searchFTS, searchPlans } from "@/lib/queries";
import { fmtDate, fmtRelative, basename, truncate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = sp.q || "";
  const promptHits = q ? (searchFTS(q, 200) as any[]) : [];
  const planHits = q ? (searchPlans(q, 30) as any[]) : [];

  return (
    <div className="p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Search</h1>
        <p className="text-sm text-mutedfg">Full-text across every prompt (SQLite FTS5 · BM25), plus LIKE-search across plans.</p>
      </header>
      <form className="flex gap-2">
        <input name="q" defaultValue={q} autoFocus
               className="flex-1 bg-muted rounded px-3 py-2 text-sm outline-none border border-transparent focus:border-accent/60"
               placeholder="search prompts and plans…" />
        <button className="bg-accent text-accentfg rounded px-4 py-2 text-sm">search</button>
      </form>

      {q && (
        <div className="text-xs text-mutedfg">
          {promptHits.length} prompt hits · {planHits.length} plan hits for <span className="text-fg">"{q}"</span>
        </div>
      )}

      {planHits.length > 0 && (
        <section className="rounded-lg border border-border bg-card/60 p-3">
          <h2 className="text-sm font-medium mb-2">Plans ({planHits.length})</h2>
          <ul className="space-y-1">
            {planHits.map((p: any) => (
              <li key={p.slug}>
                <Link href={`/plans/${encodeURIComponent(p.slug)}`}
                  className="block rounded p-2 hover:bg-muted/40 border border-transparent hover:border-border">
                  <div className="text-xs text-mutedfg flex gap-2">
                    <span>{fmtRelative(p.mtime)}</span>
                    <span>· {p.word_count} w</span>
                    <span className="ml-auto truncate">{p.slug}</span>
                  </div>
                  <div className="text-sm font-medium mt-0.5">{p.title}</div>
                  {p.snippet && (
                    <div className="text-[11px] text-mutedfg mt-0.5 italic line-clamp-2">{truncate((p.snippet || "").replace(/\s+/g," "), 240)}</div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {promptHits.length > 0 && (
        <section className="rounded-lg border border-border bg-card/60 p-3">
          <h2 className="text-sm font-medium mb-2">Prompts ({promptHits.length})</h2>
          <ul className="space-y-1">
            {promptHits.map((r: any) => (
              <li key={r.id}>
                <Link href={`/sessions/${r.session_id}#p${r.id}`}
                  className="block rounded px-3 py-2 hover:bg-muted/40 border border-transparent hover:border-border">
                  <div className="text-xs text-mutedfg flex gap-2">
                    <span>{fmtDate(r.ts)}</span>
                    <span className="truncate">· {basename(r.cwd || "")}</span>
                    <span className="ml-auto">{r.char_count} ch</span>
                  </div>
                  <div className="text-sm mt-0.5" dangerouslySetInnerHTML={{ __html: r.snippet }} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {q && promptHits.length === 0 && planHits.length === 0 && (
        <div className="rounded-lg border border-border bg-card/60 p-6 text-sm text-mutedfg text-center">
          No results.
        </div>
      )}
    </div>
  );
}
