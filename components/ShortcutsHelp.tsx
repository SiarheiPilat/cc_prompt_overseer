"use client";
import { useEffect, useState } from "react";
import { Keyboard, X } from "lucide-react";

type Shortcut = { keys: string[]; desc: string; scope?: string };

const SHORTCUTS: Shortcut[] = [
  { keys: ["?"],             desc: "Open / close this help",           scope: "global" },
  { keys: ["⌘K", "Ctrl+K"],  desc: "Command palette (jump to anything)", scope: "global" },
  { keys: ["Esc"],            desc: "Close dialogs and side panels",     scope: "global" },

  { keys: ["j", "↓"],        desc: "Next prompt",                       scope: "/prompts" },
  { keys: ["k", "↑"],        desc: "Previous prompt",                   scope: "/prompts" },
  { keys: ["Home"],          desc: "Jump to first prompt",              scope: "/prompts" },
  { keys: ["End"],           desc: "Jump to last prompt",               scope: "/prompts" },
  { keys: ["x"],             desc: "Toggle checkbox on current row",    scope: "/prompts" },
  { keys: ["Shift + click"], desc: "Select a range of checkboxes",      scope: "/prompts" },
];

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || (t && t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setOpen(o => !o);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button onClick={() => setOpen(true)}
        title="Keyboard shortcuts (?)"
        className="fixed bottom-3 right-3 z-30 rounded-full w-8 h-8 flex items-center justify-center
                   border border-border bg-card/80 backdrop-blur text-mutedfg hover:text-fg hover:bg-muted/80 transition">
        <Keyboard className="h-4 w-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6"
             onClick={() => setOpen(false)}>
          <div className="w-[min(520px,92vw)] bg-card border border-border rounded-lg shadow-2xl overflow-hidden"
               onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4" />
                <h2 className="text-sm font-semibold">Keyboard shortcuts</h2>
              </div>
              <button onClick={() => setOpen(false)}
                      className="p-1 rounded hover:bg-muted/80">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {groupByScope(SHORTCUTS).map(([scope, items]) => (
                <section key={scope}>
                  <div className="text-[10px] uppercase tracking-wide text-mutedfg mb-1.5">{scope}</div>
                  <ul className="space-y-1 text-sm">
                    {items.map((s, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <div className="flex gap-1.5 shrink-0">
                          {s.keys.map((k, j) => (
                            <kbd key={j} className="text-[11px] font-mono rounded border border-border bg-muted px-2 py-0.5">
                              {k}
                            </kbd>
                          ))}
                        </div>
                        <span className="text-mutedfg">{s.desc}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-border text-[10px] text-mutedfg text-center">
              Press <kbd className="bg-muted rounded px-1">?</kbd> anywhere to reopen.
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function groupByScope(list: Shortcut[]): Array<[string, Shortcut[]]> {
  const g = new Map<string, Shortcut[]>();
  for (const s of list) {
    const k = s.scope || "other";
    const arr = g.get(k) || [];
    arr.push(s);
    g.set(k, arr);
  }
  return Array.from(g.entries());
}
