"use client";
import { useState } from "react";

export function SettingsForm({ initial }: { initial: Record<string, string> }) {
  const [weekly, setWeekly] = useState(initial.budget_weekly_usd || "");
  const [monthly, setMonthly] = useState(initial.budget_monthly_usd || "");
  const [saved, setSaved] = useState(false);

  async function save() {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        budget_weekly_usd: weekly,
        budget_monthly_usd: monthly,
      }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="space-y-3">
      <Field label="Weekly budget (USD)" placeholder="e.g. 50" value={weekly} onChange={setWeekly} />
      <Field label="Monthly budget (USD)" placeholder="e.g. 200" value={monthly} onChange={setMonthly} />
      <button onClick={save} className="bg-accent text-accentfg rounded px-3 py-1.5 text-sm hover:opacity-90">
        {saved ? "saved ✓" : "save"}
      </button>
      <p className="text-[11px] text-mutedfg">Leave blank to disable the alert.</p>
    </div>
  );
}

function Field({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <div className="text-xs text-mutedfg mb-1">{label}</div>
      <input type="number" min="0" step="any"
        value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-40 bg-muted rounded px-2 py-1.5 text-sm border border-border" />
    </label>
  );
}
