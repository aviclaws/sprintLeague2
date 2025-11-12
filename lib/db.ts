// lib/db.ts
import { neon, neonConfig } from "@neondatabase/serverless";

// If your org requires a proxy for outbound HTTPS,
// set HTTPS_PROXY in .env.local and we’ll wire it into undici:
if (process.env.HTTPS_PROXY) {
  // These are runtime deps already provided by Next (undici),
  // no extra install needed.
  // @ts-ignore
  const { ProxyAgent, setGlobalDispatcher } = require("undici");
  setGlobalDispatcher(new ProxyAgent(process.env.HTTPS_PROXY));
}

neonConfig.fetchConnectionCache = true; // message says it's always true now; harmless
neonConfig.poolQueryTimeout = 10_000;
neonConfig.fetchTimeout = 12_000;

// Use the NON-pooler Neon host (no "-pooler" in the hostname)
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined in .env.local");
}

export const sql = neon(process.env.DATABASE_URL!);
