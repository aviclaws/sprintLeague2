// lib/db.ts
import { neon } from "@neondatabase/serverless";

// Optional: corporate proxy for LOCAL dev only.
// Do NOT set HTTPS_PROXY on Vercel; this runs only in non-production.
if (process.env.HTTPS_PROXY && process.env.NODE_ENV !== "production") {
  try {
    // dynamic require so it won't affect the prod build
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ProxyAgent, setGlobalDispatcher } = require("undici");
    setGlobalDispatcher(new ProxyAgent(process.env.HTTPS_PROXY));
  } catch (e) {
    console.warn("[db] Proxy setup skipped:", e);
  }
}

// Ensure DATABASE_URL is present and uses the NON-pooler Neon host (no "-pooler")
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined in .env(.local)");
}

export const sql = neon(process.env.DATABASE_URL!);
