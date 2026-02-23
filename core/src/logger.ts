type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const MIN_LEVEL: Level = (process.env.LOG_LEVEL as Level) ?? "info";

function pad(s: string, n: number): string {
  return s.padEnd(n);
}

export function log(level: Level, msg: string, fields?: Record<string, unknown>): void {
  if (LEVELS[level] < LEVELS[MIN_LEVEL]) return;
  const ts = new Date().toISOString();
  const label = pad(level.toUpperCase(), 5);
  const suffix = fields && Object.keys(fields).length > 0 ? " " + JSON.stringify(fields) : "";
  const line = `[${ts}] ${label} ${msg}${suffix}`;
  if (level === "error" || level === "warn") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export function logInfo(msg: string, fields?: Record<string, unknown>): void {
  log("info", msg, fields);
}

export function logWarn(msg: string, fields?: Record<string, unknown>): void {
  log("warn", msg, fields);
}

export function logError(msg: string, fields?: Record<string, unknown>): void {
  log("error", msg, fields);
}

export function logDebug(msg: string, fields?: Record<string, unknown>): void {
  log("debug", msg, fields);
}
