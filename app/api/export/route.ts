import { queryPrompts } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sp = url.searchParams;
  const format = (sp.get("format") || "md").toLowerCase();
  const q = sp.get("q") || undefined;
  const project = sp.get("project") || undefined;
  const slash = sp.get("slash") === "1";
  const starred = sp.get("starred") === "1";
  const hasPlan = sp.get("hasPlan") === "1";
  const minLen = sp.get("minLen") ? Number(sp.get("minLen")) : undefined;
  const cat = sp.get("cat") || undefined;
  const from = sp.get("from") ? Number(sp.get("from")) : undefined;
  const to = sp.get("to") ? Number(sp.get("to")) : undefined;
  const orderBy = (sp.get("orderBy") as any) || "ts";
  const dir = (sp.get("dir") as any) || "desc";
  const limit = Math.min(5000, Number(sp.get("limit") || 1000));

  const { rows } = queryPrompts({
    q, project, slash, starred, hasPlan,
    minLen, category: cat, from, to,
    orderBy, dir, limit,
  });

  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  const fname = `overseer-prompts-${stamp}.${format === "csv" ? "csv" : format === "json" ? "json" : "md"}`;

  if (format === "json") {
    return new Response(JSON.stringify(rows, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${fname}"`,
      },
    });
  }

  if (format === "csv") {
    const cols = ["ts", "cwd", "session_id", "is_slash", "slash_name", "category", "char_count", "word_count", "starred", "rating", "has_plan", "text"];
    const esc = (v: any) => {
      if (v == null) return "";
      const s = String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [cols.join(",")];
    for (const r of rows) {
      lines.push(cols.map(c => esc((r as any)[c])).join(","));
    }
    return new Response(lines.join("\n"), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${fname}"`,
      },
    });
  }

  // markdown (default)
  const parts: string[] = [];
  parts.push(`# Claude Code prompts export`);
  parts.push(`Generated ${new Date().toISOString()} · ${rows.length} prompts`);
  const filterBits: string[] = [];
  if (q) filterBits.push(`search: "${q}"`);
  if (project) filterBits.push(`project: ${project}`);
  if (cat) filterBits.push(`category: ${cat}`);
  if (slash) filterBits.push("slash only");
  if (starred) filterBits.push("starred only");
  if (hasPlan) filterBits.push("has plan");
  if (minLen) filterBits.push(`minLen: ${minLen}`);
  if (from) filterBits.push(`from: ${new Date(from).toISOString()}`);
  if (to) filterBits.push(`to: ${new Date(to).toISOString()}`);
  if (filterBits.length) parts.push(`Filters: ${filterBits.join(", ")}`);
  parts.push("");
  for (const r of rows) {
    const date = r.ts ? new Date(r.ts).toISOString().replace("T", " ").slice(0, 16) : "";
    const badges = [
      r.is_slash ? `/${r.slash_name}` : null,
      r.category || null,
      r.starred ? "★" : null,
      r.has_plan ? "plan" : null,
    ].filter(Boolean).join(" · ");
    parts.push(`## ${date} — ${r.cwd || "(unknown project)"}`);
    if (badges) parts.push(`_${badges} · ${r.char_count} chars_`);
    parts.push("");
    // indent code fences so nothing escapes
    const body = (r.text || "").replace(/^/gm, "> ");
    parts.push(body);
    parts.push("");
    parts.push(`[session](./sessions/${r.session_id}) · id: ${r.id}`);
    parts.push("\n---\n");
  }
  return new Response(parts.join("\n"), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${fname}"`,
    },
  });
}
