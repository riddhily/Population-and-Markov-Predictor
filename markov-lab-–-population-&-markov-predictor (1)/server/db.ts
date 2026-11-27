import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

export interface SimulationRow {
  id: number;
  name: string;
  description: string;
  states: string; // JSON stringified string[]
  created_at: string;
  updated_at: string;
}

export interface TransitionMatrixRow {
  id: number;
  simulation_id: number;
  matrix_name: string;
  matrix_data: string; // JSON stringified number[][]
  generation_type: 'manual' | 'automatic';
  created_at: string;
}

export interface SimulationRunRow {
  id: number;
  simulation_id: number;
  matrix_id: number;
  initial_population: string; // JSON stringified { mode: 'probability' | 'counts', values: number[], unit_label?: string }
  iterations: number;
  results: string; // JSON stringified simulation results
  created_at: string;
}

const DB_PATH = path.resolve(process.cwd(), 'markov_lab.db');

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    dbInstance.exec('PRAGMA journal_mode = WAL;');
    initializeSchema(dbInstance);
  }
  return dbInstance;
}

export function initializeSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS simulations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      states TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transition_matrices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      simulation_id INTEGER NOT NULL,
      matrix_name TEXT NOT NULL,
      matrix_data TEXT NOT NULL,
      generation_type TEXT NOT NULL CHECK(generation_type IN ('manual', 'automatic')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (simulation_id) REFERENCES simulations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS simulation_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      simulation_id INTEGER NOT NULL,
      matrix_id INTEGER NOT NULL,
      initial_population TEXT NOT NULL,
      iterations INTEGER NOT NULL,
      results TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (simulation_id) REFERENCES simulations(id) ON DELETE CASCADE,
      FOREIGN KEY (matrix_id) REFERENCES transition_matrices(id) ON DELETE CASCADE
    );
  `);
}

export function checkDatabaseHealth(): { connected: boolean; path: string; tables: string[] } {
  const db = getDb();
  const row = db.prepare('SELECT 1 AS ok').get() as { ok: number };
  const tableRows = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as { name: string }[];
  return {
    connected: row?.ok === 1,
    path: 'markov_lab.db',
    tables: tableRows.map((t) => t.name),
  };
}
