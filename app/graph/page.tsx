import { graphData } from "@/lib/queries";
import { GraphView } from "@/components/GraphView";

export const dynamic = "force-dynamic";

export default function GraphPage() {
  const data = graphData();
  return (
    <div className="p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Graph</h1>
        <p className="text-sm text-mutedfg">Projects ↔ sessions ↔ plans. Click a node to open it.</p>
      </header>
      <div className="rounded-lg border border-border bg-card/60 p-2">
        <GraphView data={data as any} />
      </div>
    </div>
  );
}
