import { getTransactionsByAgent, getCapitalEvents } from "../db.js";

function csvEscape(val: unknown): string {
  const s = val === null || val === undefined ? "" : String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(...cols: unknown[]): string {
  return cols.map(csvEscape).join(",");
}

export function exportAccountingCSV(agentId: string): string {
  const txs = getTransactionsByAgent(agentId, 10000);
  const events = getCapitalEvents(agentId, 10000);

  const lines: string[] = [
    row("date", "type", "intent_type", "signature", "amount_sol", "usd_value", "status", "note"),
  ];

  for (const t of txs) {
    lines.push(row(
      t.created_at,
      "transaction",
      t.intent_type,
      t.signature ?? "",
      t.amount ?? "",
      t.usd_value ?? "",
      t.status,
      t.reasoning ?? "",
    ));
  }

  for (const e of events) {
    lines.push(row(
      e.created_at,
      `capital_${e.event_type}`,
      "",
      "",
      e.amount_sol ?? "",
      e.amount_usd ?? "",
      "recorded",
      e.source_note ?? "",
    ));
  }

  return lines.join("\n");
}
