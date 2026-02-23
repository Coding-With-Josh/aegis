"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import ConnectionSwitcher from "@/components/ConnectionSwitcher";
import type { AgentState } from "@/lib/types";
import type { ConnectionConfig, PresetKey } from "@/lib/config";
import { agentColor, agentInitials, cn } from "@/lib/utils";

interface Props {
  agents: AgentState[];
  nodeAgentCount: number;
  selected: string | null;
  onSelect: (id: string) => void;
  view: "dashboard" | "agents" | "node";
  onViewChange: (v: "dashboard" | "agents" | "node") => void;
  connectionPreset: PresetKey | "custom";
  connectionConfig: ConnectionConfig;
  onConnectionChange: (preset: PresetKey | "custom", config: ConnectionConfig) => void;
}

const NAV = [
  { id: "dashboard" as const, label: "Dashboard", icon: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="5" height="5" rx="1.5" fill="currentColor" opacity=".9"/>
      <rect x="8" y="1" width="5" height="5" rx="1.5" fill="currentColor" opacity=".5"/>
      <rect x="1" y="8" width="5" height="5" rx="1.5" fill="currentColor" opacity=".5"/>
      <rect x="8" y="8" width="5" height="5" rx="1.5" fill="currentColor" opacity=".3"/>
    </svg>
  )},
  { id: "agents" as const, label: "Agents", icon: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="4.5" r="2.5" fill="currentColor" opacity=".9"/>
      <path d="M1.5 12c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".6"/>
    </svg>
  )},
  { id: "node" as const, label: "Node Agents", icon: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="2" fill="currentColor" opacity=".9"/>
      <circle cx="2" cy="3" r="1.5" fill="currentColor" opacity=".5"/>
      <circle cx="12" cy="3" r="1.5" fill="currentColor" opacity=".5"/>
      <circle cx="2" cy="11" r="1.5" fill="currentColor" opacity=".5"/>
      <circle cx="12" cy="11" r="1.5" fill="currentColor" opacity=".5"/>
      <path d="M3.5 3.5L5.5 5.5M10.5 3.5L8.5 5.5M3.5 10.5L5.5 8.5M10.5 10.5L8.5 8.5" stroke="currentColor" strokeWidth="1" opacity=".4"/>
    </svg>
  )},
];

export default function Sidebar({ agents, nodeAgentCount, selected, onSelect, view, onViewChange, connectionPreset, connectionConfig, onConnectionChange }: Props) {
  return (
    <aside className="w-[224px] min-w-[224px] h-screen flex flex-col bg-sidebar border-r border-sidebar-border">
      {/* logo */}
      <div className="flex items-center gap-3 px-4 h-14 shrink-0">
        <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 flex items-center justify-center bg-black"
          style={{ boxShadow: "0 0 16px rgba(0,196,170,0.2)" }}
        >
          <Image src="/logo.png" alt="Aegis" width={32} height={32} className="w-full h-full object-contain" priority />
        </div>
        <div>
          <div className="text-[13px] font-bold tracking-tight text-foreground leading-none">Aegis</div>
          <div className="text-[10px] text-muted-foreground mt-0.5 leading-none">devnet</div>
        </div>
      </div>

      <div className="h-px bg-sidebar-border shrink-0 mx-0" />

      {/* nav */}
      <div className="px-2.5 pt-4 pb-2 shrink-0">
        <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">Platform</p>
        {NAV.map((item) => {
          const active = view === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] mb-0.5 transition-all duration-150 cursor-pointer border-0 text-left",
                active
                  ? "bg-primary/12 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <span className={cn("shrink-0 transition-colors", active ? "text-primary" : "text-muted-foreground/60")}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {item.id === "agents" && agents.length > 0 && (
                <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5 font-semibold">
                  {agents.length}
                </Badge>
              )}
              {item.id === "node" && nodeAgentCount > 0 && (
                <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5 font-semibold">
                  {nodeAgentCount}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      <div className="h-px bg-sidebar-border shrink-0 mx-2.5" />

      {/* agents list */}
      <div className="px-2.5 pt-3 flex-1 overflow-hidden flex flex-col min-h-0">
        <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70 shrink-0">Active Agents</p>
        <ScrollArea className="flex-1">
          <div className="space-y-0.5 pr-1">
            {agents.map((agent) => {
              const color = agentColor(agent.agentName);
              const active = selected === agent.agentId;
              const isLive = !!agent.lastTs;
              return (
                <button
                  key={agent.agentId}
                  onClick={() => onSelect(agent.agentId)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 cursor-pointer border-0 text-left group",
                    active
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  )}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-bold shrink-0 transition-all"
                    style={{
                      background: active ? color + "28" : color + "15",
                      border: `1px solid ${color}${active ? "50" : "30"}`,
                      color,
                    }}
                  >
                    {agentInitials(agent.agentName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium truncate leading-none mb-0.5">
                      {agent.agentName.replace("Aegis ", "")}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono leading-none">
                      {agent.balanceSol.toFixed(3)} SOL
                    </div>
                  </div>
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0 transition-all"
                    style={{
                      background: isLive ? "#00C4AA" : "oklch(0.3 0 0)",
                      boxShadow: isLive ? "0 0 6px rgba(0,196,170,0.6)" : "none",
                    }}
                  />
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      <div className="h-px bg-sidebar-border shrink-0" />
      <div className="pt-2.5">
        <p className="px-4 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">Connection</p>
        <ConnectionSwitcher
          preset={connectionPreset}
          config={connectionConfig}
          onChange={onConnectionChange}
        />
      </div>
    </aside>
  );
}
