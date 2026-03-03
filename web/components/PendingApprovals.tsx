"use client";

import { useState } from "react";
import type { PendingTxSummary } from "@/lib/types";
import { approvePending, rejectPending } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  nodeUrl: string;
  agentId: string;
  pending: PendingTxSummary[];
  nodeApiKey?: string;
  onRefresh: () => void;
  className?: string;
}

export default function PendingApprovals({
  nodeUrl,
  agentId,
  pending,
  nodeApiKey,
  onRefresh,
  className,
}: Props) {
  const [actioning, setActioning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const awaiting = pending.filter((p) => p.status === "awaiting_approval");
  const canAct = !!nodeApiKey?.trim();

  async function handleApprove(txId: string) {
    if (!nodeApiKey) return;
    setActioning(txId);
    setError(null);
    try {
      await approvePending(nodeUrl, agentId, txId, nodeApiKey);
      onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActioning(null);
    }
  }

  async function handleReject(txId: string) {
    if (!nodeApiKey) return;
    setActioning(txId);
    setError(null);
    try {
      await rejectPending(nodeUrl, agentId, txId, nodeApiKey);
      onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActioning(null);
    }
  }

  if (awaiting.length === 0) {
    return (
      <div className={cn("text-[11px] text-muted-foreground py-2", className)}>
        no pending approvals
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {!canAct && (
        <p className="text-[10px] text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1.5">
          Set node API key in connection settings to approve or reject.
        </p>
      )}
      {error && (
        <p className="text-[10px] text-destructive bg-destructive/10 rounded px-2 py-1.5">{error}</p>
      )}
      <div className="space-y-2 max-h-[220px] overflow-y-auto">
        {awaiting.map((p) => (
          <div
            key={p.id}
            className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 space-y-2"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-primary/15 text-primary">
                {p.intent.type}
              </span>
              {p.usdValue != null && (
                <span className="text-[10px] font-mono text-muted-foreground">
                  ${p.usdValue.toFixed(2)}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground/70">
                expires {new Date(p.expiresAt).toLocaleString()}
              </span>
            </div>
            {p.reasoning && (
              <p className="text-[10px] text-muted-foreground truncate" title={p.reasoning}>
                {p.reasoning}
              </p>
            )}
            {p.simulation && (
              <div className="text-[9px] text-muted-foreground/80">
                simulated: {p.simulation.success ? "ok" : p.simulation.error ?? "failed"}
                {p.simulation.riskReason && ` · ${p.simulation.riskReason}`}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={!canAct || actioning !== null}
                onClick={() => handleApprove(p.id)}
                className="text-[10px] font-medium px-2 py-1 rounded bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                {actioning === p.id ? "..." : "Approve"}
              </button>
              <button
                type="button"
                disabled={!canAct || actioning !== null}
                onClick={() => handleReject(p.id)}
                className="text-[10px] font-medium px-2 py-1 rounded bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                {actioning === p.id ? "..." : "Reject"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
