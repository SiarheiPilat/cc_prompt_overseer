import os from "node:os";
import path from "node:path";
import fs from "node:fs";

export function claudeHome(): string {
  const override = process.env.CLAUDE_HOME;
  if (override) return override;
  return path.join(os.homedir(), ".claude");
}

export const paths = {
  home: () => claudeHome(),
  projects: () => path.join(claudeHome(), "projects"),
  plans: () => path.join(claudeHome(), "plans"),
  history: () => path.join(claudeHome(), "history.jsonl"),
  todos: () => path.join(claudeHome(), "todos"),
  sessions: () => path.join(claudeHome(), "sessions"),
};

export function decodeProjectDirName(name: string): string {
  // Claude encodes "C:\GitHub\foo\bar" as "C--GitHub-foo-bar"
  // The heuristic: "C--" at the start means "C:\". Dashes elsewhere are backslashes.
  // This is lossy — original dashes in the cwd are indistinguishable from separators.
  // We reconstruct by reading the first `.jsonl` inside the dir and pulling `cwd` from it.
  return name;
}

export function cwdFromSessionFile(filePath: string): string | null {
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(8192);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    const text = buf.slice(0, n).toString("utf8");
    const firstNL = text.indexOf("\n");
    const rest = firstNL >= 0 ? text.slice(firstNL + 1) : text;
    const secondNL = rest.indexOf("\n");
    const candidate = secondNL >= 0 ? rest.slice(0, secondNL) : rest;
    // try both lines
    for (const line of [text.slice(0, firstNL), candidate]) {
      if (!line) continue;
      try {
        const obj = JSON.parse(line);
        if (obj && typeof obj.cwd === "string") return obj.cwd;
      } catch {}
    }
  } catch {}
  return null;
}

export function safeReadDir(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}
