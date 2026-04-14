import Link from "next/link";
import { wordCounts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function WordCloudPage() {
  const words = wordCounts(180);
  const maxN = words[0]?.n || 1;
  return (
    <div className="p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Word Cloud</h1>
        <p className="text-sm text-mutedfg">Most common tokens across your prompts. Click to filter.</p>
      </header>
      <div className="rounded-lg border border-border bg-card/60 p-6 flex flex-wrap gap-x-3 gap-y-2 leading-none justify-center">
        {words.map(w => {
          const scale = 0.7 + (w.n / maxN) * 2.3;
          const opacity = 0.4 + (w.n / maxN) * 0.6;
          return (
            <Link key={w.w} href={`/prompts?q=${encodeURIComponent(w.w)}`}
              className="hover:text-accent transition"
              style={{ fontSize: `${scale}rem`, opacity, fontWeight: 500 }}
              title={`${w.w} · ${w.n}`}>
              {w.w}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
