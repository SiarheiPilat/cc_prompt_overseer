import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import Database from "better-sqlite3";
import { streamLines, safeParse } from "../lib/parse-jsonl";

function ms(startNs: bigint): string {
  return (Number(process.hrtime.bigint() - startNs) / 1e6).toFixed(1) + "ms";
}

const home = os.homedir();
const projRoot = path.join(home, ".claude", "projects");

console.log("--- cold parse-only pass (no DB writes) ---");
const files: string[] = [];
let totalBytes = 0;
const projDirs = fs.readdirSync(projRoot).filter(n => fs.statSync(path.join(projRoot, n)).isDirectory());
for (const d of projDirs) {
  const full = path.join(projRoot, d);
  for (const f of fs.readdirSync(full)) {
    if (f.endsWith(".jsonl")) {
      const fp = path.join(full, f);
      files.push(fp);
      totalBytes += fs.statSync(fp).size;
    }
  }
}
console.log(`files: ${files.length}, total: ${(totalBytes / 1e6).toFixed(0)} MB`);

let s = process.hrtime.bigint();
let lines = 0;
for (const fp of files) {
  streamLines(fp, 0, (raw) => { lines++; });
}
console.log("read lines (no parse):", ms(s), lines, "lines");

s = process.hrtime.bigint();
lines = 0;
for (const fp of files) {
  streamLines(fp, 0, (raw) => { const o = safeParse(raw); if (o) lines++; });
}
console.log("read + JSON.parse:    ", ms(s), lines, "lines");

s = process.hrtime.bigint();
let userMsgs = 0, asstMsgs = 0, toolUses = 0;
for (const fp of files) {
  streamLines(fp, 0, (raw) => {
    const o = safeParse<any>(raw);
    if (!o) return;
    if (o.type === "user") userMsgs++;
    else if (o.type === "assistant") {
      asstMsgs++;
      const c = o.message?.content;
      if (Array.isArray(c)) for (const b of c) if (b?.type === "tool_use") toolUses++;
    }
  });
}
console.log("read + parse + classify:", ms(s), { userMsgs, asstMsgs, toolUses });

// Now the DB insert side — existing indexAll:
console.log("\n--- with DB writes via indexAll ---");
const D = new Database("overseer.db");
D.exec("DELETE FROM file_state; DELETE FROM prompts; DELETE FROM assistant_turns; DELETE FROM tool_calls;");
D.close();

s = process.hrtime.bigint();
require("../lib/indexer").indexAll();
console.log("full indexAll:        ", ms(s));
