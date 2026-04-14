import { db } from "./db";

export type Leaderboard = { title: string; rows: Array<{ label: string; value: string | number; sub?: string; href?: string }> };

export function leaderboards(): Leaderboard[] {
  const D = db();
  const out: Leaderboard[] = [];

  out.push({
    title: "Longest prompts",
    rows: (D.prepare(`
      SELECT p.id, p.char_count, substr(p.text,1,90) AS snippet, p.session_id, pr.cwd
      FROM prompts p LEFT JOIN projects pr ON pr.id = p.project_id
      ORDER BY p.char_count DESC LIMIT 15
    `).all() as any[]).map(r => ({
      label: (r.snippet || "").replace(/\s+/g, " "),
      value: `${r.char_count} ch`,
      sub: r.cwd || "",
      href: `/sessions/${r.session_id}#p${r.id}`,
    })),
  });

  out.push({
    title: "Most-run slash commands",
    rows: (D.prepare(`
      SELECT slash_name, COUNT(*) AS n FROM prompts WHERE is_slash=1 AND slash_name IS NOT NULL
      GROUP BY slash_name ORDER BY n DESC LIMIT 15
    `).all() as any[]).map(r => ({ label: "/" + r.slash_name, value: r.n })),
  });

  out.push({
    title: "Sessions with most turns",
    rows: (D.prepare(`
      SELECT s.id, s.slug, s.turn_count, pr.cwd
      FROM sessions s LEFT JOIN projects pr ON pr.id = s.project_id
      ORDER BY s.turn_count DESC LIMIT 15
    `).all() as any[]).map(r => ({
      label: r.slug || r.id.slice(0, 8), value: r.turn_count, sub: r.cwd || "",
      href: `/sessions/${r.id}`,
    })),
  });

  out.push({
    title: "Most active projects",
    rows: (D.prepare(`
      SELECT id, cwd, prompt_count FROM projects ORDER BY prompt_count DESC LIMIT 15
    `).all() as any[]).map(r => ({
      label: r.cwd || r.id, value: r.prompt_count, href: `/projects/${encodeURIComponent(r.id)}`,
    })),
  });

  out.push({
    title: "Busiest days",
    rows: (D.prepare(`
      SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS d, COUNT(*) AS n
      FROM prompts WHERE ts > 0 GROUP BY d ORDER BY n DESC LIMIT 10
    `).all() as any[]).map(r => ({ label: r.d, value: r.n })),
  });

  out.push({
    title: "Busiest hours",
    rows: (D.prepare(`
      SELECT strftime('%H:00', ts/1000, 'unixepoch') AS h, COUNT(*) AS n
      FROM prompts WHERE ts > 0 GROUP BY h ORDER BY n DESC LIMIT 10
    `).all() as any[]).map(r => ({ label: r.h, value: r.n })),
  });

  out.push({
    title: "Longest plans",
    rows: (D.prepare(`
      SELECT slug, title, word_count FROM plans ORDER BY word_count DESC LIMIT 15
    `).all() as any[]).map(r => ({
      label: r.title || r.slug, value: `${r.word_count} w`,
      href: `/plans/${encodeURIComponent(r.slug)}`,
    })),
  });

  out.push({
    title: "Most expensive sessions (by output tokens)",
    rows: (D.prepare(`
      SELECT s.id, s.slug, pr.cwd,
        SUM(at.output_tokens) AS out_tok,
        SUM(at.cache_creation_tokens) AS cw,
        SUM(at.cache_read_tokens) AS cr
      FROM assistant_turns at
      JOIN sessions s ON s.id = at.session_id
      LEFT JOIN projects pr ON pr.id = s.project_id
      WHERE at.model IS NOT NULL
      GROUP BY s.id ORDER BY out_tok DESC LIMIT 10
    `).all() as any[]).map(r => ({
      label: r.slug || r.id.slice(0, 8),
      value: `${(r.out_tok/1000).toFixed(0)}K out`,
      sub: r.cwd || "",
      href: `/sessions/${r.id}`,
    })),
  });

  out.push({
    title: "Worst cache hit rate sessions (≥ 5K cache writes)",
    rows: (D.prepare(`
      SELECT s.id, s.slug, pr.cwd,
        SUM(at.cache_creation_tokens) AS cw,
        SUM(at.cache_read_tokens) AS cr
      FROM assistant_turns at
      JOIN sessions s ON s.id = at.session_id
      LEFT JOIN projects pr ON pr.id = s.project_id
      WHERE at.model IS NOT NULL
      GROUP BY s.id
      HAVING cw + cr > 5000 AND cw > 0
      ORDER BY (CAST(cr AS REAL) / NULLIF(cr + cw, 0)) ASC LIMIT 10
    `).all() as any[]).map(r => ({
      label: r.slug || r.id.slice(0, 8),
      value: `${(r.cr / Math.max(1, r.cr + r.cw) * 100).toFixed(0)}% hit`,
      sub: r.cwd || "",
      href: `/sessions/${r.id}`,
    })),
  });

  out.push({
    title: "Most-used prompt categories",
    rows: (D.prepare(`
      SELECT category, COUNT(*) AS n FROM prompts WHERE category IS NOT NULL GROUP BY category ORDER BY n DESC LIMIT 12
    `).all() as any[]).map(r => ({
      label: r.category, value: r.n, href: `/prompts?cat=${encodeURIComponent(r.category)}`,
    })),
  });

  out.push({
    title: "Your starred prompts",
    rows: (D.prepare(`
      SELECT p.id, substr(p.text,1,90) AS snippet, p.session_id, pr.cwd
      FROM prompts p
      JOIN user_meta um ON um.uuid = p.uuid
      LEFT JOIN projects pr ON pr.id = p.project_id
      WHERE um.starred=1
      ORDER BY um.rating DESC, p.ts DESC LIMIT 15
    `).all() as any[]).map(r => ({
      label: (r.snippet || "").replace(/\s+/g, " "), value: "★", sub: r.cwd || "",
      href: `/sessions/${r.session_id}#p${r.id}`,
    })),
  });

  return out;
}

export function interestScore(char_count: number, follow_ups: number, has_plan: boolean, starred: boolean, is_multiline: boolean): number {
  const z = Math.min(4, Math.log10(1 + char_count));
  return z + 0.5 * Math.log1p(follow_ups) + (has_plan ? 1.5 : 0) + (starred ? 2 : 0) + (is_multiline ? 0.3 : 0);
}
