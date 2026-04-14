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
          <p className="text-sm text-mutedfg">Free-form tags you add to prompts (in the prompt detail panel) or sessions (via the session-header annotate button).</p>
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
        <p className="text-sm text-mutedfg">
          {tags.length} unique · {total} applications across prompts and sessions
        </p>
      </header>
      <div className="rounded-lg border border-border bg-card/60 p-6 flex flex-wrap gap-x-3 gap-y-2 leading-none justify-center">
        {tags.map((t: any) => {
          const scale = 0.85 + (t.n / max) * 1.8;
          const opacity = 0.5 + (t.n / max) * 0.5;
          // primary link: prompts (most common). Secondary: sessions if any.
          return (
            <span key={t.tag} className="inline-flex items-baseline gap-1" title={`${t.tag} · ${t.prompts} prompts · ${t.sessions} sessions`}>
              <Link href={`/prompts?tag=${encodeURIComponent(t.tag)}`}
                className="hover:text-accent transition"
                style={{ fontSize: `${scale}rem`, opacity, fontWeight: 500 }}>
                {t.tag}
              </Link>
              {t.prompts > 0 && (
                <Link href={`/prompts?tag=${encodeURIComponent(t.tag)}`}
                  className="text-mutedfg text-xs tabular-nums hover:text-accent">{t.prompts}p</Link>
              )}
              {t.sessions > 0 && (
                <Link href={`/sessions?tag=${encodeURIComponent(t.tag)}`}
                  className="text-mutedfg text-xs tabular-nums hover:text-accent">{t.sessions}s</Link>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
