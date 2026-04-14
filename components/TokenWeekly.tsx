"use client";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend } from "recharts";

export function TokenWeekly({ data }: { data: Array<{ wk: string; input: number; output: number; cache_creation: number; cache_read: number }> }) {
  return (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 2" />
          <XAxis dataKey="wk" tick={{ fill: "hsl(var(--mutedfg))", fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis tick={{ fill: "hsl(var(--mutedfg))", fontSize: 10 }} tickFormatter={(v) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : v} />
          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="cache_read" stackId="a" fill="#22c55e" name="cache read" />
          <Bar dataKey="cache_creation" stackId="a" fill="#f59e0b" name="cache write" />
          <Bar dataKey="input" stackId="a" fill="#06b6d4" name="input" />
          <Bar dataKey="output" stackId="a" fill="hsl(var(--accent))" name="output" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
