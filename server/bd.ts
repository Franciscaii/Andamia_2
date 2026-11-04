import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type Base = DatabaseSync;

export function abrirBase(ruta: string): Base {
  if (ruta !== ":memory:") mkdirSync(dirname(ruta), { recursive: true });
  const db = new DatabaseSync(ruta);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      clave TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 0,
      creado_en INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sesiones (
      token_hash TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      expira_en INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS registros (
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      tabla TEXT NOT NULL,
      id TEXT NOT NULL,
      datos TEXT,
      modificado_en INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      PRIMARY KEY (usuario_id, tabla, id)
    );
    CREATE INDEX IF NOT EXISTS registros_revision ON registros (usuario_id, revision);
  `);
  return db;
}

/** node:sqlite es síncrono: nada se intercala dentro de la transacción. */
export function enTransaccion<T>(db: Base, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
