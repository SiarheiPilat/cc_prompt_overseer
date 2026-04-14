"use client";
import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarButton({ uuid, initial }: { uuid: string | null; initial: boolean }) {
  const [starred, setStarred] = useState(initial);
  const [pending, setPending] = useState(false);
  if (!uuid) return null;
  async function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setPending(true);
    const next = !starred;
    setStarred(next);
    try {
      await fetch("/api/rate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uuid, starred: next ? 1 : 0 }),
      });
    } catch {
      setStarred(!next);
    } finally {
      setPending(false);
    }
  }
  return (
    <button onClick={toggle} disabled={pending}
      aria-label={starred ? "unstar" : "star"}
      className={cn("p-1 rounded hover:bg-muted/80 transition", starred ? "text-yellow-300" : "text-mutedfg hover:text-fg")}>
      <Star className="h-4 w-4" fill={starred ? "currentColor" : "none"} />
    </button>
  );
}
