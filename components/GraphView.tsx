"use client";
import { useEffect, useRef } from "react";
import cytoscape from "cytoscape";
import { useRouter } from "next/navigation";

type Data = {
  projects: Array<{ id: string; cwd: string | null; prompt_count: number }>;
  sessions: Array<{ id: string; project_id: string | null; slug: string | null; turn_count: number }>;
  plans: Array<{ slug: string; title: string }>;
};

export function GraphView({ data }: { data: Data }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!ref.current) return;
    const planSlugs = new Set(data.plans.map(p => p.slug));
    const elements: any[] = [];
    for (const p of data.projects) {
      elements.push({ data: { id: `proj:${p.id}`, label: (p.cwd || p.id).split(/[\\/]/).slice(-2).join("/"), kind: "project", count: p.prompt_count, href: `/projects/${encodeURIComponent(p.id)}` } });
    }
    for (const s of data.sessions) {
      elements.push({ data: { id: `sess:${s.id}`, label: (s.slug || s.id.slice(0, 6)), kind: "session", count: s.turn_count, href: `/sessions/${s.id}` } });
      if (s.project_id) elements.push({ data: { id: `e:${s.id}`, source: `proj:${s.project_id}`, target: `sess:${s.id}` } });
      if (s.slug && planSlugs.has(s.slug)) {
        elements.push({ data: { id: `ep:${s.id}`, source: `sess:${s.id}`, target: `plan:${s.slug}` } });
      }
    }
    for (const p of data.plans) {
      elements.push({ data: { id: `plan:${p.slug}`, label: p.title || p.slug, kind: "plan", href: `/plans/${encodeURIComponent(p.slug)}` } });
    }
    const cy = cytoscape({
      container: ref.current,
      elements,
      layout: { name: "cose", animate: false, idealEdgeLength: 80, nodeRepulsion: 6000, padding: 20 } as any,
      style: [
        { selector: "node", style: {
          label: "data(label)",
          "background-color": "#7c3aed",
          color: "#fff", "font-size": 9,
          "text-wrap": "ellipsis", "text-max-width": "120px",
          width: 16, height: 16,
        }},
        { selector: 'node[kind = "project"]', style: { "background-color": "#22d3ee", width: 22, height: 22 } },
        { selector: 'node[kind = "plan"]',    style: { "background-color": "#f59e0b", shape: "diamond", width: 18, height: 18 } },
        { selector: "edge", style: { "line-color": "#3f3f46", width: 1, "curve-style": "bezier" } },
      ],
      wheelSensitivity: 0.2,
    });
    cy.on("tap", "node", (ev: any) => {
      const href = ev.target.data("href");
      if (href) router.push(href);
    });
    return () => cy.destroy();
  }, [data, router]);
  return <div ref={ref} style={{ width: "100%", height: "calc(100vh - 200px)" }} />;
}
