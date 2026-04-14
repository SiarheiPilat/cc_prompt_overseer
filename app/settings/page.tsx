import { getMeta } from "@/lib/db";
import { SettingsForm } from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const initial = {
    budget_weekly_usd: getMeta("budget_weekly_usd") || "",
    budget_monthly_usd: getMeta("budget_monthly_usd") || "",
  };
  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-mutedfg">Stored locally in <code>overseer.db</code>'s <code>meta</code> table.</p>
      </header>
      <section className="rounded-lg border border-border bg-card/60 p-4">
        <h2 className="text-sm font-medium mb-3">Cost budget</h2>
        <p className="text-xs text-mutedfg mb-3">
          Soft limits. We compute estimated spend from token usage × public Anthropic list prices.
          When you cross 80%, a banner appears on the dashboard. At 100% it turns red.
        </p>
        <SettingsForm initial={initial} />
      </section>
    </div>
  );
}
