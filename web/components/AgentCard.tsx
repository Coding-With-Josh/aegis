import { Badge } from "@/components/ui/badge";
import type { AgentState } from "@/lib/types";
import { agentColor, agentInitials, shortKey, relTime, cn } from "@/lib/utils";

interface Props {
  agent: AgentState;
  selected: boolean;
  onClick: () => void;
}

export default function AgentCard({ agent, selected, onClick }: Props) {
  const color = agentColor(agent.agentName);
  const maxPct = agent.riskProfile ? `${(agent.riskProfile.maxPct * 100).toFixed(0)}%` : "–";
  const actions = agent.riskProfile?.allowedActions ?? [];
  const isActive = !!agent.lastTs;

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl border bg-card cursor-pointer transition-all duration-200 overflow-hidden group",
        selected
          ? "border-opacity-60"
          : "border-border hover:border-border/80 hover:bg-card/80"
      )}
      style={selected
        ? { borderColor: color + "55", boxShadow: `0 0 0 1px ${color}22, 0 4px 24px ${color}10` }
        : undefined
      }
    >
      {/* top accent bar */}
      <div
        className="h-[2px] w-full transition-opacity duration-200"
        style={{
          background: `linear-gradient(90deg, ${color}80 0%, transparent 100%)`,
          opacity: selected ? 1 : 0.4,
        }}
      />

      <div className="px-4 pt-3 pb-4 space-y-3.5">
        {/* header */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-bold shrink-0"
            style={{
              background: `linear-gradient(135deg, ${color}20 0%, ${color}08 100%)`,
              border: `1px solid ${color}35`,
              color,
            }}
          >
            {agentInitials(agent.agentName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-foreground leading-none mb-1">{agent.agentName}</div>
            <div className="text-[10px] text-muted-foreground font-mono leading-none">{shortKey(agent.publicKey, 6)}</div>
          </div>
          <Badge
            variant="outline"
            className="text-[10px] px-2 h-5 shrink-0"
            style={isActive
              ? { color: "#00C4AA", borderColor: "rgba(0,196,170,0.3)", background: "rgba(0,196,170,0.08)" }
              : { color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))", background: "transparent" }
            }
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full mr-1.5"
              style={{
                background: isActive ? "#00C4AA" : "hsl(var(--muted-foreground))",
                boxShadow: isActive ? "0 0 5px rgba(0,196,170,0.7)" : "none",
              }}
            />
            {isActive ? "active" : "idle"}
          </Badge>
        </div>

        {/* balance */}
        <div>
            <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-widest">balance</p>
          <p className="text-[22px] font-bold tracking-tight leading-none tabular-nums">
            {agent.balanceSol.toFixed(4)}{" "}
            <span className="text-[12px] text-muted-foreground font-normal">SOL</span>
          </p>
        </div>

        {/* risk pills */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-muted/60 border border-border/50 px-3 py-2">
            <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-[0.08em]">max/tx</p>
            <p className="text-[13px] font-bold leading-none" style={{ color }}>{maxPct}</p>
          </div>
          <div className="rounded-lg bg-muted/60 border border-border/50 px-3 py-2">
            <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-[0.08em]">allowed</p>
            <p className="text-[11px] font-medium truncate leading-none">{actions.join(", ")}</p>
          </div>
        </div>

        {/* last decision */}
        {agent.lastReasoning && (
          <div className="pt-3 border-t border-border/60">
            <div className="flex justify-between items-center mb-1.5">
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: agent.lastAction === "hold" ? "hsl(var(--muted-foreground))" : "#00C4AA" }}
              >
                {agent.lastAction}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {agent.lastTs ? relTime(agent.lastTs) : ""}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
              {agent.lastReasoning}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
