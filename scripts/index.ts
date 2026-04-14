import { indexAll } from "../lib/indexer";
import { db } from "../lib/db";

const stats = indexAll({ verbose: false });
console.log("[indexer] done in", stats.durationMs, "ms");
console.log(stats);

const D = db();
const counts = {
  projects: (D.prepare("SELECT COUNT(*) n FROM projects").get() as any).n,
  sessions: (D.prepare("SELECT COUNT(*) n FROM sessions").get() as any).n,
  prompts: (D.prepare("SELECT COUNT(*) n FROM prompts").get() as any).n,
  plans: (D.prepare("SELECT COUNT(*) n FROM plans").get() as any).n,
  assistant: (D.prepare("SELECT COUNT(*) n FROM assistant_turns").get() as any).n,
};
console.log("[counts]", counts);

const top = D.prepare(`SELECT cwd, prompt_count FROM projects ORDER BY prompt_count DESC LIMIT 5`).all();
console.log("[top projects]", top);
