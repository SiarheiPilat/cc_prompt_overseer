import Link from "next/link";
import { findRepeats } from "@/lib/similarity";
import { fmtDate, truncate, basename } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default function RepeatsPage() {
  const pairs = findRepeats({ minScore: 0.35, minLen: 80, sampleSize: 1000, limit: 40 });
  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <header>
        <h1 className="text-2xl font-semibold">Repeated questions</h1>
        <p className="text-sm text-mutedfg">
          Pairs of prompts you've written in different sessions that look very similar (TF-IDF cosine ≥ 35%).
          If you keep asking the same thing, consider writing it into a project's <code>CLAUDE.md</code> instead.
        </p>
      </header>

      {pairs.length === 0 ? (
        <div className="rounded-lg border border-border bg-card/60 p-6 text-sm text-mutedfg">
          No repeats found — your prompts are pretty diverse.
        </div>
      ) : (
        <ul className="space-y-3">
          {pairs.map((p, i) => (
            <li key={i} className="rounded-lg border border-border bg-card/60 p-4">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-xs text-mutedfg">pair #{i + 1}</span>
                <span className="text-xs text-accent tabular-nums">{(p.score * 100).toFixed(0)}% match</span>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <PromptColumn label="A" data={p.a} />
                <PromptColumn label="B" data={p.b} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PromptColumn({ label, data }: { label: string; data: any }) {
  return (
    <Link href={`/sessions/${data.session_id}#p${data.id}`}
      className="block rounded p-3 border border-border bg-muted/30 hover:bg-muted/60 hover:border-accent/60 transition">
      <div className="text-[10px] text-mutedfg flex gap-2 items-baseline">
        <span className="text-accent uppercase">{label}</span>
        <span>{fmtDate(data.ts)}</span>
        <span className="truncate">· {basename(data.cwd || "")}</span>
      </div>
      <pre className="font-mono text-[12px] mt-1 whitespace-pre-wrap line-clamp-6 text-fg">{truncate(data.text, 600)}</pre>
    </Link>
  );
}
