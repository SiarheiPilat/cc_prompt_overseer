import { EventEmitter } from "node:events";
import chokidar, { type FSWatcher } from "chokidar";
import { paths } from "./claude-paths";
import { indexAll } from "./indexer";
import { invalidateSimilarity } from "./similarity";

type Bus = EventEmitter & { lastEvent?: any; lastIndexedAt?: number };

declare global {
  // eslint-disable-next-line no-var
  var __overseer_watcher: { bus: Bus; watcher: FSWatcher } | undefined;
}

function setup(): { bus: Bus; watcher: FSWatcher } {
  const bus = new EventEmitter() as Bus;
  bus.setMaxListeners(50);
  const targets = [paths.projects(), paths.plans(), paths.todos()];
  const watcher = chokidar.watch(targets, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 800, pollInterval: 200 },
    persistent: true,
    depth: 4,
  });

  let pending = false;
  let timer: NodeJS.Timeout | null = null;
  function schedule(reason: string) {
    pending = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      if (!pending) return;
      pending = false;
      try {
        const stats = indexAll();
        invalidateSimilarity();
        bus.lastEvent = { type: "indexed", reason, ...stats, at: Date.now() };
        bus.lastIndexedAt = bus.lastEvent.at;
        bus.emit("event", bus.lastEvent);
      } catch (e: any) {
        bus.emit("event", { type: "error", message: e?.message || String(e), at: Date.now() });
      }
    }, 1500);
  }

  for (const ev of ["add", "change", "addDir"]) {
    watcher.on(ev as any, (p: string) => schedule(`${ev}:${p}`));
  }
  watcher.on("error", (err: any) => {
    bus.emit("event", { type: "error", message: err?.message || String(err), at: Date.now() });
  });

  return { bus, watcher };
}

export function getWatcher(): { bus: Bus; watcher: FSWatcher } {
  if (!globalThis.__overseer_watcher) {
    globalThis.__overseer_watcher = setup();
  }
  return globalThis.__overseer_watcher;
}
