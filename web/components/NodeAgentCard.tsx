"use client";

import type { NodeAgentState, NodeTransaction } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  agent: NodeAgentState;
  selected: boolean;
  onClick: () => void;
}

function statusColor(status: string) {
  if (status === "confirmed") return "#00C4AA";
  if (status === "rejected_policy" || status === "rejected_simulation") return "#f04444";
  if (status === "failed") return "#f59e0b";
  return "#5b9fff";
}

function TxRow({ tx }: { tx: NodeTransaction }) {
  const color = statusColor(tx.status);
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-border/30 last:border-0">
      <span
        className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0"
        style={{ background: color + "18", color }}
      >
        {tx.intent_type}
      </span>
      <span className="text-[10px] text-muted-foreground truncate flex-1">
        {tx.reasoning ?? "no reasoning"}
      </span>
      <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0">
        {tx.amount != null ? `${tx.amount.toFixed(3)} SOL` : ""}
      </span>
      <span
        className="text-[9px] px-1.5 py-0.5 rounded shrink-0"
        style={{ background: color + "15", color }}
      >
        {tx.status.replace("_", " ")}
      </span>
    </div>
  );
}

export default function NodeAgentCard({ agent, selected, onClick }: Props) {
  const isActive = agent.status === "active";
  const shortKey = `${agent.publicKey.slice(0, 4)}...${agent.publicKey.slice(-4)}`;

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl border bg-card p-4 cursor-pointer transition-all duration-150 hover:border-primary/30",
        selected ? "border-primary/50 bg-primary/5" : "border-border"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
            style={{
              background: "#00C4AA18",
              border: "1px solid #00C4AA30",
              color: "#00C4AA",
            }}
          >
            N
          </div>
          <div>
            <div className="text-[12px] font-semibold text-foreground leading-none mb-0.5">
              node agent
            </div>
            <div className="text-[10px] font-mono text-muted-foreground">{shortKey}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              background: isActive ? "#00C4AA" : "oklch(0.3 0 0)",
              boxShadow: isActive ? "0 0 6px rgba(0,196,170,0.6)" : "none",
            }}
          />
          <span className="text-[10px] text-muted-foreground">{agent.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-muted/50 border border-border/50 px-3 py-2">
          <div className="text-[10px] text-muted-foreground mb-0.5">balance</div>
          <div className="text-[13px] font-bold text-foreground font-mono">
            {agent.balanceSol.toFixed(4)}
            <span className="text-[10px] font-normal text-muted-foreground ml-1">SOL</span>
          </div>
        </div>
        <div className="rounded-lg bg-muted/50 border border-border/50 px-3 py-2">
          <div className="text-[10px] text-muted-foreground mb-0.5">spent today</div>
          <div className="text-[13px] font-bold text-foreground font-mono">
            {(agent.dailySpend?.sol ?? 0).toFixed(4)}
            <span className="text-[10px] font-normal text-muted-foreground ml-1">SOL</span>
          </div>
        </div>
        <div className="rounded-lg bg-muted/50 border border-border/50 px-3 py-2">
          <div className="text-[10px] text-muted-foreground mb-0.5">reputation</div>
          <div
            className="text-[13px] font-bold font-mono"
            style={{ color: agent.reputationScore >= 1 ? "#00C4AA" : agent.reputationScore >= 0.5 ? "#f59e0b" : "#f04444" }}
          >
            {(agent.reputationScore ?? 1).toFixed(2)}
          </div>
        </div>
      </div>

      <div className="mb-3">
        <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wide font-semibold mb-1.5">policy</div>
        <div className="flex flex-wrap gap-1">
          {agent.policy.allowedIntents.map((i) => (
            <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
              {i}
            </span>
          ))}
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/50">
            max {agent.policy.maxTxAmountSOL} SOL/tx
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/50">
            {agent.policy.dailySpendLimitSOL} SOL/day
          </span>
          {agent.policy.maxRiskScore !== undefined && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              risk ≤ {agent.policy.maxRiskScore}
            </span>
          )}
          {agent.policy.cooldownMs !== undefined && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/50">
              {agent.policy.cooldownMs / 1000}s cooldown
            </span>
          )}
        </div>
      </div>

      {agent.lastActivityAt && (
        <div className="text-[10px] text-muted-foreground/60 mb-3">
          last active {new Date(agent.lastActivityAt).toLocaleString()}
        </div>
      )}

      {selected && agent.recentTxs.length > 0 && (
        <div>
          <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wide font-semibold mb-1.5">recent transactions</div>
          <div className="rounded-lg border border-border/50 bg-muted/30 px-2 py-1">
            {agent.recentTxs.slice(0, 5).map((tx) => (
              <TxRow key={tx.id} tx={tx} />
            ))}
          </div>
        </div>
      )}

      {selected && agent.recentTxs.length === 0 && (
        <div className="text-[11px] text-muted-foreground text-center py-2">no transactions yet</div>
      )}
    </div>
  );
}
