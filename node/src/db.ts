import Database from "better-sqlite3";
import { join } from "node:path";

const DB_PATH = process.env.DB_PATH ?? join(process.cwd(), "aegis.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
    runMigrations(_db);
  }
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      public_key TEXT NOT NULL,
      encrypted_private_key TEXT NOT NULL,
      api_key_hash TEXT NOT NULL,
      policy_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      intent_type TEXT NOT NULL,
      reasoning TEXT,
      signature TEXT,
      slot INTEGER,
      amount REAL,
      token_mint TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS spend_tracking (
      agent_id TEXT NOT NULL REFERENCES agents(id),
      date TEXT NOT NULL,
      total_spent_sol REAL NOT NULL DEFAULT 0,
      total_spent_usdc REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (agent_id, date)
    );

    CREATE TABLE IF NOT EXISTS capital_events (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      event_type TEXT NOT NULL,
      amount_sol REAL,
      amount_usd REAL,
      source_note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS policy_versions (
      agent_id TEXT NOT NULL REFERENCES agents(id),
      version INTEGER NOT NULL,
      policy_hash TEXT NOT NULL,
      policy_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (agent_id, version)
    );

    CREATE TABLE IF NOT EXISTS pending_transactions (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      intent_json TEXT NOT NULL,
      intent_hash TEXT NOT NULL,
      policy_hash TEXT NOT NULL,
      reasoning TEXT,
      usd_value REAL,
      simulation_json TEXT,
      status TEXT NOT NULL DEFAULT 'awaiting_approval',
      expires_at TEXT NOT NULL,
      webhook_notified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      intent_hash TEXT NOT NULL,
      policy_hash TEXT NOT NULL,
      intent_json TEXT NOT NULL,
      usd_risk_check_json TEXT,
      simulation_json TEXT,
      approval_state TEXT NOT NULL,
      final_tx_signature TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

function runMigrations(db: Database.Database): void {
  const agentCols = new Set((db.pragma("table_info(agents)") as { name: string }[]).map((c) => c.name));
  const txCols = new Set((db.pragma("table_info(transactions)") as { name: string }[]).map((c) => c.name));
  const spendCols = new Set((db.pragma("table_info(spend_tracking)") as { name: string }[]).map((c) => c.name));

  if (!agentCols.has("last_activity_at")) db.exec("ALTER TABLE agents ADD COLUMN last_activity_at TEXT");
  if (!agentCols.has("reputation_score")) db.exec("ALTER TABLE agents ADD COLUMN reputation_score REAL NOT NULL DEFAULT 1.0");
  if (!agentCols.has("usd_policy_json")) db.exec("ALTER TABLE agents ADD COLUMN usd_policy_json TEXT");
  if (!agentCols.has("min_operational_usd")) db.exec("ALTER TABLE agents ADD COLUMN min_operational_usd REAL DEFAULT 5.0");
  if (!agentCols.has("webhook_url")) db.exec("ALTER TABLE agents ADD COLUMN webhook_url TEXT");
  if (!agentCols.has("execution_mode")) db.exec("ALTER TABLE agents ADD COLUMN execution_mode TEXT NOT NULL DEFAULT 'autonomous'");

  if (!txCols.has("policy_hash")) db.exec("ALTER TABLE transactions ADD COLUMN policy_hash TEXT");
  if (!txCols.has("policy_version")) db.exec("ALTER TABLE transactions ADD COLUMN policy_version INTEGER NOT NULL DEFAULT 1");
  if (!txCols.has("intent_hash")) db.exec("ALTER TABLE transactions ADD COLUMN intent_hash TEXT");
  if (!txCols.has("usd_value")) db.exec("ALTER TABLE transactions ADD COLUMN usd_value REAL");

  if (!spendCols.has("total_spent_usd")) db.exec("ALTER TABLE spend_tracking ADD COLUMN total_spent_usd REAL NOT NULL DEFAULT 0");
  if (!spendCols.has("peak_portfolio_usd")) db.exec("ALTER TABLE spend_tracking ADD COLUMN peak_portfolio_usd REAL NOT NULL DEFAULT 0");
}

export interface AgentRow {
  id: string;
  public_key: string;
  encrypted_private_key: string;
  api_key_hash: string;
  policy_json: string;
  usd_policy_json: string | null;
  status: string;
  execution_mode: string;
  created_at: string;
  last_activity_at: string | null;
  reputation_score: number;
  min_operational_usd: number | null;
  webhook_url: string | null;
}

export interface TransactionRow {
  id: string;
  agent_id: string;
  intent_type: string;
  reasoning: string | null;
  signature: string | null;
  slot: number | null;
  amount: number | null;
  token_mint: string | null;
  status: string;
  created_at: string;
  policy_hash: string | null;
  policy_version: number;
  intent_hash: string | null;
  usd_value: number | null;
}

export interface SpendRow {
  agent_id: string;
  date: string;
  total_spent_sol: number;
  total_spent_usdc: number;
  total_spent_usd: number;
  peak_portfolio_usd: number;
}

export interface CapitalEventRow {
  id: string;
  agent_id: string;
  event_type: string;
  amount_sol: number | null;
  amount_usd: number | null;
  source_note: string | null;
  created_at: string;
}

export interface PolicyVersionRow {
  agent_id: string;
  version: number;
  policy_hash: string;
  policy_json: string;
  created_at: string;
}

export interface PendingTransactionRow {
  id: string;
  agent_id: string;
  intent_json: string;
  intent_hash: string;
  policy_hash: string;
  reasoning: string | null;
  usd_value: number | null;
  simulation_json: string | null;
  status: string;
  expires_at: string;
  webhook_notified: number;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  agent_id: string;
  intent_hash: string;
  policy_hash: string;
  intent_json: string;
  usd_risk_check_json: string | null;
  simulation_json: string | null;
  approval_state: string;
  final_tx_signature: string | null;
  created_at: string;
}

export function insertAgent(row: Omit<AgentRow, "last_activity_at" | "reputation_score" | "usd_policy_json" | "min_operational_usd" | "webhook_url" | "execution_mode">): void {
  getDb()
    .prepare(
      `INSERT INTO agents (id, public_key, encrypted_private_key, api_key_hash, policy_json, status, created_at)
       VALUES (@id, @public_key, @encrypted_private_key, @api_key_hash, @policy_json, @status, @created_at)`
    )
    .run(row);
}

export function getAgentById(id: string): AgentRow | undefined {
  return getDb()
    .prepare("SELECT * FROM agents WHERE id = ?")
    .get(id) as AgentRow | undefined;
}

export function getAllAgents(): AgentRow[] {
  return getDb()
    .prepare("SELECT * FROM agents ORDER BY created_at DESC")
    .all() as AgentRow[];
}

export function updateAgentStatus(id: string, status: string): void {
  getDb().prepare("UPDATE agents SET status = ? WHERE id = ?").run(status, id);
}

export function updateAgentActivity(id: string): void {
  getDb().prepare("UPDATE agents SET last_activity_at = ? WHERE id = ?").run(new Date().toISOString(), id);
}

export function updateReputation(id: string, delta: number): void {
  getDb()
    .prepare("UPDATE agents SET reputation_score = MAX(0, MIN(10, reputation_score + ?)) WHERE id = ?")
    .run(delta, id);
}

export function updateAgentUSDPolicy(id: string, usdPolicyJson: string): void {
  getDb().prepare("UPDATE agents SET usd_policy_json = ? WHERE id = ?").run(usdPolicyJson, id);
}

export function updateAgentWebhook(id: string, webhookUrl: string | null): void {
  getDb().prepare("UPDATE agents SET webhook_url = ? WHERE id = ?").run(webhookUrl, id);
}

export function updateAgentExecutionMode(id: string, mode: string): void {
  getDb().prepare("UPDATE agents SET execution_mode = ? WHERE id = ?").run(mode, id);
}

export type InsertTransactionRow = Omit<TransactionRow, "policy_version" | "policy_hash" | "intent_hash" | "usd_value"> & {
  policy_version?: number;
  policy_hash?: string | null;
  intent_hash?: string | null;
  usd_value?: number | null;
};

export function insertTransaction(row: InsertTransactionRow): void {
  const merged: TransactionRow = {
    policy_version: row.policy_version ?? 1,
    policy_hash: row.policy_hash ?? null,
    intent_hash: row.intent_hash ?? null,
    usd_value: row.usd_value ?? null,
    id: row.id,
    agent_id: row.agent_id,
    intent_type: row.intent_type,
    reasoning: row.reasoning,
    signature: row.signature,
    slot: row.slot,
    amount: row.amount,
    token_mint: row.token_mint,
    status: row.status,
    created_at: row.created_at,
  };
  getDb()
    .prepare(
      `INSERT INTO transactions (id, agent_id, intent_type, reasoning, signature, slot, amount, token_mint, status, created_at, policy_hash, policy_version, intent_hash, usd_value)
       VALUES (@id, @agent_id, @intent_type, @reasoning, @signature, @slot, @amount, @token_mint, @status, @created_at, @policy_hash, @policy_version, @intent_hash, @usd_value)`
    )
    .run(merged);
}

export function getTransactionsByAgent(agentId: string, limit = 50): TransactionRow[] {
  return getDb()
    .prepare("SELECT * FROM transactions WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(agentId, limit) as TransactionRow[];
}

export function getSpend(agentId: string, date: string): SpendRow {
  const row = getDb()
    .prepare("SELECT * FROM spend_tracking WHERE agent_id = ? AND date = ?")
    .get(agentId, date) as SpendRow | undefined;
  return row ?? { agent_id: agentId, date, total_spent_sol: 0, total_spent_usdc: 0, total_spent_usd: 0, peak_portfolio_usd: 0 };
}

export function upsertSpend(agentId: string, date: string, deltaSol: number, deltaUsdc: number, deltaUsd = 0): void {
  getDb()
    .prepare(
      `INSERT INTO spend_tracking (agent_id, date, total_spent_sol, total_spent_usdc, total_spent_usd)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(agent_id, date) DO UPDATE SET
         total_spent_sol = total_spent_sol + excluded.total_spent_sol,
         total_spent_usdc = total_spent_usdc + excluded.total_spent_usdc,
         total_spent_usd = total_spent_usd + excluded.total_spent_usd`
    )
    .run(agentId, date, deltaSol, deltaUsdc, deltaUsd);
}

export function updatePeakPortfolioUSD(agentId: string, date: string, currentUSD: number): void {
  getDb()
    .prepare(
      `INSERT INTO spend_tracking (agent_id, date, total_spent_sol, total_spent_usdc, total_spent_usd, peak_portfolio_usd)
       VALUES (?, ?, 0, 0, 0, ?)
       ON CONFLICT(agent_id, date) DO UPDATE SET
         peak_portfolio_usd = MAX(peak_portfolio_usd, excluded.peak_portfolio_usd)`
    )
    .run(agentId, date, currentUSD);
}

export function insertCapitalEvent(row: CapitalEventRow): void {
  getDb()
    .prepare(
      `INSERT INTO capital_events (id, agent_id, event_type, amount_sol, amount_usd, source_note, created_at)
       VALUES (@id, @agent_id, @event_type, @amount_sol, @amount_usd, @source_note, @created_at)`
    )
    .run(row);
}

export function getCapitalEvents(agentId: string, limit = 100): CapitalEventRow[] {
  return getDb()
    .prepare("SELECT * FROM capital_events WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(agentId, limit) as CapitalEventRow[];
}

export function insertPolicyVersion(row: PolicyVersionRow): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO policy_versions (agent_id, version, policy_hash, policy_json, created_at)
       VALUES (@agent_id, @version, @policy_hash, @policy_json, @created_at)`
    )
    .run(row);
}

export function getPolicyVersions(agentId: string): PolicyVersionRow[] {
  return getDb()
    .prepare("SELECT * FROM policy_versions WHERE agent_id = ? ORDER BY version ASC")
    .all(agentId) as PolicyVersionRow[];
}

export function getLatestPolicyVersion(agentId: string): number {
  const row = getDb()
    .prepare("SELECT MAX(version) as v FROM policy_versions WHERE agent_id = ?")
    .get(agentId) as { v: number | null };
  return row.v ?? 0;
}

export function insertPendingTransaction(row: PendingTransactionRow): void {
  getDb()
    .prepare(
      `INSERT INTO pending_transactions (id, agent_id, intent_json, intent_hash, policy_hash, reasoning, usd_value, simulation_json, status, expires_at, webhook_notified, created_at)
       VALUES (@id, @agent_id, @intent_json, @intent_hash, @policy_hash, @reasoning, @usd_value, @simulation_json, @status, @expires_at, @webhook_notified, @created_at)`
    )
    .run(row);
}

export function getPendingTransactions(agentId: string): PendingTransactionRow[] {
  return getDb()
    .prepare("SELECT * FROM pending_transactions WHERE agent_id = ? AND status = 'awaiting_approval' ORDER BY created_at DESC")
    .all(agentId) as PendingTransactionRow[];
}

export function getPendingTransactionById(id: string): PendingTransactionRow | undefined {
  return getDb()
    .prepare("SELECT * FROM pending_transactions WHERE id = ?")
    .get(id) as PendingTransactionRow | undefined;
}

export function updatePendingTransactionStatus(id: string, status: string): void {
  getDb().prepare("UPDATE pending_transactions SET status = ? WHERE id = ?").run(status, id);
}

export function expireStalePendingTransactions(): void {
  getDb()
    .prepare("UPDATE pending_transactions SET status = 'expired' WHERE status = 'awaiting_approval' AND expires_at < ?")
    .run(new Date().toISOString());
}

export function insertAuditLog(row: AuditLogRow): void {
  getDb()
    .prepare(
      `INSERT INTO audit_log (id, agent_id, intent_hash, policy_hash, intent_json, usd_risk_check_json, simulation_json, approval_state, final_tx_signature, created_at)
       VALUES (@id, @agent_id, @intent_hash, @policy_hash, @intent_json, @usd_risk_check_json, @simulation_json, @approval_state, @final_tx_signature, @created_at)`
    )
    .run(row);
}

export function getAuditLogByAgent(agentId: string, limit = 50): AuditLogRow[] {
  return getDb()
    .prepare("SELECT * FROM audit_log WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(agentId, limit) as AuditLogRow[];
}
