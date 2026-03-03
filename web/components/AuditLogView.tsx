"use client";

import { useEffect, useState } from "react";
import type { AuditEntry } from "@/lib/types";
import { fetchAuditLog } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  nodeUrl: string;
  agentId: string;
  className?: string;
}

function AuditEntryRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false);
  const risk = entry.usdRiskCheck;
  const sim = entry.simulationResult;

  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors cursor-pointer"
      >
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0"
          style={{
            background:
              entry.approvalState === "auto" || entry.approvalState === "approved"
                ? "#00C4AA18"
                : entry.approvalState === "rejected" || entry.approvalState === "pending"
                  ? "#f0444418"
                  : "#5b9fff18",
            color:
              entry.approvalState === "auto" || entry.approvalState === "approved"
                ? "#00C4AA"
                : entry.approvalState === "rejected" || entry.approvalState === "pending"
                  ? "#f04444"
                  : "#5b9fff",
          }}
        >
          {entry.intent.type}
        </span>
        <span className="text-[10px] text-muted-foreground flex-1 truncate">
          {entry.finalTxSignature ? `sig ${entry.finalTxSignature.slice(0, 8)}...` : entry.approvalState}
        </span>
        <span className="text-[10px] text-muted-foreground/70">
          {new Date(entry.timestamp).toLocaleString()}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className={cn("shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
        >
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {expanded && (
        <div className="border-t border-border/50 px-3 py-2.5 space-y-2.5 text-[11px]">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/80 mb-1">Intent</p>
            <pre className="bg-background/50 rounded px-2 py-1 overflow-x-auto text-[10px] font-mono">
              {JSON.stringify(entry.intent, null, 2)}
            </pre>
          </div>
          {risk && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/80 mb-1">
                USD risk check
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono">${risk.usdValue.toFixed(2)}</span>
                <span
                  className="px-1.5 py-0.5 rounded text-[9px] font-medium"
                  style={{
                    background: risk.passed ? "#00C4AA18" : "#f0444418",
                    color: risk.passed ? "#00C4AA" : "#f04444",
                  }}
                >
                  {risk.passed ? "passed" : "violations"}
                </span>
                {risk.violations.length > 0 && (
                  <ul className="list-disc list-inside text-muted-foreground">
                    {risk.violations.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          {sim && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/80 mb-1">
                Simulation
              </p>
              <div className="space-y-1">
                <div className="flex gap-2 flex-wrap">
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px]"
                    style={{
                      background: sim.success ? "#00C4AA18" : "#f0444418",
                      color: sim.success ? "#00C4AA" : "#f04444",
                    }}
                  >
                    {sim.success ? "success" : sim.error ?? "failed"}
                  </span>
                  {sim.riskyEffects && sim.riskReason && (
                    <span className="text-amber-600 text-[10px]">{sim.riskReason}</span>
                  )}
                </div>
                <div className="text-muted-foreground">
                  compute ~{sim.computeUnitForecast} units
                  {sim.slippageActual != null && ` · slippage ${sim.slippageActual.toFixed(2)}%`}
                </div>
                {sim.tokenChanges.length > 0 && (
                  <div>
                    <span className="text-[9px] text-muted-foreground/80">Token deltas: </span>
                    {sim.tokenChanges.map((c, i) => (
                      <span key={i} className="text-[10px] font-mono mr-2">
                        {c.mint.slice(0, 8)}... {c.delta > 0 ? "+" : ""}{c.delta}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="flex gap-2 text-[10px] text-muted-foreground">
            <span>approval: {entry.approvalState}</span>
            {entry.finalTxSignature && (
              <span className="font-mono truncate" title={entry.finalTxSignature}>
                sig {entry.finalTxSignature.slice(0, 16)}...
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuditLogView({ nodeUrl, agentId, className }: Props) {
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAuditLog(nodeUrl, agentId, 30)
      .then((data) => {
        if (!cancelled) setAudit(data);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nodeUrl, agentId]);

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-6 text-muted-foreground text-sm", className)}>
        loading audit...
      </div>
    );
  }
  if (error) {
    return (
      <div className={cn("py-2 text-[11px] text-destructive", className)}>
        {error}
      </div>
    );
  }
  if (audit.length === 0) {
    return (
      <div className={cn("py-4 text-center text-[11px] text-muted-foreground", className)}>
        no audit entries yet
      </div>
    );
  }

  return (
    <div className={cn("space-y-2 max-h-[320px] overflow-y-auto", className)}>
      {audit.map((entry) => (
        <AuditEntryRow key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
