"use client";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

export function WeeklyChart({ data }: { data: Array<{ wk: string; n: number }> }) {
  return (
    <div style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 2" />
          <XAxis dataKey="wk" tick={{ fill: "hsl(var(--mutedfg))", fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis tick={{ fill: "hsl(var(--mutedfg))", fontSize: 10 }} />
          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} />
          <Line type="monotone" dataKey="n" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
