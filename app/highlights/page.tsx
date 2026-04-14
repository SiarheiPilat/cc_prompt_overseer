import Link from "next/link";
import { highlights, starredSessions } from "@/lib/queries";
import { fmtDate, fmtRelative, truncate, basename } from "@/lib/utils";
import { fmtTokens, fmtCost, costUSD } from "@/lib/pricing";
import { Star, FileText, Sparkles, Zap, Tag, Bookmark } from "lucide-react";

export const dynamic = "force-dynamic";

export default function HighlightsPage() {
  const h = highlights();
  const stars = starredSessions(20);
  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <header>
        <h1 className="text-2xl font-semibold">Highlights</h1>
        <p className="text-sm text-mutedfg">A personal "best of" across your history.</p>
      </header>

      {stars.length > 0 && (
        <Section title="Starred sessions" Icon={Bookmark} hint="full sessions you flagged via the session header star">
          <ul className="space-y-1">
            {stars.map(s => (
              <li key={s.id}>
                <Link className="block rounded p-2 hover:bg-muted/60 border border-transparent hover:border-border" href={`/sessions/${s.id}`}>
                  <div className="flex items-baseline gap-2">
                    <Star className="h-3 w-3 text-yellow-300 shrink-0" fill="currentColor" />
                    <span className="text-[11px] text-mutedfg tabular-nums">{fmtDate(s.started_at)}</span>
                    <span className="text-accent truncate flex-1 min-w-0">{s.slug || s.id.slice(0, 8)}</span>
                    <span className="text-[11px] text-mutedfg">{s.prompt_count}p · {s.turn_count}t</span>
                    <span className="text-[11px] text-mutedfg w-16 text-right">{fmtTokens(s.out_tok || 0)} out</span>
                    <span className="text-[11px] text-fg w-16 text-right tabular-nums">
                      {fmtCost(costUSD(s.model, s.in_tok || 0, s.out_tok || 0, s.cw_tok || 0, s.cr_tok || 0))}
                    </span>
                  </div>
                  {s.note && <div className="text-[11px] text-mutedfg italic mt-0.5 line-clamp-2">{s.note}</div>}
                  {s.cwd && <div className="text-[11px] text-mutedfg mt-0.5 truncate">{s.cwd}</div>}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {h.starred.length > 0 && (
        <Section title="Starred prompts" Icon={Star} hint="individual prompts you flagged; ordered by rating">
          <div className="grid md:grid-cols-2 gap-3">
            {h.starred.map(p => (
              <PromptCard key={p.id} p={p} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Top sessions that produced plans" Icon={FileText} hint="sessions where you went all the way from prompt to written plan">
        <ul className="space-y-1">
          {h.sessionsWithPlans.map(s => (
            <li key={s.id}>
              <Link className="block rounded p-2 hover:bg-muted/60 border border-transparent hover:border-border" href={`/sessions/${s.id}`}>
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] text-mutedfg tabular-nums">{fmtDate(s.started_at)}</span>
                  <span className="text-accent truncate flex-1 min-w-0">{s.slug}</span>
                  <span className="text-[11px] text-mutedfg">{s.turn_count}t · {fmtTokens(s.out_tok || 0)} out</span>
                </div>
                <div className="text-sm mt-0.5 truncate"><span className="text-mutedfg text-xs">plan:</span> {s.plan_title} <span className="text-[11px] text-mutedfg">({s.plan_words}w)</span></div>
                <div className="text-[11px] text-mutedfg mt-0.5 truncate">{s.cwd || ""}</div>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="High-interest prompts" Icon={Sparkles} hint="long or plan-producing prompts you haven't starred yet">
        <div className="grid md:grid-cols-2 gap-3">
          {h.highInterest.map(p => (
            <PromptCard key={p.id} p={p} />
          ))}
        </div>
      </Section>

      <Section title="Prompts that got the longest answers" Icon={Zap} hint="your prompts ranked by the output-token length of the assistant reply that followed">
        <ul className="space-y-1">
          {h.bigAnswers.map((a, i) => (
            <li key={i}>
              <Link className="flex items-start gap-3 rounded p-2 hover:bg-muted/60 border border-transparent hover:border-border"
                    href={a.prompt_id ? `/sessions/${a.session_id}#p${a.prompt_id}` : `/sessions/${a.session_id}`}>
                <span className="text-xs text-mutedfg w-5 tabular-nums pt-0.5">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-mutedfg">{fmtDate(a.ts)} · {basename(a.cwd || "")} · {a.model || "?"}</div>
                  <div className="text-sm font-mono truncate">{truncate((a.prompt_snippet || "(no preceding prompt)").replace(/\s+/g," "), 180)}</div>
                </div>
                <span className="text-sm font-semibold text-accent tabular-nums shrink-0">{fmtTokens(a.output_tokens)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Signature by category" Icon={Tag} hint="most recent long example per category">
        <ul className="grid md:grid-cols-2 gap-2">
          {h.signatureByCategory.map(p => (
            <li key={p.id}>
              <Link href={`/sessions/${p.session_id}#p${p.id}`}
                className="block rounded p-2 hover:bg-muted/60 border border-transparent hover:border-border">
                <div className="text-[11px] text-accent font-medium uppercase tracking-wide">{p.category}</div>
                <div className="text-sm font-mono mt-0.5 line-clamp-2">{(p.snippet || "").replace(/\s+/g," ")}</div>
                <div className="text-[11px] text-mutedfg mt-0.5">{fmtDate(p.ts)} · {basename(p.cwd || "")}</div>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, Icon, hint, children }: { title: string; Icon: any; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline gap-2 mb-2">
        <Icon className="h-4 w-4 text-accent shrink-0" />
        <h2 className="text-sm font-medium">{title}</h2>
        {hint && <span className="text-[11px] text-mutedfg">· {hint}</span>}
      </div>
      {children}
    </section>
  );
}

function PromptCard({ p }: { p: any }) {
  return (
    <Link href={`/sessions/${p.session_id}#p${p.id}`}
      className="block rounded-lg p-3 border border-border bg-card/60 hover:border-accent/60 transition">
      <div className="text-[11px] text-mutedfg flex gap-2 items-baseline">
        <span>{fmtRelative(p.ts)}</span>
        <span className="truncate">· {basename(p.cwd || "")}</span>
        {p.category && <span className="text-accent">· {p.category}</span>}
        {p.has_plan ? <span className="ml-auto">plan ✓</span> : null}
        <span className={p.has_plan ? "" : "ml-auto"}>{p.char_count} ch</span>
      </div>
      <div className="mt-1 text-sm font-mono line-clamp-3">{(p.snippet || "").replace(/\s+/g," ")}</div>
      {p.note && <div className="mt-1 text-[11px] text-mutedfg italic">note: {truncate(p.note, 120)}</div>}
    </Link>
  );
}
