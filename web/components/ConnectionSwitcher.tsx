"use client";

import { useState } from "react";
import { PRESETS, type PresetKey, type ConnectionConfig } from "@/lib/config";
import { cn } from "@/lib/utils";

interface Props {
  preset: PresetKey | "custom";
  config: ConnectionConfig;
  onChange: (preset: PresetKey | "custom", config: ConnectionConfig) => void;
}

export default function ConnectionSwitcher({ preset, config, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);

  function selectPreset(key: PresetKey) {
    onChange(key, { coreUrl: PRESETS[key].coreUrl, nodeUrl: PRESETS[key].nodeUrl });
    setExpanded(false);
  }

  function updateUrl(field: keyof ConnectionConfig, value: string) {
    onChange("custom", { ...config, [field]: value });
  }

  const isOnline = preset === "deployed";

  return (
    <div className="px-2.5 pb-3">
      <div className="rounded-lg border border-border/60 bg-muted/30 overflow-hidden">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent/40 transition-colors cursor-pointer"
        >
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              background: isOnline ? "#00C4AA" : "#5b9fff",
              boxShadow: isOnline ? "0 0 6px rgba(0,196,170,0.6)" : "0 0 6px rgba(91,159,255,0.5)",
            }}
          />
          <span className="text-[11px] text-foreground font-medium flex-1">
            {preset === "custom" ? "custom" : PRESETS[preset].label}
          </span>
          <svg
            width="10" height="10" viewBox="0 0 10 10" fill="none"
            className={cn("text-muted-foreground transition-transform", expanded && "rotate-180")}
          >
            <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {expanded && (
          <div className="border-t border-border/50 px-3 py-2.5 space-y-2.5">
            <div className="flex gap-1.5">
              {(Object.keys(PRESETS) as PresetKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => selectPreset(key)}
                  className={cn(
                    "flex-1 text-[10px] py-1 rounded-md border transition-all cursor-pointer",
                    preset === key
                      ? "bg-primary/15 border-primary/40 text-primary font-semibold"
                      : "bg-muted/50 border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                  )}
                >
                  {PRESETS[key].label}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <div>
                <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide mb-0.5">core API</p>
                <input
                  value={config.coreUrl}
                  onChange={(e) => updateUrl("coreUrl", e.target.value)}
                  className="w-full text-[10px] bg-background border border-border/50 rounded px-2 py-1 text-foreground font-mono focus:outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide mb-0.5">node API</p>
                <input
                  value={config.nodeUrl}
                  onChange={(e) => updateUrl("nodeUrl", e.target.value)}
                  className="w-full text-[10px] bg-background border border-border/50 rounded px-2 py-1 text-foreground font-mono focus:outline-none focus:border-primary/50"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
