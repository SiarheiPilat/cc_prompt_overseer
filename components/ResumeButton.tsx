"use client";
import { useState } from "react";
import { Play, Check, Copy } from "lucide-react";

export function ResumeButton({ sessionId, cwd }: { sessionId: string; cwd: string | null }) {
  const [copied, setCopied] = useState<"cmd" | "id" | null>(null);

  const cmd = cwd ? `cd "${cwd}" && claude --resume ${sessionId}` : `claude --resume ${sessionId}`;

  async function copy(text: string, kind: "cmd" | "id") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  }

  return (
    <div className="inline-flex rounded border border-emerald-500/40 overflow-hidden">
      <button onClick={() => copy(cmd, "cmd")}
              className="text-sm flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 transition"
              title={cmd}>
        {copied === "cmd" ? <Check className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        {copied === "cmd" ? "copied!" : "resume"}
      </button>
      <button onClick={() => copy(sessionId, "id")}
              className="text-sm flex items-center px-2 py-1.5 border-l border-emerald-500/40 text-emerald-300/80 hover:bg-emerald-500/15 transition"
              title={`copy session id: ${sessionId}`}>
        {copied === "id" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}
