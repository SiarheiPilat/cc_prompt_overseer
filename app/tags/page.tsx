import Link from "next/link";
import { tagCounts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function TagsPage() {
  const tags = tagCounts();
  if (tags.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <header>
          <h1 className="text-2xl font-semibold">Tags</h1>
          <p className="text-sm text-mutedfg">Free-form tags you add to prompts. Open any prompt detail and use the "tags" field.</p>
        </header>
        <div className="rounded-lg border border-border bg-card/60 p-6 text-sm text-mutedfg">
          No tags yet. Tag a few prompts and they'll show up here.
        </div>
      </div>
    );
  }
  const max = tags[0].n;
  const total = tags.reduce((s, t) => s + t.n, 0);
  return (
    <div className="p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Tags</h1>
        <p className="text-sm text-mutedfg">{tags.length} unique · {total} applications. Click to filter prompts.</p>
      </header>
      <div className="rounded-lg border border-border bg-card/60 p-6 flex flex-wrap gap-x-3 gap-y-2 leading-none justify-center">
        {tags.map(t => {
          const scale = 0.85 + (t.n / max) * 1.8;
          const opacity = 0.5 + (t.n / max) * 0.5;
          return (
            <Link key={t.tag} href={`/prompts?tag=${encodeURIComponent(t.tag)}`}
              className="hover:text-accent transition"
              style={{ fontSize: `${scale}rem`, opacity, fontWeight: 500 }}
              title={`${t.tag} · ${t.n}`}>
              {t.tag} <span className="text-mutedfg text-xs tabular-nums">{t.n}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
