import { ScrollArea } from "@/components/ui/scroll-area";
import type { DecisionEntry } from "@/lib/types";
import { agentColor, fmtTime, shortKey } from "@/lib/utils";

interface Props {
  entries: DecisionEntry[];
  agentNames: Record<string, string>;
}

function ActionPill({ action, rejected }: { action: string; rejected: boolean }) {
  if (rejected) {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md"
        style={{ color: "#f04444", background: "rgba(240,68,68,0.12)", border: "1px solid rgba(240,68,68,0.2)" }}>
        ✕&nbsp;rejected
      </span>
    );
  }
  if (action === "transfer" || action === "transferSpl") {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md"
        style={{ color: "#00C4AA", background: "rgba(0,196,170,0.10)", border: "1px solid rgba(0,196,170,0.20)" }}>
        ↑&nbsp;transfer
      </span>
    );
  }
  if (action === "callProgram") {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md"
        style={{ color: "#5b9fff", background: "rgba(91,159,255,0.10)", border: "1px solid rgba(91,159,255,0.20)" }}>
        ⬡&nbsp;program
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded-md"
      style={{ color: "hsl(var(--muted-foreground))", background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}>
      hold
    </span>
  );
}

export default function DecisionFeed({ entries, agentNames }: Props) {
  if (!entries.length) {
    return (
      <div className="py-12 text-center">
        <div className="text-2xl mb-3 opacity-30">◌</div>
        <p className="text-muted-foreground text-xs">no decisions yet</p>
        <p className="text-muted-foreground/50 text-[11px] mt-1">
          run <code className="text-primary bg-muted px-1 py-0.5 rounded">npm run llm-run</code>
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-0">
        {entries.map((e, i) => {
          const name = agentNames[e.agentId] ?? e.agentId;
          const color = agentColor(name);
          const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
          const shortName = name.replace("Aegis ", "");
          const conf = Math.round(e.confidence * 100);

          return (
            <div
              key={i}
              className="py-3 border-b border-border/40 last:border-0 hover:bg-accent/20 transition-colors rounded-lg px-2 -mx-2"
            >
              <div className="flex items-start gap-2.5">
                {/* avatar */}
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5"
                  style={{ background: color + "18", border: `1px solid ${color}35`, color }}
                >
                  {initials}
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  {/* row 1: name + badge + conf + time */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-foreground/80">{shortName}</span>
                    <ActionPill action={e.action} rejected={e.rejected} />
                    <span className="ml-auto text-[10px] text-muted-foreground/60 tabular-nums">{conf}%</span>
                    <span className="text-[10px] text-muted-foreground/50 font-mono">{fmtTime(e.ts)}</span>
                  </div>

                  {/* reasoning */}
                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                    {e.rejected ? (e.rejectionReason ?? e.reasoning) : e.reasoning}
                  </p>

                  {/* sig link */}
                  {e.sig && (
                    <a
                      href={`https://explorer.solana.com/tx/${e.sig}?cluster=devnet`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-mono transition-opacity hover:opacity-80"
                      style={{ color: "#00C4AA" }}
                    >
                      {shortKey(e.sig, 6)}
                      <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                        <path d="M1.5 7.5L7.5 1.5M7.5 1.5H3M7.5 1.5V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
