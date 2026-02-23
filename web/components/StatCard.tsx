interface Props {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  warn?: boolean;
  icon?: React.ReactNode;
}

import React from "react";

export default function StatCard({ label, value, sub, accent, warn, icon }: Props) {
  const valueColor = accent ? "#00C4AA" : warn ? "hsl(var(--destructive))" : "hsl(var(--foreground))";
  const glowColor = accent ? "rgba(0,196,170,0.08)" : warn ? "rgba(240,68,68,0.06)" : "transparent";

  return (
    <div
      className="flex-1 min-w-0 rounded-xl border border-border bg-card px-4 py-4 flex flex-col gap-2 transition-all duration-200 hover:border-border/80"
      style={{ background: `linear-gradient(135deg, hsl(var(--card)) 0%, ${glowColor} 100%)` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
        {icon && <span className="text-muted-foreground/40">{icon}</span>}
      </div>
      <div className="text-[26px] font-bold tracking-tight leading-none tabular-nums" style={{ color: valueColor }}>
        {value}
      </div>
      {sub && (
        <p className="text-[11px] text-muted-foreground leading-none">{sub}</p>
      )}
    </div>
  );
}
