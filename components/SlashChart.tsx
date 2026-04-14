"use client";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

export function SlashChart({ data }: { data: Array<{ slash_name: string; n: number }> }) {
  return (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 2" />
          <XAxis dataKey="slash_name" tick={{ fill: "hsl(var(--mutedfg))", fontSize: 10 }} angle={-40} textAnchor="end" interval={0} />
          <YAxis tick={{ fill: "hsl(var(--mutedfg))", fontSize: 10 }} />
          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} />
          <Bar dataKey="n" fill="hsl(var(--accent))" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
