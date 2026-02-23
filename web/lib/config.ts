"use client";

export interface ConnectionConfig {
  coreUrl: string;
  nodeUrl: string;
}

export const PRESETS = {
  local: {
    label: "local",
    coreUrl: "http://localhost:5000",
    nodeUrl: "http://localhost:4000",
  },
  deployed: {
    label: "deployed",
    coreUrl: "http://localhost:5000",
    nodeUrl: "https://aegis-ycdm.onrender.com",
  },
} as const;

export type PresetKey = keyof typeof PRESETS;

const STORAGE_KEY = "aegis_connection";

export function loadConfig(): ConnectionConfig & { preset: PresetKey | "custom" } {
  if (typeof window === "undefined") {
    return { ...PRESETS.local, preset: "local" };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { ...PRESETS.local, preset: "local" };
}

export function saveConfig(config: ConnectionConfig & { preset: PresetKey | "custom" }): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
