// lib/db.ts
import { Pool } from "pg";

declare global {
  // allow global var in dev
  // eslint-disable-next-line no-var
  var __pool: Pool | undefined;
}

export function getPool() {
  if (!global.__pool) {
    global.__pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    });
  }
  return global.__pool;
}
