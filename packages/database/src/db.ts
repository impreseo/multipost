import { createRequire } from "node:module";
import { MIGRATION_SQL, SCHEMA_VERSION } from "./schema.js";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");

export interface Statement<T = unknown> {
  get(...params: unknown[]): T | undefined;
  all(...params: unknown[]): T[];
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
}

export interface WelzDatabase {
  exec(sql: string): void;
  prepare<T = unknown>(sql: string): Statement<T>;
  transaction<T>(fn: () => T): () => T;
  pragma(sql: string): void;
  close(): void;
}

class SqliteDatabaseWrapper implements WelzDatabase {
  private raw: InstanceType<typeof DatabaseSync>;

  constructor(path: string) {
    this.raw = new DatabaseSync(path);
  }

  exec(sql: string): void {
    this.raw.exec(sql);
  }

  prepare<T = unknown>(sql: string): Statement<T> {
    const stmt = this.raw.prepare(sql);
    return {
      get: (...params: unknown[]) => stmt.get(...params) as T | undefined,
      all: (...params: unknown[]) => stmt.all(...params) as T[],
      run: (...params: unknown[]) => stmt.run(...params),
    };
  }

  transaction<T>(fn: () => T): () => T {
    return () => {
      this.raw.exec("BEGIN");
      try {
        const result = fn();
        this.raw.exec("COMMIT");
        return result;
      } catch (err) {
        try {
          this.raw.exec("ROLLBACK");
        } catch {
          /* ignore */
        }
        throw err;
      }
    };
  }

  pragma(sql: string): void {
    this.raw.exec(`PRAGMA ${sql};`);
  }

  close(): void {
    this.raw.close();
  }
}

export function openDatabase(dbPath: string): WelzDatabase {
  const db = new SqliteDatabaseWrapper(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: WelzDatabase): void {
  db.exec(MIGRATION_SQL);
  const row = db
    .prepare("SELECT value FROM settings WHERE key = 'schema_version'")
    .get() as { value: string } | undefined;
  if (!row) {
    db.prepare(
      "INSERT INTO settings (key, value, updated_at) VALUES ('schema_version', ?, datetime('now'))"
    ).run(String(SCHEMA_VERSION));
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return crypto.randomUUID();
}
