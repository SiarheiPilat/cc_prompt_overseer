"use client";
import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function SessionStarButton({ sessionId, initial }: { sessionId: string; initial: boolean }) {
  const [starred, setStarred] = useState(initial);
  const [pending, setPending] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setPending(true);
    const next = !starred;
    setStarred(next);
    try {
      await fetch("/api/session-meta", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, starred: next ? 1 : 0 }),
      });
    } catch {
      setStarred(!next);
    } finally {
      setPending(false);
    }
  }

  return (
    <button onClick={toggle} disabled={pending}
      title={starred ? "unstar" : "star this session"}
      aria-label={starred ? "unstar" : "star"}
      className={cn(
        "p-1 rounded hover:bg-muted/80 transition shrink-0",
        starred ? "text-yellow-300" : "text-mutedfg hover:text-fg"
      )}>
      <Star className="h-3.5 w-3.5" fill={starred ? "currentColor" : "none"} />
    </button>
  );
}
