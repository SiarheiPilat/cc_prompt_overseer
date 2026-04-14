import Link from "next/link";
import { searchFTS } from "@/lib/queries";
import { fmtDate, basename } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = sp.q || "";
  const results = q ? (searchFTS(q, 200) as any[]) : [];

  return (
    <div className="p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Search</h1>
        <p className="text-sm text-mutedfg">Full-text across every prompt (SQLite FTS5 · BM25).</p>
      </header>
      <form className="flex gap-2">
        <input name="q" defaultValue={q} autoFocus
               className="flex-1 bg-muted rounded px-3 py-2 text-sm outline-none border border-transparent focus:border-accent/60"
               placeholder="search your prompt history…" />
        <button className="bg-accent text-accentfg rounded px-4 py-2 text-sm">search</button>
      </form>
      {q && (
        <div className="text-xs text-mutedfg">{results.length} hits for <span className="text-fg">"{q}"</span></div>
      )}
      <ul className="space-y-1">
        {results.map((r: any) => (
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
    </div>
  );
}
