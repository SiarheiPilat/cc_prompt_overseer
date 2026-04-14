import { getWatcher } from "@/lib/watcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { bus } = getWatcher();
  const encoder = new TextEncoder();
  let listener: ((ev: any) => void) | null = null;
  let heartbeat: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      function send(event: string, data: any) {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {}
      }
      send("hello", { ok: true, lastIndexedAt: bus.lastIndexedAt || null });
      if (bus.lastEvent) send("indexed", bus.lastEvent);
      listener = (ev: any) => {
        if (!ev) return;
        send(ev.type === "error" ? "error" : "indexed", ev);
      };
      bus.on("event", listener);
      heartbeat = setInterval(() => send("ping", { t: Date.now() }), 25000);
    },
    cancel() {
      if (listener) bus.off("event", listener);
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "connection": "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
