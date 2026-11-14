import fs from "node:fs";
import path from "node:path";
import sqlite3 from "sqlite3";

sqlite3.verbose();

const dbDirectory = path.join(process.cwd(), "data");
const dbPath = path.join(dbDirectory, "church-game.db");

export function getDb() {
  if (!fs.existsSync(dbDirectory)) {
    fs.mkdirSync(dbDirectory, { recursive: true });
  }

  return new sqlite3.Database(dbPath);
}

export async function initDb() {
  return new Promise<void>((resolve, reject) => {
    const db = getDb();

    db.serialize(() => {
      db.run(
        `CREATE TABLE IF NOT EXISTS sessions (
          session_id TEXT PRIMARY KEY,
          payload TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        (error) => {
          if (error) {
            reject(error);
            db.close();
            return;
          }

          db.close(() => resolve());
        }
      );
    });
  });
}

export async function saveSessionRecord(sessionId: string, payload: string) {
  return new Promise<void>((resolve, reject) => {
    const db = getDb();

    db.serialize(() => {
      db.run(
        `INSERT INTO sessions (session_id, payload, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(session_id) DO UPDATE SET
           payload = excluded.payload,
           updated_at = CURRENT_TIMESTAMP`,
        [sessionId, payload],
        (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }

          db.close();
        }
      );
    });
  });
}

export async function getSessionRecord(sessionId: string) {
  return new Promise<{ sessionId: string; payload: string } | null>((resolve, reject) => {
    const db = getDb();

    db.get(
      `SELECT session_id AS sessionId, payload FROM sessions WHERE session_id = ?`,
      [sessionId],
      (error, row: { sessionId?: string; payload?: string } | undefined) => {
        db.close();

        if (error) {
          reject(error);
          return;
        }

        if (!row?.sessionId || !row?.payload) {
          resolve(null);
          return;
        }

        resolve({ sessionId: row.sessionId, payload: row.payload });
      }
    );
  });
}
