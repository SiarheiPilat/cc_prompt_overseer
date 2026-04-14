"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Item =
  | { kind: "plan"; key: string; href: string; node: React.ReactNode }
  | { kind: "prompt"; key: string; href: string; node: React.ReactNode };

export function SearchResults({ children, items }: { children: React.ReactNode; items: Item[] }) {
  // Wraps the rendered sections + provides keyboard nav.
  // Sections themselves render `children`; we attach key handlers globally.
  const router = useRouter();
  const [idx, setIdx] = useState<number | null>(null);
  const refs = useRef<Map<string, HTMLAnchorElement | null>>(new Map());

  // Whenever idx changes, scroll the active row into view + focus it
  useEffect(() => {
    if (idx == null) return;
    const item = items[idx];
    if (!item) return;
    const el = refs.current.get(item.key);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "auto" });
      el.classList.add("ring-1", "ring-accent");
      return () => el.classList.remove("ring-1", "ring-accent");
    }
  }, [idx, items]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || (t && t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!items.length) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setIdx(prev => prev == null ? 0 : Math.min(items.length - 1, prev + 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setIdx(prev => prev == null ? 0 : Math.max(0, prev - 1));
      } else if (e.key === "Enter" && idx != null && items[idx]) {
        e.preventDefault();
        router.push(items[idx].href);
      } else if (e.key === "Home") {
        e.preventDefault(); setIdx(0);
      } else if (e.key === "End") {
        e.preventDefault(); setIdx(items.length - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, idx, router]);

  // Map keys to ref attachment via a context-less prop on the rows.
  // To keep this simple, the parent renders each <Link> with id={`sr-${key}`} and
  // we look them up here.
  useEffect(() => {
    const map = refs.current;
    map.clear();
    for (const it of items) {
      const el = document.getElementById(`sr-${it.key}`) as HTMLAnchorElement | null;
      if (el) map.set(it.key, el);
    }
  }, [items]);

  return <>{children}</>;
}
