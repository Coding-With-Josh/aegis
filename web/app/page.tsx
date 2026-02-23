"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { fetchState, fetchNodeAgents } from "@/lib/api";
import { loadConfig, saveConfig, PRESETS, type PresetKey, type ConnectionConfig } from "@/lib/config";
import type { ApiState, NodeAgentState } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import StatCard from "@/components/StatCard";
import AgentCard from "@/components/AgentCard";
import NodeAgentCard from "@/components/NodeAgentCard";
import DecisionFeed from "@/components/DecisionFeed";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

const ActivityChart = dynamic(() => import("@/components/ActivityChart"), { ssr: false });

const POLL_MS = 8000;

export default function Dashboard() {
  const [state, setState] = useState<ApiState | null>(null);
  const [nodeAgents, setNodeAgents] = useState<NodeAgentState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [nodeSelected, setNodeSelected] = useState<string | null>(null);
  const [view, setView] = useState<"dashboard" | "agents" | "node">("dashboard");
  const [tab, setTab] = useState<"all" | "executed" | "rejected">("all");

  const [connectionPreset, setConnectionPreset] = useState<PresetKey | "custom">("local");
  const [connectionConfig, setConnectionConfig] = useState<ConnectionConfig>({ ...PRESETS.local });

  useEffect(() => {
    const saved = loadConfig();
    setConnectionPreset(saved.preset);
    setConnectionConfig({ coreUrl: saved.coreUrl, nodeUrl: saved.nodeUrl });
  }, []);

  function handleConnectionChange(preset: PresetKey | "custom", config: ConnectionConfig) {
    setConnectionPreset(preset);
    setConnectionConfig(config);
    saveConfig({ ...config, preset });
  }

  const load = useCallback(async () => {
    try {
      const [data, nodeData] = await Promise.all([
        fetchState(connectionConfig.coreUrl),
        fetchNodeAgents(connectionConfig.nodeUrl),
      ]);
      setState(data);
      setNodeAgents(nodeData);
      setLastRefresh(new Date());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [connectionConfig]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const agents = state?.agents ?? [];
  const history = state?.recentHistory ?? [];
  const agentNames = Object.fromEntries(agents.map((a) => [a.agentId, a.agentName]));

  const totalSol = agents.reduce((s, a) => s + a.balanceSol, 0);
  const totalExecuted = history.filter((h) => !h.rejected && h.action !== "hold").length;
  const totalRejected = history.filter((h) => h.rejected).length;

  const filteredHistory = selected ? history.filter((e) => e.agentId === selected) : history;
  const visibleHistory = (() => {
    let h = filteredHistory;
    if (tab === "executed") h = h.filter((e) => !e.rejected && e.action !== "hold");
    if (tab === "rejected") h = h.filter((e) => e.rejected);
    return [...h].reverse();
  })();

  const selectedAgent = selected ? agents.find((a) => a.agentId === selected) : null;

  return (
    <TooltipProvider>
      <div className="flex w-screen h-screen overflow-hidden bg-background">
        <Sidebar
          agents={agents}
          nodeAgentCount={nodeAgents.length}
          selected={selected}
          onSelect={(id) => { setSelected((s) => s === id ? null : id); setView("dashboard"); }}
          view={view}
          onViewChange={(v) => { setView(v); setSelected(null); setNodeSelected(null); }}
          connectionPreset={connectionPreset}
          connectionConfig={connectionConfig}
          onConnectionChange={handleConnectionChange}
        />

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* topbar */}
          <div className="h-13 shrink-0 flex items-center justify-between px-6 border-b border-border bg-card">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight">
                {selectedAgent ? selectedAgent.agentName : view === "agents" ? "Agents" : view === "node" ? "Node Agents" : "Dashboard"}
              </h1>
              {selectedAgent && (
                <span className="text-[11px] text-muted-foreground px-2 py-0.5 rounded-md bg-muted border border-border">
                  {selectedAgent.provider}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {error && (
                <Badge variant="destructive" className="text-[11px]">api unreachable</Badge>
              )}
              {lastRefresh && (
                <span className="text-[11px] text-muted-foreground">{lastRefresh.toLocaleTimeString()}</span>
              )}
              <button
                onClick={load}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg bg-muted/60 border border-border hover:border-border/80 cursor-pointer flex items-center gap-1.5"
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="shrink-0">
                  <path d="M9.5 5.5A4 4 0 1 1 5.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  <path d="M5.5 1.5L7.5 3.5L5.5 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                refresh
              </button>
            </div>
          </div>

          {/* body */}
          <div className="flex-1 overflow-hidden flex">
            {!state && !error && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <span className="text-sm">connecting...</span>
              </div>
            )}

            {error && !state && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-xl">
                  ⚡
                </div>
                <div className="text-center">
                  <p className="text-sm text-foreground font-medium mb-1">API unreachable</p>
                  <p className="text-muted-foreground text-[12px]">
                    run{" "}
                    <code className="text-primary bg-muted px-1.5 py-0.5 rounded-md">npm run serve</code>
                    {" "}first
                  </p>
                </div>
              </div>
            )}

            {state && view === "agents" && (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
                  {agents.map((agent) => (
                    <AgentCard
                      key={agent.agentId}
                      agent={agent}
                      selected={selected === agent.agentId}
                      onClick={() => setSelected((s) => s === agent.agentId ? null : agent.agentId)}
                    />
                  ))}
                </div>
              </div>
            )}

            {view === "node" && (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="flex gap-3">
                  <StatCard label="Node Agents" value={nodeAgents.length} sub="managed by @aegis-ai/node" accent />
                  <StatCard
                    label="Total SOL"
                    value={nodeAgents.reduce((s, a) => s + a.balanceSol, 0).toFixed(4)}
                    sub="across node agents"
                  />
                  <StatCard
                    label="Spent Today"
                    value={nodeAgents.reduce((s, a) => s + (a.dailySpend?.sol ?? 0), 0).toFixed(4)}
                    sub="SOL across all agents"
                  />
                  <StatCard
                    label="Transactions"
                    value={nodeAgents.reduce((s, a) => s + a.recentTxs.filter((t) => t.status === "confirmed").length, 0)}
                    sub="confirmed on-chain"
                  />
                </div>

                {nodeAgents.length === 0 && (
                  <div className="flex flex-col items-center justify-center gap-4 py-20 text-muted-foreground">
                    <div className="w-12 h-12 rounded-2xl bg-muted border border-border flex items-center justify-center text-xl">N</div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground mb-1">no node agents yet</p>
                      <p className="text-[12px]">
                        create one with{" "}
                        <code className="text-primary bg-muted px-1.5 py-0.5 rounded-md">
                          POST {connectionConfig.nodeUrl}/agents
                        </code>
                      </p>
                    </div>
                  </div>
                )}

                {nodeAgents.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70 mb-3">
                      Node Agents
                    </p>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
                      {nodeAgents.map((agent) => (
                        <NodeAgentCard
                          key={agent.agentId}
                          agent={agent}
                          selected={nodeSelected === agent.agentId}
                          onClick={() => setNodeSelected((s) => s === agent.agentId ? null : agent.agentId)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {state && view === "dashboard" && (
              <div className="flex-1 flex overflow-hidden">
                {/* left — main content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 min-w-0">

                  {/* stat cards */}
                  <div className="flex gap-3">
                    <StatCard label="Active Agents" value={agents.length} sub={`${agents.filter((a) => !!a.lastTs).length} with activity`} accent />
                    <StatCard label="Transactions" value={totalExecuted} sub="on-chain this session" />
                    <StatCard label="Rejected" value={totalRejected} sub="by validation firewall" warn={totalRejected > 0} />
                    <StatCard label="Total SOL" value={totalSol.toFixed(4)} sub="across all agents" />
                  </div>

                  {/* chart */}
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="px-5 pt-4 pb-3 flex items-start justify-between border-b border-border/50">
                      <div>
                        <h2 className="text-[13px] font-semibold text-foreground">Decision activity</h2>
                        <p className="text-[11px] text-muted-foreground mt-0.5">decisions per minute across all agents</p>
                      </div>
                      <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-0.5">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#00C4AA" }} />
                          executed
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#5b9fff" }} />
                          held
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#f04444" }} />
                          rejected
                        </span>
                      </div>
                    </div>
                    <div className="px-5 py-4">
                      <ActivityChart history={history} />
                    </div>
                  </div>

                  {/* agent cards */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70 mb-3">Agents</p>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3">
                      {agents.map((agent) => (
                        <AgentCard
                          key={agent.agentId}
                          agent={agent}
                          selected={selected === agent.agentId}
                          onClick={() => setSelected((s) => s === agent.agentId ? null : agent.agentId)}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* right — decision feed */}
                <div className="w-[360px] shrink-0 flex flex-col overflow-hidden border-l border-border bg-card/30">
                  <div className="px-5 pt-4 pb-0 shrink-0">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-[13px] font-semibold">
                        {selectedAgent ? `${selectedAgent.agentName.replace("Aegis ", "")} decisions` : "Recent decisions"}
                      </h2>
                      {selected && (
                        <button
                          onClick={() => setSelected(null)}
                          className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer border-0 bg-transparent flex items-center gap-1 transition-colors"
                        >
                          clear
                          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                            <path d="M1.5 1.5l6 6M7.5 1.5l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                          </svg>
                        </button>
                      )}
                    </div>

                    <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
                      <TabsList className="h-8 bg-muted/60 p-0.5 w-full border border-border/50 rounded-lg">
                        <TabsTrigger value="all" className="flex-1 text-[11px] h-7 rounded-md">
                          all ({filteredHistory.length})
                        </TabsTrigger>
                        <TabsTrigger value="executed" className="flex-1 text-[11px] h-7 rounded-md">
                          executed ({filteredHistory.filter((h) => !h.rejected && h.action !== "hold").length})
                        </TabsTrigger>
                        <TabsTrigger value="rejected" className="flex-1 text-[11px] h-7 rounded-md">
                          rejected ({filteredHistory.filter((h) => h.rejected).length})
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>

                    <div className="h-px bg-border/50 mt-3" />
                  </div>

                  <div className="flex-1 overflow-hidden px-4 pt-2 pb-4">
                    <DecisionFeed entries={visibleHistory} agentNames={agentNames} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
