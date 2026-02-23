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
  `);
}

function runMigrations(db: Database.Database): void {
  const cols = db.pragma("table_info(agents)") as { name: string }[];
  const colNames = new Set(cols.map((c) => c.name));

  if (!colNames.has("last_activity_at")) {
    db.exec("ALTER TABLE agents ADD COLUMN last_activity_at TEXT");
  }
  if (!colNames.has("reputation_score")) {
    db.exec("ALTER TABLE agents ADD COLUMN reputation_score REAL NOT NULL DEFAULT 1.0");
  }
}

export interface AgentRow {
  id: string;
  public_key: string;
  encrypted_private_key: string;
  api_key_hash: string;
  policy_json: string;
  status: string;
  created_at: string;
  last_activity_at: string | null;
  reputation_score: number;
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
}

export interface SpendRow {
  agent_id: string;
  date: string;
  total_spent_sol: number;
  total_spent_usdc: number;
}

export function insertAgent(row: Omit<AgentRow, "last_activity_at" | "reputation_score">): void {
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
  getDb()
    .prepare("UPDATE agents SET status = ? WHERE id = ?")
    .run(status, id);
}

export function updateAgentActivity(id: string): void {
  getDb()
    .prepare("UPDATE agents SET last_activity_at = ? WHERE id = ?")
    .run(new Date().toISOString(), id);
}

export function updateReputation(id: string, delta: number): void {
  getDb()
    .prepare("UPDATE agents SET reputation_score = MAX(0, MIN(10, reputation_score + ?)) WHERE id = ?")
    .run(delta, id);
}

export function insertTransaction(row: TransactionRow): void {
  getDb()
    .prepare(
      `INSERT INTO transactions (id, agent_id, intent_type, reasoning, signature, slot, amount, token_mint, status, created_at)
       VALUES (@id, @agent_id, @intent_type, @reasoning, @signature, @slot, @amount, @token_mint, @status, @created_at)`
    )
    .run(row);
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
  return row ?? { agent_id: agentId, date, total_spent_sol: 0, total_spent_usdc: 0 };
}

export function upsertSpend(agentId: string, date: string, deltaSol: number, deltaUsdc: number): void {
  getDb()
    .prepare(
      `INSERT INTO spend_tracking (agent_id, date, total_spent_sol, total_spent_usdc)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(agent_id, date) DO UPDATE SET
         total_spent_sol = total_spent_sol + excluded.total_spent_sol,
         total_spent_usdc = total_spent_usdc + excluded.total_spent_usdc`
    )
    .run(agentId, date, deltaSol, deltaUsdc);
}
