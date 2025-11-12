// lib/db.ts
import { neon, neonConfig } from "@neondatabase/serverless";

// Optional: network timeout (supported)
neonConfig.fetchTimeout = 12_000;

// Use a proxy only in local dev if you need it (e.g., corporate VPN).
// Do NOT set HTTPS_PROXY in Vercel; this block will simply not run there.
if (process.env.HTTPS_PROXY && process.env.NODE_ENV !== "production") {
  try {
    // Dynamic require so it doesn't get bundled for edge, and stays optional.
    // If you didn't `npm i undici`, you can remove this whole block.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ProxyAgent, setGlobalDispatcher } = require("undici");
    setGlobalDispatcher(new ProxyAgent(process.env.HTTPS_PROXY));
  } catch (e) {
    console.warn("[db] Proxy setup skipped:", e);
  }
}

// Fail fast if missing
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined in .env(.local)");
}

// IMPORTANT: DATABASE_URL should use the NON-pooler Neon host (no "-pooler")
export const sql = neon(process.env.DATABASE_URL!);
