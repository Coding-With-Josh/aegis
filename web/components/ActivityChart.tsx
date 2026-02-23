"use client";

import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { DecisionEntry } from "@/lib/types";

interface Props { history: DecisionEntry[] }

export default function ActivityChart({ history }: Props) {
  const data = useMemo(() => {
    if (!history.length) return [];
    const buckets = new Map<string, { executed: number; rejected: number; held: number }>();
    history.forEach((h) => {
      const d = new Date(h.ts);
      const key = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
      const prev = buckets.get(key) ?? { executed: 0, rejected: 0, held: 0 };
      if (h.rejected) prev.rejected++;
      else if (h.action === "hold") prev.held++;
      else prev.executed++;
      buckets.set(key, prev);
    });
    return Array.from(buckets.entries()).slice(-20).map(([time, v]) => ({ time, ...v }));
  }, [history]);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-36 text-muted-foreground/40 text-xs">
        no activity yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={148}>
      <AreaChart data={data} margin={{ top: 6, right: 4, left: -28, bottom: 0 }}>
        <defs>
          <linearGradient id="gExec" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00C4AA" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#00C4AA" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gRej" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f04444" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#f04444" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gHeld" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5b9fff" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#5b9fff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={false} />
        <XAxis
          dataKey="time"
          tick={{ fontSize: 10, fill: "rgba(255,255,255,0.25)" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "rgba(255,255,255,0.25)" }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: "oklch(0.14 0.005 260)",
            border: "1px solid oklch(0.24 0.005 260)",
            borderRadius: 10,
            fontSize: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
          labelStyle={{ color: "rgba(255,255,255,0.4)", marginBottom: 4 }}
          itemStyle={{ color: "rgba(255,255,255,0.8)" }}
          cursor={{ stroke: "rgba(255,255,255,0.06)", strokeWidth: 1 }}
        />
        <Area type="monotone" dataKey="executed" stroke="#00C4AA" strokeWidth={2} fill="url(#gExec)" name="executed" dot={false} />
        <Area type="monotone" dataKey="held" stroke="#5b9fff" strokeWidth={1.5} fill="url(#gHeld)" name="held" strokeDasharray="4 3" dot={false} />
        <Area type="monotone" dataKey="rejected" stroke="#f04444" strokeWidth={1.5} fill="url(#gRej)" name="rejected" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
