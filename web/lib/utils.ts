import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortKey(key: string, chars = 4) {
  if (!key) return "";
  return `${key.slice(0, chars)}...${key.slice(-chars)}`;
}

export function relTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function agentInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export function agentColor(name: string): string {
  if (name.includes("Sentinel")) return "#00BFA6";
  if (name.includes("Trader")) return "#4d9fff";
  if (name.includes("Experimental")) return "#a78bfa";
  return "#666";
}
