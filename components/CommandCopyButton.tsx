"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CommandCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }
  return (
    <button onClick={onCopy} title="copy to clipboard"
      className="p-1 rounded hover:bg-muted/80 text-mutedfg hover:text-fg">
      {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
