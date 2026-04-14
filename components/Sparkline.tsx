"use client";
import { useMemo } from "react";

export function Sparkline({ values, height = 40, color }: { values: number[]; height?: number; color?: string }) {
  const W = 600;
  const path = useMemo(() => {
    if (!values.length) return "";
    const max = Math.max(1, ...values);
    const dx = values.length > 1 ? W / (values.length - 1) : 0;
    const pts = values.map((v, i) => `${(i * dx).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`);
    return `M ${pts.join(" L ")}`;
  }, [values, height]);
  const area = useMemo(() => {
    if (!values.length) return "";
    const max = Math.max(1, ...values);
    const dx = values.length > 1 ? W / (values.length - 1) : 0;
    const pts = values.map((v, i) => `${(i * dx).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`);
    return `M 0,${height} L ${pts.join(" L ")} L ${W},${height} Z`;
  }, [values, height]);
  const c = color || "hsl(var(--accent))";
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" width="100%" height={height} className="block">
      <path d={area} fill={c} fillOpacity="0.2" />
      <path d={path} fill="none" stroke={c} strokeWidth="1.5" />
    </svg>
  );
}
