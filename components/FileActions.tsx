"use client";
import { useState } from "react";
import { Code2, FolderOpen, Copy, Check } from "lucide-react";

export function FileActions({ path }: { path: string }) {
  const [copied, setCopied] = useState<"path" | "dir" | null>(null);

  // VS Code's URI handler: vscode://file/<path>
  // Windows paths need forward slashes for vscode://file
  const fwd = path.replace(/\\/g, "/");
  const vscodeHref = `vscode://file/${encodeURI(fwd)}`;
  const dir = fwd.replace(/\/[^/]+$/, "");
  const fileUrl = "file:///" + encodeURI(fwd.replace(/^\/?/, ""));

  async function copy(text: string, kind: "path" | "dir") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1200);
    } catch {}
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 shrink-0 text-xs">
      <a href={vscodeHref}
         className="flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-muted/60 hover:text-accent transition"
         title="Open in VS Code (vscode:// handler)">
        <Code2 className="h-3.5 w-3.5" /> code
      </a>
      <a href={`file:///${encodeURI(dir.replace(/^\/?/, ""))}`}
         className="flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-muted/60 hover:text-accent transition"
         title="Open containing folder (file://)">
        <FolderOpen className="h-3.5 w-3.5" /> folder
      </a>
      <button onClick={() => copy(path, "path")}
              className="flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-muted/60 hover:text-accent transition"
              title="Copy full file path">
        {copied === "path" ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
        {copied === "path" ? "copied" : "path"}
      </button>
    </div>
  );
}
